function glowCircle(x, y, radius, color, blur = 18, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawCloud(cloud) {
  ctx.save();
  ctx.globalAlpha = cloud.a;
  ctx.fillStyle = '#f5eaff';
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.s, cloud.s);
  ctx.beginPath();
  ctx.ellipse(0, 0, 80, 22, 0, 0, TAU);
  ctx.ellipse(-48, -7, 38, 19, 0, 0, TAU);
  ctx.ellipse(40, -10, 50, 25, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawBackground(time) {
  const cycle = (Math.sin(time * 0.032) + 1) / 2;
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, `hsl(${242 + cycle * 38} 58% ${8 + cycle * 4}%)`);
  gradient.addColorStop(0.54, `hsl(${270 + cycle * 35} 62% ${11 + cycle * 6}%)`);
  gradient.addColorStop(1, '#02030a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  const sunX = W * 0.75;
  const sunY = H * (0.18 + cycle * 0.06);
  const radial = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.55);
  radial.addColorStop(0, `rgba(255,116,198,${0.11 + cycle * 0.06})`);
  radial.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);
  glowCircle(sunX, sunY, 22 + cycle * 5, '#ff9fd8', 38, 0.18);

  for (const cloud of game.clouds) drawCloud(cloud);
  for (const star of game.stars) {
    ctx.globalAlpha = 0.14 + star.z * 0.62 * (0.5 + Math.sin(star.tw) * 0.5);
    ctx.fillStyle = '#e9fbff';
    if (star.z > 0.75) {
      ctx.fillRect(star.x - 1.5, star.y, 3, 0.8);
      ctx.fillRect(star.x, star.y - 1.5, 0.8, 3);
    } else {
      ctx.fillRect(star.x, star.y, star.z * 1.7, star.z * 1.7);
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(5,5,18,.68)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.84);
  for (let x = 0; x <= W; x += 20) {
    ctx.lineTo(x, H * 0.79 + Math.sin(x * 0.018 + 1.4) * 12 + Math.sin(x * 0.052) * 7);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();

  ctx.fillStyle = 'rgba(20,14,40,.72)';
  for (let x = 0; x < W; x += 24) {
    const height = 12 + ((x * 17) % 32);
    ctx.fillRect(x, H * 0.88 - height, 18, height + 40);
    if ((x / 24) % 3 === 0) {
      ctx.fillStyle = 'rgba(255,160,220,.18)';
      ctx.fillRect(x + 5, H * 0.88 - height + 7, 3, 4);
      ctx.fillStyle = 'rgba(20,14,40,.72)';
    }
  }

  if (game.overdrive > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const overdriveGlow = ctx.createRadialGradient(game.player.x, game.player.y, 10, game.player.x, game.player.y, Math.max(W, H) * 0.7);
    overdriveGlow.addColorStop(0, 'rgba(255,222,120,.12)');
    overdriveGlow.addColorStop(1, 'rgba(255,80,200,0)');
    ctx.fillStyle = overdriveGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawShip(x, y, angle, color, alpha = 1, scale = 1, echo = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = echo ? 15 : 22;
  ctx.shadowColor = color;

  const plume = 10 + Math.sin(game.time * 24 + x) * 3;
  const engineGradient = ctx.createLinearGradient(0, 10, 0, 10 + plume);
  engineGradient.addColorStop(0, echo ? 'rgba(100,230,255,.8)' : 'rgba(255,255,255,.95)');
  engineGradient.addColorStop(1, 'rgba(90,210,255,0)');
  ctx.fillStyle = engineGradient;
  ctx.beginPath();
  ctx.moveTo(-3, 8);
  ctx.lineTo(0, 12 + plume);
  ctx.lineTo(3, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = echo ? 'rgba(90,220,255,.18)' : 'rgba(34,20,68,.9)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(8, -2);
  ctx.lineTo(18, 8);
  ctx.lineTo(6, 6);
  ctx.lineTo(3, 14);
  ctx.lineTo(0, 10);
  ctx.lineTo(-3, 14);
  ctx.lineTo(-6, 6);
  ctx.lineTo(-18, 8);
  ctx.lineTo(-8, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f4ffff';
  ctx.beginPath();
  ctx.ellipse(0, -5, 3.5, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = echo ? color : '#ff7fda';
  ctx.beginPath();
  ctx.arc(0, 3, 2.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const player = game.player;
  for (let i = player.trail.length - 1; i >= 0; i--) {
    const trail = player.trail[i];
    const alpha = (1 - i / player.trail.length) * 0.18;
    drawShip(trail.x, trail.y, trail.angle, '#55f2ff', alpha, 0.45 + (1 - i / player.trail.length) * 0.2, true);
  }
  if (player.inv > 0 && ((player.inv * 12) | 0) % 2 === 0) return;
  drawShip(player.x, player.y, player.angle, game.overdrive > 0 ? '#ffd76a' : '#7ff9ff', 1, 1, false);

  if (game.upgrades.shield > 0) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(game.time * 5) * 0.08;
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffd76a';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 24, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEchoes() {
  for (const echo of game.echoes) {
    const alpha = Math.min(1, echo.age * 2) * Math.min(1, echo.life * 2) * 0.62;
    const color = `hsl(${echo.hue} 100% 72%)`;
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.beginPath();
    for (let i = 0; i < echo.points.length; i += 8) {
      const point = echo.points[i];
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();

    for (let i = echo.trail.length - 1; i >= 0; i--) {
      const point = echo.trail[i];
      drawShip(point.x, point.y, echo.angle, color, alpha * (1 - i / echo.trail.length) * 0.18, 0.5, true);
    }
    drawShip(echo.x, echo.y, echo.angle, color, alpha, 0.72, true);
  }
}

function polygonPath(sides, outerRadius, innerRadius = outerRadius, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides * 2; i++) {
    const angle = rotation + i * Math.PI / sides;
    const radius = i % 2 ? innerRadius : outerRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
