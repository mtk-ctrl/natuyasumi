function update(dt) {
  if (state !== 'playing') return;

  game.time += dt;
  game.waveTimer += dt;
  game.echoTimer += dt;
  game.levelTimer += dt;
  game.player.inv = Math.max(0, game.player.inv - dt);
  game.burstActive = Math.max(0, game.burstActive - dt);
  game.overdrive = Math.max(0, game.overdrive - dt);
  game.dashCooldown = Math.max(0, game.dashCooldown - dt);
  game.flash = Math.max(0, game.flash - dt);
  game.shake *= Math.pow(0.001, dt);
  if (game.comboTimer > 0) game.comboTimer -= dt;
  else game.combo = 0;

  if (game.waveTimer >= 18) {
    game.waveTimer -= 18;
    game.wave++;
    toast(`WAVE ${game.wave}`);
    audio?.tone(260, 0.5, 'triangle', 0.1, 520);
  }
  if (game.wave % 5 === 0 && game.bossSpawnedWave !== game.wave && !game.enemies.some((enemy) => enemy.type === 'boss')) spawnBoss();
  if (game.echoTimer >= 8) {
    game.echoTimer -= 8;
    createEcho();
  }
  if (game.levelTimer >= 28) {
    game.levelTimer -= 28;
    showUpgrade();
    return;
  }

  const player = game.player;
  const follow = 1 - Math.pow(0.0008, dt * game.upgrades.speed);
  const oldX = player.x;
  const oldY = player.y;
  player.x = lerp(player.x, clamp(player.tx, 24, W - 24), follow);
  player.y = lerp(player.y, clamp(player.ty, 92, H - 72), follow);
  const moveX = player.x - oldX;
  const moveY = player.y - oldY;
  if (moveX * moveX + moveY * moveY > 0.01) {
    const targetAngle = Math.atan2(moveY, moveX);
    player.angle += Math.atan2(Math.sin(targetAngle - player.angle), Math.cos(targetAngle - player.angle)) * 0.18;
  }
  player.trail.unshift({ x: player.x, y: player.y, life: 1, angle: player.angle });
  if (player.trail.length > 34) player.trail.pop();

  // Fixed 60 Hz path sampling keeps the echo at exactly eight seconds on 60/90/120 Hz screens.
  game.pathTimer += dt;
  const sampleStep = 1 / 60;
  while (game.pathTimer >= sampleStep) {
    game.pathTimer -= sampleStep;
    game.path.push({ x: player.x, y: player.y });
    if (game.path.length > 500) game.path.shift();
  }

  const fireBoost = game.overdrive > 0 ? 1.7 : 1;
  player.fire -= dt;
  if (player.fire <= 0 && game.enemies.length) {
    player.fire = 0.23 / (game.upgrades.fireRate * fireBoost);
    shoot(player.x, player.y, game.upgrades.power * (game.overdrive > 0 ? 1.25 : 1), false);
  }

  syncOrbitals();
  for (let i = 0; i < game.orbitals.length; i++) {
    const orbital = game.orbitals[i];
    orbital.angle += dt * (1.8 + i * 0.15);
    const radius = 34 + i * 9;
    orbital.x = player.x + Math.cos(orbital.angle + i * TAU / Math.max(1, game.orbitals.length)) * radius;
    orbital.y = player.y + Math.sin(orbital.angle + i * TAU / Math.max(1, game.orbitals.length)) * radius;
    orbital.fire -= dt;
    if (orbital.fire <= 0 && game.enemies.length) {
      orbital.fire = 0.55 / fireBoost;
      shoot(orbital.x, orbital.y, 0.55 * game.upgrades.power, true);
    }
  }

  for (let i = game.echoes.length - 1; i >= 0; i--) {
    const echo = game.echoes[i];
    echo.age += dt;
    echo.life -= dt;
    echo.idx = (echo.idx + dt * 60) % echo.points.length;
    const position = echo.points[echo.idx | 0];
    const previous = echo.points[Math.max(0, (echo.idx | 0) - 1)] || position;
    echo.x = position.x;
    echo.y = position.y;
    echo.angle = Math.atan2(position.y - previous.y, position.x - previous.x);
    echo.trail.unshift({ x: echo.x, y: echo.y });
    if (echo.trail.length > 16) echo.trail.pop();
    echo.fire -= dt;
    if (echo.fire <= 0 && game.enemies.length) {
      echo.fire = 0.38 / (game.upgrades.fireRate * fireBoost);
      shoot(echo.x, echo.y, 0.62 * game.upgrades.echoPower * game.upgrades.power, true);
    }
    if (echo.life <= 0) game.echoes.splice(i, 1);
  }

  game.spawnTimer -= dt;
  const bossAlive = game.enemies.some((enemy) => enemy.type === 'boss');
  if (game.spawnTimer <= 0) {
    game.spawnTimer = Math.max(0.25, 1.02 - game.wave * 0.045) * rand(0.72, 1.16) * (bossAlive ? 1.75 : 1);
    if (!bossAlive || Math.random() < 0.55) spawnEnemy();
    if (game.wave > 4 && !bossAlive && Math.random() < 0.16) spawnEnemy();
  }

  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    enemy.phase += dt * 2;
    enemy.hit = Math.max(0, enemy.hit - dt * 4);
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);

    if (enemy.type === 'boss') {
      enemy.angle += dt * 0.55;
      const targetY = H * 0.23;
      enemy.y = lerp(enemy.y, targetY + Math.sin(enemy.phase * 0.45) * 28, 1 - Math.pow(0.03, dt));
      enemy.x = lerp(enemy.x, W / 2 + Math.sin(enemy.phase * 0.31) * W * 0.26, 1 - Math.pow(0.05, dt));
    } else if (enemy.type === 'spinner') {
      enemy.angle += dt * 1.8;
      enemy.x += Math.cos(angleToPlayer + Math.sin(enemy.phase) * 0.68) * enemy.speed * dt;
      enemy.y += Math.sin(angleToPlayer + Math.sin(enemy.phase) * 0.68) * enemy.speed * dt;
    } else if (enemy.type === 'cicada') {
      enemy.angle = angleToPlayer;
      const desired = 230;
      const distance = Math.sqrt(dist2(enemy, player));
      const direction = distance > desired ? 1 : -1;
      enemy.x += Math.cos(angleToPlayer) * enemy.speed * direction * dt;
      enemy.y += Math.sin(angleToPlayer) * enemy.speed * direction * dt;
    } else {
      enemy.angle = angleToPlayer;
      enemy.x += Math.cos(angleToPlayer) * enemy.speed * dt;
      enemy.y += Math.sin(angleToPlayer) * enemy.speed * dt;
    }

    enemy.fire -= dt;
    if (enemy.fire <= 0 && enemy.y > 35) {
      enemy.fire = enemy.type === 'boss' ? 0.78 : enemy.type === 'spinner' ? 1.4 : enemy.type === 'cicada' ? 1.8 : enemy.type === 'tank' ? 2.05 : rand(2.2, 3);
      if (enemy.type !== 'chaser' || game.wave > 3) enemyShoot(enemy);
    }

    if (dist2(enemy, player) < (enemy.r + player.r) ** 2) {
      if (enemy.type !== 'boss') game.enemies.splice(i, 1);
      hitPlayer();
    }
  }

  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const bullet = game.bullets[i];
    bullet.px = bullet.x;
    bullet.py = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.x < -35 || bullet.x > W + 35 || bullet.y < -35 || bullet.y > H + 35) {
      game.bullets.splice(i, 1);
      continue;
    }
    for (const enemy of [...game.enemies]) {
      if (dist2(bullet, enemy) < (bullet.r + enemy.r) ** 2) {
        enemy.hp -= bullet.power;
        enemy.hit = 1;
        if (bullet.crit) floatingText(bullet.x, bullet.y, 'CRIT', '#ffd76a', 11);
        burstParticles(bullet.x, bullet.y, bullet.echo ? '#79dfff' : bullet.crit ? '#ffd76a' : '#ffffff', bullet.crit ? 8 : 4, 1.5, 'spark');
        if (enemy.hp <= 0) killEnemy(enemy);
        if (bullet.pierce > 0) bullet.pierce--;
        else {
          game.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
    const bullet = game.enemyBullets[i];
    bullet.px = bullet.x;
    bullet.py = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    bullet.angle += dt * 2.4;
    if (bullet.life <= 0 || bullet.x < -40 || bullet.x > W + 40 || bullet.y < -40 || bullet.y > H + 40) {
      game.enemyBullets.splice(i, 1);
      continue;
    }
    const distanceSquared = dist2(bullet, player);
    if (!bullet.grazed && distanceSquared < (player.r + bullet.r + 24) ** 2 && distanceSquared > (player.r + bullet.r) ** 2) {
      bullet.grazed = true;
      game.score += 25;
      game.burst = clamp(game.burst + 2.5, 0, 100);
      floatingText(player.x, player.y - 18, 'GRAZE +25', '#7ff9ff', 10);
      audio?.tone(880, 0.05, 'sine', 0.025, 90);
    }
    if (distanceSquared < (bullet.r + player.r) ** 2) {
      game.enemyBullets.splice(i, 1);
      hitPlayer();
    }
  }

  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pickup = game.pickups[i];
    pickup.life -= dt;
    pickup.phase += dt * 4;
    const distance = Math.sqrt(dist2(pickup, player));
    const range = 78 + game.upgrades.magnet * 34;
    if (distance < range) {
      const angle = Math.atan2(player.y - pickup.y, player.x - pickup.x);
      const pull = (1 - distance / range) * 720;
      pickup.vx += Math.cos(angle) * pull * dt;
      pickup.vy += Math.sin(angle) * pull * dt;
    }
    pickup.vx *= Math.pow(0.08, dt);
    pickup.vy *= Math.pow(0.08, dt);
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    if (distance < player.r + pickup.r + 5) {
      game.pickups.splice(i, 1);
      if (pickup.kind === 'heart' && game.hp < game.maxHp) {
        game.hp++;
        floatingText(pickup.x, pickup.y, 'LIFE +1', '#ff8ecf', 13);
      } else {
        game.memory++;
        game.score += 85;
        game.burst = clamp(game.burst + 12, 0, 100);
      }
      audio?.tone(700 + game.memory % 4 * 90, 0.12, 'sine', 0.08, 90);
      burstParticles(pickup.x, pickup.y, pickup.kind === 'heart' ? '#ff8ecf' : '#5bf5ff', 14, 2.2, 'shard');
    } else if (pickup.life <= 0) {
      game.pickups.splice(i, 1);
    }
  }

  for (let i = game.particles.length - 1; i >= 0; i--) {
    const particle = game.particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.rot += particle.vr * dt;
    particle.vx *= Math.pow(0.08, dt);
    particle.vy *= Math.pow(0.08, dt);
    if (particle.life <= 0) game.particles.splice(i, 1);
  }

  for (let i = game.rings.length - 1; i >= 0; i--) {
    const ring = game.rings[i];
    ring.life -= dt;
    ring.r = lerp(ring.r, ring.max, 1 - Math.pow(0.02, dt));
    if (ring.life <= 0) game.rings.splice(i, 1);
  }

  for (let i = game.texts.length - 1; i >= 0; i--) {
    const text = game.texts[i];
    text.life -= dt;
    text.y += text.vy * dt;
    text.vy *= Math.pow(0.12, dt);
    if (text.life <= 0) game.texts.splice(i, 1);
  }

  for (const star of game.stars) {
    star.y += (8 + star.z * 15) * dt;
    star.tw += dt * (1 + star.z);
    if (star.y > H) {
      star.y = -2;
      star.x = Math.random() * W;
    }
  }
  for (const cloud of game.clouds) {
    cloud.x += cloud.v * dt;
    if (cloud.x > W + 160) cloud.x = -220;
  }

  audio?.tick(dt);
  updateHud();
}

function updateHud() {
  ui.score.textContent = Math.floor(game.score).toLocaleString();
  ui.wave.textContent = game.wave;
  ui.echo.textContent = `${game.echoes.length}/3`;
  ui.life.textContent = '◆'.repeat(Math.max(0, game.hp)) + '◇'.repeat(Math.max(0, game.maxHp - game.hp));
  ui.burst.style.width = `${game.burst}%`;
  ui.burstPct.textContent = game.overdrive > 0 ? `${game.overdrive.toFixed(1)}s` : `${Math.floor(game.burst)}%`;
  ui.status.textContent = game.overdrive > 0 ? 'OVERDRIVE ACTIVE' : game.dashCooldown > 0 ? `DASH ${game.dashCooldown.toFixed(1)}s` : 'NORMAL DRIVE';
  ui.status.style.color = game.overdrive > 0 ? '#ffd76a' : '#5bf5ff';

  const boss = game.enemies.find((enemy) => enemy.type === 'boss');
  if (boss) {
    ui.bossWrap.classList.remove('hidden');
    const percent = clamp(boss.hp / boss.maxHp * 100, 0, 100);
    ui.bossBar.style.width = `${percent}%`;
    ui.bossPct.textContent = `${Math.ceil(percent)}%`;
  } else {
    ui.bossWrap.classList.add('hidden');
  }
}
