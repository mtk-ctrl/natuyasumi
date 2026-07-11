function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle + (enemy.type === 'spinner' ? game.time * 1.4 : 0));
  const color = enemy.hit > 0 ? '#ffffff' : enemy.type === 'tank' ? '#ffcf68' : enemy.type === 'cicada' ? '#9a8cff' : enemy.type === 'boss' ? '#ffab48' : '#ff59c8';
  ctx.strokeStyle = color;
  ctx.fillStyle = enemy.type === 'boss' ? 'rgba(255,100,30,.14)' : 'rgba(255,55,170,.10)';
  ctx.lineWidth = enemy.type === 'boss' ? 3 : enemy.type === 'tank' ? 2 : 1.5;
  ctx.shadowBlur = enemy.type === 'boss' ? 28 : 16;
  ctx.shadowColor = color;

  if (enemy.type === 'chaser') {
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.r * 0.55, enemy.r, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(-enemy.r * 0.7, 1, enemy.r * 0.7, enemy.r * 0.34, -0.3, 0, TAU);
    ctx.ellipse(enemy.r * 0.7, 1, enemy.r * 0.7, enemy.r * 0.34, 0.3, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -enemy.r);
    ctx.lineTo(-8, -enemy.r - 7);
    ctx.moveTo(3, -enemy.r);
    ctx.lineTo(8, -enemy.r - 7);
    ctx.stroke();
    glowCircle(0, -2, 2.5, '#ffffff', 10, 0.9);
  } else if (enemy.type === 'spinner') {
    polygonPath(6, enemy.r, enemy.r * 0.42, game.time * 1.8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r * 0.42, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const angle = i * TAU / 6;
      glowCircle(Math.cos(angle) * enemy.r * 0.72, Math.sin(angle) * enemy.r * 0.72, 2, color, 7, 0.9);
    }
  } else if (enemy.type === 'tank') {
    roundedRectPath(-enemy.r * 0.72, -enemy.r, enemy.r * 1.44, enemy.r * 2, 7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-enemy.r * 0.88, -enemy.r * 0.55);
    ctx.lineTo(enemy.r * 0.88, -enemy.r * 0.55);
    ctx.moveTo(-enemy.r * 0.88, enemy.r * 0.55);
    ctx.lineTo(enemy.r * 0.88, enemy.r * 0.55);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,207,104,.25)';
    ctx.fillRect(-enemy.r * 0.44, -enemy.r * 0.7, enemy.r * 0.88, enemy.r * 1.4);
    glowCircle(0, 0, 4, '#ffd76a', 15, 0.95);
  } else if (enemy.type === 'cicada') {
    ctx.beginPath();
    ctx.moveTo(enemy.r * 1.5, 0);
    ctx.lineTo(enemy.r * 0.35, -5);
    ctx.lineTo(-enemy.r, -enemy.r * 0.65);
    ctx.lineTo(-enemy.r * 0.65, 0);
    ctx.lineTo(-enemy.r, enemy.r * 0.65);
    ctx.lineTo(enemy.r * 0.35, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-enemy.r * 0.45, 0);
    ctx.lineTo(enemy.r * 1.7, 0);
    ctx.stroke();
    glowCircle(enemy.r * 1.25, 0, 2.5, color, 12, 1);
  } else {
    ctx.rotate(game.time * 0.25);
    polygonPath(12, enemy.r, enemy.r * 0.72, 0);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-game.time * 0.95);
    polygonPath(8, enemy.r * 0.68, enemy.r * 0.42, 0.2);
    ctx.stroke();
    ctx.rotate(game.time * 1.1);
    polygonPath(6, enemy.r * 0.38, enemy.r * 0.18, 0);
    ctx.fill();
    glowCircle(0, 0, enemy.r * 0.16, '#fff3c2', 30, 1);
    for (let i = 0; i < 3; i++) {
      const angle = game.time * (0.7 + i * 0.17) + i * TAU / 3;
      glowCircle(Math.cos(angle) * enemy.r * 0.82, Math.sin(angle) * enemy.r * 0.82, 4.5, i === 0 ? '#ffd76a' : '#ff5fcf', 14, 0.95);
    }
  }
  ctx.restore();

  if (enemy.type === 'tank') {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(enemy.x - enemy.r, enemy.y + enemy.r + 8, enemy.r * 2, 3);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(enemy.x - enemy.r, enemy.y + enemy.r + 8, enemy.r * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
    ctx.restore();
  }
}

function drawPlayerBullet(bullet) {
  const color = bullet.echo ? '#64dcff' : bullet.crit ? '#ffd76a' : '#f6ffff';
  const length = bullet.echo ? 12 : 18;
  const nx = Math.cos(bullet.angle);
  const ny = Math.sin(bullet.angle);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.shadowBlur = bullet.crit ? 22 : 14;
  ctx.shadowColor = color;
  ctx.lineWidth = bullet.crit ? 5 : bullet.echo ? 3 : 4;
  ctx.beginPath();
  ctx.moveTo(bullet.x - nx * length, bullet.y - ny * length);
  ctx.lineTo(bullet.x + nx * 4, bullet.y + ny * 4);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bullet.x - nx * length * 0.5, bullet.y - ny * length * 0.5);
  ctx.lineTo(bullet.x + nx * 5, bullet.y + ny * 5);
  ctx.stroke();
  ctx.restore();
}

function drawEnemyBullet(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(bullet.angle);
  ctx.globalCompositeOperation = 'lighter';
  const color = bullet.type === 'needle' ? '#a78cff' : bullet.type === 'ember' ? '#ffb14a' : '#ff4aac';
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff0fa';
  ctx.shadowBlur = 16;
  ctx.shadowColor = color;
  ctx.lineWidth = 1;
  if (bullet.type === 'needle') {
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-7, -2.5);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-7, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (bullet.type === 'ember') {
    ctx.beginPath();
    ctx.moveTo(0, -bullet.r * 1.6);
    ctx.quadraticCurveTo(bullet.r * 1.2, -bullet.r * 0.2, 0, bullet.r * 1.4);
    ctx.quadraticCurveTo(-bullet.r * 1.2, -bullet.r * 0.2, 0, -bullet.r * 1.6);
    ctx.fill();
    glowCircle(0, 0, bullet.r * 0.45, '#fff4bd', 12, 0.9);
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, bullet.r * 0.72, bullet.r * 1.35, 0.55, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPickup(pickup) {
  const bob = Math.sin(pickup.phase) * 2;
  const color = pickup.kind === 'heart' ? '#ff8ecf' : '#5bf5ff';
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bob);
  ctx.rotate(pickup.phase * 0.25);
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.fillStyle = pickup.kind === 'heart' ? 'rgba(255,100,170,.32)' : 'rgba(91,245,255,.25)';
  ctx.lineWidth = 1.4;
  if (pickup.kind === 'heart') {
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-12, -2, -7, -11, 0, -5);
    ctx.bezierCurveTo(7, -11, 12, -2, 0, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    polygonPath(4, 9, 4, Math.PI / 4);
    ctx.fill();
    ctx.stroke();
    glowCircle(0, 0, 2.5, '#ffffff', 8, 0.95);
  }
  ctx.restore();
}

function drawOrbital(orbital) {
  ctx.save();
  ctx.translate(orbital.x, orbital.y);
  ctx.rotate(orbital.angle + Math.PI / 2);
  ctx.shadowBlur = 14;
  ctx.shadowColor = '#ffd76a';
  ctx.fillStyle = 'rgba(255,215,106,.2)';
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(6, 5);
  ctx.lineTo(0, 2);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawParticle(particle) {
  const alpha = clamp(particle.life / particle.max, 0, 1);
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = particle.color;
  ctx.shadowBlur = particle.shape === 'ember' ? 10 : 5;
  ctx.shadowColor = particle.color;
  if (particle.shape === 'shard') {
    ctx.beginPath();
    ctx.moveTo(particle.r * 1.8, 0);
    ctx.lineTo(-particle.r, -particle.r * 0.45);
    ctx.lineTo(-particle.r * 0.3, particle.r * 0.7);
    ctx.closePath();
    ctx.fill();
  } else if (particle.shape === 'spark') {
    ctx.fillRect(-particle.r * 1.5, -0.6, particle.r * 3, 1.2);
  } else if (particle.shape === 'ember') {
    ctx.beginPath();
    ctx.arc(0, 0, particle.r, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillRect(-particle.r / 2, -particle.r / 2, particle.r, particle.r);
  }
  ctx.restore();
}

function render() {
  ctx.save();
  const shakeX = (Math.random() - 0.5) * game.shake;
  const shakeY = (Math.random() - 0.5) * game.shake;
  ctx.translate(shakeX, shakeY);
  drawBackground(game.time);

  // Isolate ring glow state so later objects do not inherit shadow/globalAlpha values.
  ctx.save();
  for (const ring of game.rings) {
    ctx.globalAlpha = clamp(ring.life, 0, 1);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width || 2;
    ctx.shadowBlur = 16;
    ctx.shadowColor = ring.color;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  drawEchoes();
  for (const pickup of game.pickups) drawPickup(pickup);
  for (const orbital of game.orbitals) drawOrbital(orbital);
  for (const bullet of game.bullets) drawPlayerBullet(bullet);
  for (const bullet of game.enemyBullets) drawEnemyBullet(bullet);
  for (const enemy of game.enemies) drawEnemy(enemy);
  drawPlayer();
  for (const particle of game.particles) drawParticle(particle);

  for (const text of game.texts) {
    ctx.save();
    ctx.globalAlpha = clamp(text.life / text.max, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = `900 ${text.size}px system-ui`;
    ctx.fillStyle = text.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = text.color;
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  }

  if (game.combo >= 3 && state === 'playing') {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `900 ${game.combo >= 15 ? 17 : 13}px system-ui`;
    ctx.fillStyle = game.combo >= 15 ? '#ffd76a' : '#ff9fe0';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#ff8edc';
    ctx.fillText(`${game.combo} CHAIN`, W / 2, H * 0.2);
    ctx.restore();
  }

  if (game.burstActive > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255,220,130,${game.burstActive * 0.08})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.restore();

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${game.flash * 0.42})`;
    ctx.fillRect(0, 0, W, H);
  }
}
