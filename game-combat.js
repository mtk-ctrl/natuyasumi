function spawnEnemy(forceType = null) {
  const margin = 40;
  const edge = (Math.random() * 3) | 0;
  let x;
  let y;
  if (edge === 0) {
    x = rand(margin, W - margin);
    y = -45;
  } else if (edge === 1) {
    x = -45;
    y = rand(H * 0.12, H * 0.68);
  } else {
    x = W + 45;
    y = rand(H * 0.12, H * 0.68);
  }

  let type = forceType;
  if (!type) {
    const roll = Math.random();
    const sniperChance = game.wave >= 4 ? Math.min(0.08 + game.wave * 0.01, 0.22) : 0;
    if (roll < sniperChance) type = 'cicada';
    else if (roll < sniperChance + Math.min(0.2 + game.wave * 0.012, 0.4)) type = 'spinner';
    else if (roll < 0.76) type = 'chaser';
    else type = 'tank';
  }

  let data;
  if (type === 'chaser') data = { r: 13, hp: 2.2 + game.wave * 0.3, speed: rand(36, 54), value: 110 };
  else if (type === 'spinner') data = { r: 16, hp: 4.5 + game.wave * 0.45, speed: rand(19, 30), value: 190 };
  else if (type === 'cicada') data = { r: 15, hp: 3.5 + game.wave * 0.38, speed: rand(16, 23), value: 230 };
  else data = { r: 22, hp: 9 + game.wave * 0.82, speed: rand(12, 20), value: 290 };

  game.enemies.push({
    x, y, type,
    angle: Math.random() * TAU,
    fire: rand(0.55, 1.55),
    phase: Math.random() * TAU,
    hit: 0,
    ...data,
    maxHp: data.hp
  });
}

function spawnBoss() {
  const hp = 85 + game.wave * 18;
  game.enemies.push({
    x: W / 2,
    y: -90,
    type: 'boss',
    r: 48,
    hp,
    maxHp: hp,
    speed: 16,
    value: 4000,
    angle: 0,
    phase: 0,
    fire: 1.2,
    hit: 0
  });
  game.bossSpawnedWave = game.wave;
  game.shake = 10;
  game.rings.push({ x: W / 2, y: 80, r: 20, max: W * 0.7, life: 1.4, color: '#ffd76a', width: 4 });
  audio?.tone(65, 1.2, 'sawtooth', 0.12, 80);
  toast('BONFIRE COLOSSUS 出現');
}

function nearestEnemy(x, y) {
  let result = null;
  let bestDistance = Infinity;
  for (const enemy of game.enemies) {
    const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      result = enemy;
    }
  }
  return result;
}

function shoot(x, y, power = 1, echo = false, sourceAngle = null) {
  const target = nearestEnemy(x, y);
  if (!target) return;
  const base = sourceAngle ?? Math.atan2(target.y - y, target.x - x);
  const count = echo ? 1 : 1 + game.upgrades.multiShot;
  const spread = 0.13;
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spread;
    const angle = base + offset;
    const speed = echo ? 410 : 500;
    const crit = !echo && Math.random() < game.upgrades.critical * 0.06;
    game.bullets.push({
      x, y, px: x, py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: echo ? 4 : 4.8,
      life: 1.5,
      power: power * (crit ? 2 : 1),
      echo,
      crit,
      pierce: game.upgrades.pierce,
      angle
    });
  }
  if (!echo) audio?.tone(620 + Math.random() * 70, 0.045, 'square', 0.028, 70);
}

function enemyShoot(enemy) {
  const aimed = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
  let count = 1;
  if (enemy.type === 'spinner') count = 6;
  if (enemy.type === 'boss') count = game.wave >= 10 ? 14 : 10;
  if (enemy.type === 'cicada') count = 3;

  for (let i = 0; i < count; i++) {
    let angle;
    if (enemy.type === 'spinner' || enemy.type === 'boss') angle = enemy.angle + i * TAU / count;
    else if (enemy.type === 'cicada') angle = aimed + (i - 1) * 0.15;
    else angle = aimed;
    const speed = enemy.type === 'tank' ? 120 : enemy.type === 'boss' ? 155 : enemy.type === 'cicada' ? 225 : 150;
    game.enemyBullets.push({
      x: enemy.x,
      y: enemy.y,
      px: enemy.x,
      py: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: enemy.type === 'tank' ? 7 : enemy.type === 'boss' ? 6 : 4.7,
      life: 5.5,
      type: enemy.type === 'cicada' ? 'needle' : enemy.type === 'boss' ? 'ember' : 'petal',
      grazed: false,
      angle
    });
  }
  audio?.tone(enemy.type === 'boss' ? 65 : 90, 0.08, 'sawtooth', 0.015, -20);
}

function burstParticles(x, y, color, count, speed = 2, shape = 'square') {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const velocity = rand(0.3, speed);
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * velocity * 60,
      vy: Math.sin(angle) * velocity * 60,
      life: rand(0.28, 0.9),
      max: 1,
      r: rand(1.2, 4),
      color,
      shape,
      rot: Math.random() * TAU,
      vr: rand(-8, 8)
    });
  }
}

function killEnemy(enemy) {
  const index = game.enemies.indexOf(enemy);
  if (index < 0) return;
  game.enemies.splice(index, 1);
  game.kills++;
  game.combo++;
  game.comboTimer = 2.4;
  const multiplier = 1 + Math.min(game.combo, 30) * 0.055;
  const gain = Math.floor(enemy.value * multiplier);
  game.score += gain;
  game.burst = clamp(game.burst + (enemy.type === 'boss' ? 35 : enemy.type === 'tank' ? 9 : 3.5), 0, 100);
  floatingText(enemy.x, enemy.y - enemy.r, `+${gain}`, enemy.type === 'boss' ? '#ffd76a' : '#ff8ee0', enemy.type === 'boss' ? 22 : 12);

  const color = enemy.type === 'boss' ? '#ffd76a' : enemy.type === 'tank' ? '#ffb95f' : enemy.type === 'cicada' ? '#9a8cff' : '#ff61d8';
  burstParticles(enemy.x, enemy.y, color, enemy.type === 'boss' ? 140 : enemy.type === 'tank' ? 42 : 22, enemy.type === 'boss' ? 7 : 3.6, enemy.type === 'boss' ? 'ember' : 'shard');
  game.rings.push({
    x: enemy.x,
    y: enemy.y,
    r: 4,
    max: enemy.type === 'boss' ? Math.max(W, H) * 0.75 : enemy.r * 4.2,
    life: enemy.type === 'boss' ? 1.3 : 0.55,
    color,
    width: enemy.type === 'boss' ? 5 : 2
  });

  const drops = enemy.type === 'boss' ? 12 : enemy.type === 'tank' ? 3 : (Math.random() < 0.3 ? 1 : 0);
  for (let i = 0; i < drops; i++) {
    game.pickups.push({
      x: enemy.x,
      y: enemy.y,
      vx: rand(-85, 85),
      vy: rand(-75, 55),
      r: 7,
      life: 12,
      phase: Math.random() * TAU,
      kind: enemy.type === 'boss' && i === 0 ? 'heart' : 'memory'
    });
  }

  if (enemy.type === 'boss') {
    game.flash = 0.9;
    game.shake = 22;
    game.overdrive = 10;
    toast('夏の巨影を撃破 — OVERDRIVE');
    audio?.tone(95, 1.1, 'triangle', 0.16, 850);
  } else {
    audio?.tone(enemy.type === 'tank' ? 120 : 180, 0.13, 'triangle', 0.055, 120);
  }
}

function hitPlayer() {
  if (game.player.inv > 0 || game.burstActive > 0) return;
  if (game.upgrades.shield > 0) {
    game.upgrades.shield--;
    game.player.inv = 1.4;
    game.rings.push({ x: game.player.x, y: game.player.y, r: 8, max: 95, life: 0.8, color: '#ffd76a', width: 3 });
    toast('麦わらシールドが守った');
    audio?.tone(740, 0.2, 'sine', 0.08, -160);
    return;
  }
  game.hp--;
  game.player.inv = 1.8;
  game.shake = 18;
  game.flash = 0.35;
  game.combo = 0;
  burstParticles(game.player.x, game.player.y, '#ffffff', 38, 4.5, 'spark');
  audio?.noise(0.2, 0.1);
  audio?.tone(110, 0.3, 'sawtooth', 0.12, -70);
  if (navigator.vibrate) navigator.vibrate(35);
  if (game.hp <= 0) gameOver();
}

function activateBurst() {
  if (state !== 'playing' || game.burst < 100) return;
  game.burst = 0;
  game.burstActive = 1.5;
  game.overdrive = Math.max(game.overdrive, 6);
  game.shake = 12;
  game.flash = 0.7;
  game.enemyBullets.length = 0;
  game.rings.push({ x: game.player.x, y: game.player.y, r: 8, max: Math.max(W, H) * 1.15, life: 1.1, color: '#ffd76a', width: 6 });
  for (const enemy of [...game.enemies]) {
    enemy.hp -= 7.5 * game.upgrades.power;
    if (enemy.hp <= 0) killEnemy(enemy);
  }
  burstParticles(game.player.x, game.player.y, '#ffd76a', 115, 7, 'ember');
  audio?.tone(110, 1, 'sine', 0.18, 770);
  audio?.noise(0.55, 0.08);
  toast('SUMMER BURST — OVERDRIVE');
  if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
}

function dashTo(x, y) {
  if (game.dashCooldown > 0 || state !== 'playing') return;
  const player = game.player;
  const dx = x - player.x;
  const dy = y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  const distance = Math.min(130, length);
  const nx = dx / length;
  const ny = dy / length;
  burstParticles(player.x, player.y, '#7ff9ff', 22, 3.5, 'spark');
  player.x = player.tx = clamp(player.x + nx * distance, 24, W - 24);
  player.y = player.ty = clamp(player.y + ny * distance, 92, H - 72);
  player.inv = Math.max(player.inv, 0.42);
  game.dashCooldown = 1.2;
  game.shake = 4;
  game.rings.push({ x: player.x, y: player.y, r: 6, max: 55, life: 0.35, color: '#7ff9ff', width: 2 });
  audio?.tone(240, 0.12, 'sawtooth', 0.06, 480);
  if (navigator.vibrate) navigator.vibrate(10);
}

function showUpgrade() {
  const available = upgrades.filter((upgrade) => game.upgrades[upgrade.key] < upgrade.max);
  if (available.length === 0) {
    state = 'playing';
    last = performance.now();
    toast('すべての夏の記憶が目覚めている');
    return;
  }

  state = 'upgrade';
  const choices = [];
  while (choices.length < Math.min(3, available.length)) {
    const selected = pick(available);
    if (!choices.includes(selected)) choices.push(selected);
  }

  const grid = $('#upgradeChoices');
  grid.innerHTML = '';
  choices.forEach((upgrade) => {
    const button = document.createElement('button');
    button.className = 'upgrade-card';
    button.innerHTML = `<em>${upgrade.icon}　Lv.${game.upgrades[upgrade.key]} → ${game.upgrades[upgrade.key] + 1}</em><b>${upgrade.name}</b><span>${upgrade.desc}</span>`;
    button.onclick = () => {
      game.upgrades[upgrade.key]++;
      if (upgrade.key === 'orbit') syncOrbitals();
      state = 'playing';
      showPanel(null);
      last = performance.now();
      audio?.tone(440, 0.35, 'triangle', 0.12, 440);
      toast(`${upgrade.name} を思い出した`);
    };
    grid.appendChild(button);
  });
  showPanel(ui.upgrade);
}

function syncOrbitals() {
  while (game.orbitals.length < game.upgrades.orbit) {
    game.orbitals.push({ angle: Math.random() * TAU, fire: rand(0, 0.35), x: game.player.x, y: game.player.y });
  }
  game.orbitals.length = game.upgrades.orbit;
}
