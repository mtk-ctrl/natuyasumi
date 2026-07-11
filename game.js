(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (s) => document.querySelector(s);
  const ui = {
    menu: $('#menu'), help: $('#help'), upgrade: $('#upgrade'), pause: $('#pause'), over: $('#gameover'),
    hud: $('#hud'), score: $('#score'), wave: $('#wave'), echo: $('#echoCount'), burst: $('#burstBar'),
    burstPct: $('#burstPercent'), best: $('#bestLine'), toast: $('#toast')
  };

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  let W = 0, H = 0, DPR = 1, last = performance.now();
  let state = 'menu';
  let soundOn = localStorage.getItem('natsu-sound') !== 'off';
  let best = Number(localStorage.getItem('natsu-best') || 0);
  let audio = null;
  let toastTimer = 0;

  const game = {
    time: 0, score: 0, wave: 1, kills: 0, memory: 0, combo: 0, comboTimer: 0,
    hp: 3, maxHp: 3, burst: 0, burstActive: 0, shake: 0, flash: 0,
    spawnTimer: 0, waveTimer: 0, echoTimer: 0, levelTimer: 0,
    pointer: { x: 0, y: 0, down: false }, lastTap: 0,
    path: [], echoes: [], enemies: [], bullets: [], enemyBullets: [], particles: [], pickups: [], rings: [], stars: [],
    upgrades: { fireRate: 1, power: 1, speed: 1, magnet: 1, echoPower: 1, shield: 0, pierce: 0 },
    player: { x: 0, y: 0, tx: 0, ty: 0, r: 10, fire: 0, inv: 0, trail: [] }
  };

  const upgrades = [
    { key: 'fireRate', name: 'ラムネの泡', desc: '攻撃速度が18%上がる', max: 6 },
    { key: 'power', name: '夕立の匂い', desc: 'ショットの威力が25%上がる', max: 5 },
    { key: 'speed', name: '自転車の帰り道', desc: '移動の追従速度が15%上がる', max: 5 },
    { key: 'magnet', name: '祭りの引力', desc: '記憶を引き寄せる範囲が広がる', max: 5 },
    { key: 'echoPower', name: '遠い花火', desc: '残響の攻撃力が30%上がる', max: 5 },
    { key: 'shield', name: '麦わら帽子', desc: '1回だけダメージを無効化する', max: 3 },
    { key: 'pierce', name: '入道雲を貫く', desc: '弾がさらに1体を貫通する', max: 3 }
  ];

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!game.player.x) {
      game.player.x = game.player.tx = W / 2;
      game.player.y = game.player.ty = H * .68;
    }
    makeStars();
  }

  function makeStars() {
    const count = Math.floor((W * H) / 8500);
    game.stars = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H, z: rand(.2, 1), tw: Math.random() * TAU
    }));
  }

  class Synth {
    constructor() {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = .16;
      this.master.connect(this.ctx.destination);
      this.musicTimer = 0;
    }
    tone(freq, duration = .08, type = 'sine', volume = .18, slide = 0) {
      if (!soundOn || this.ctx.state === 'suspended') return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(volume, t + .008);
      g.gain.exponentialRampToValueAtTime(.0001, t + duration);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + duration + .02);
    }
    noise(duration = .12, volume = .06) {
      if (!soundOn || this.ctx.state === 'suspended') return;
      const len = this.ctx.sampleRate * duration;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const s = this.ctx.createBufferSource(); const g = this.ctx.createGain();
      s.buffer = b; g.gain.setValueAtTime(volume, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, this.ctx.currentTime + duration);
      s.connect(g); g.connect(this.master); s.start();
    }
    tick(dt) {
      if (!soundOn || state !== 'playing') return;
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        this.musicTimer = .48;
        const scale = [220, 261.63, 329.63, 392, 493.88];
        const n = scale[(game.wave + ((game.time * 2) | 0)) % scale.length];
        this.tone(n / 2, .28, 'triangle', .035, 2);
        if (game.combo > 8) this.tone(n * 2, .07, 'sine', .025, 18);
      }
    }
  }

  function ensureAudio() {
    if (!audio) audio = new Synth();
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
  }

  function showPanel(panel) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('visible'));
    if (panel) panel.classList.add('visible');
  }

  function toast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1400);
  }

  function reset() {
    Object.assign(game, {
      time: 0, score: 0, wave: 1, kills: 0, memory: 0, combo: 0, comboTimer: 0,
      hp: 3, maxHp: 3, burst: 0, burstActive: 0, shake: 0, flash: 0,
      spawnTimer: .5, waveTimer: 0, echoTimer: 0, levelTimer: 0,
      path: [], echoes: [], enemies: [], bullets: [], enemyBullets: [], particles: [], pickups: [], rings: []
    });
    game.upgrades = { fireRate: 1, power: 1, speed: 1, magnet: 1, echoPower: 1, shield: 0, pierce: 0 };
    Object.assign(game.player, {
      x: W / 2, y: H * .68, tx: W / 2, ty: H * .68, fire: 0, inv: 0, trail: []
    });
  }

  function startGame() {
    ensureAudio(); reset(); state = 'playing';
    showPanel(null); ui.hud.classList.remove('hidden');
    audio?.tone(220, .25, 'sine', .15, 440);
    toast('指で光を導いて');
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused'; showPanel(ui.pause);
  }

  function resumeGame() {
    state = 'playing'; showPanel(null); last = performance.now();
  }

  function goTitle() {
    state = 'menu'; ui.hud.classList.add('hidden'); showPanel(ui.menu); updateBest();
  }

  function gameOver() {
    state = 'over'; ui.hud.classList.add('hidden');
    const isBest = game.score > best;
    if (isBest) { best = game.score; localStorage.setItem('natsu-best', String(best)); }
    $('#finalScore').textContent = Math.floor(game.score).toLocaleString();
    $('#finalWave').textContent = game.wave;
    $('#finalEcho').textContent = Math.min(3, game.echoes.length);
    $('#finalMemory').textContent = game.memory;
    $('#newBest').classList.toggle('hidden', !isBest);
    showPanel(ui.over);
    audio?.tone(180, .8, 'sawtooth', .08, -120);
    if (navigator.vibrate) navigator.vibrate([30, 60, 80]);
  }

  function updateBest() {
    ui.best.textContent = `BEST ${best.toLocaleString()}`;
    $('#soundBtn').textContent = `音：${soundOn ? 'ON' : 'OFF'}`;
  }

  function createEcho() {
    if (game.path.length < 20) return;
    const points = game.path.slice(-Math.min(game.path.length, 480)).map(p => ({ ...p }));
    game.echoes.push({ points, age: 0, life: 24, idx: 0, x: points[0].x, y: points[0].y, fire: 0, hue: 185 + game.echoes.length * 35 });
    if (game.echoes.length > 3) game.echoes.shift();
    game.path.length = 0;
    burstParticles(game.player.x, game.player.y, '#5bf5ff', 28, 2.8);
    game.rings.push({ x: game.player.x, y: game.player.y, r: 10, max: 100, life: 1, color: '#5bf5ff' });
    audio?.tone(330, .42, 'triangle', .13, 330);
    toast(`残響 ${game.echoes.length}/3 誕生`);
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function spawnEnemy() {
    const margin = 30;
    const edge = (Math.random() * 3) | 0;
    let x, y;
    if (edge === 0) { x = rand(margin, W - margin); y = -30; }
    else if (edge === 1) { x = -30; y = rand(H * .12, H * .66); }
    else { x = W + 30; y = rand(H * .12, H * .66); }
    const roll = Math.random();
    const type = roll < Math.min(.2 + game.wave * .012, .42) ? 'spinner' : roll < .72 ? 'chaser' : 'tank';
    const data = type === 'chaser'
      ? { r: 11, hp: 2 + game.wave * .28, speed: rand(32, 48), value: 100 }
      : type === 'spinner'
        ? { r: 14, hp: 4 + game.wave * .4, speed: rand(18, 28), value: 180 }
        : { r: 19, hp: 8 + game.wave * .75, speed: rand(12, 20), value: 260 };
    game.enemies.push({ x, y, type, angle: Math.random() * TAU, fire: rand(.5, 1.5), phase: Math.random() * TAU, hit: 0, ...data, maxHp: data.hp });
  }

  function nearestEnemy(x, y) {
    let bestEnemy = null, bd = Infinity;
    for (const e of game.enemies) {
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; bestEnemy = e; }
    }
    return bestEnemy;
  }

  function shoot(x, y, power = 1, echo = false) {
    const e = nearestEnemy(x, y);
    if (!e) return;
    const a = Math.atan2(e.y - y, e.x - x);
    const speed = echo ? 390 : 450;
    game.bullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: echo ? 3.2 : 3.8, life: 1.4, power, echo, pierce: game.upgrades.pierce });
    if (!echo) audio?.tone(620 + Math.random() * 70, .045, 'square', .035, 60);
  }

  function enemyShoot(e) {
    const a = Math.atan2(game.player.y - e.y, game.player.x - e.x);
    const count = e.type === 'spinner' ? 5 : 1;
    for (let i = 0; i < count; i++) {
      const ang = count === 1 ? a : e.angle + i * TAU / count;
      const s = e.type === 'tank' ? 115 : 145;
      game.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, r: e.type === 'tank' ? 6 : 4, life: 5 });
    }
    audio?.tone(90, .08, 'sawtooth', .018, -20);
  }

  function burstParticles(x, y, color, count, speed = 2) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, s = rand(.3, speed);
      game.particles.push({ x, y, vx: Math.cos(a) * s * 60, vy: Math.sin(a) * s * 60, life: rand(.25, .8), max: 1, r: rand(1, 3.5), color });
    }
  }

  function killEnemy(e) {
    const i = game.enemies.indexOf(e);
    if (i < 0) return;
    game.enemies.splice(i, 1);
    game.kills++; game.combo++; game.comboTimer = 2.2;
    const mult = 1 + Math.min(game.combo, 20) * .05;
    game.score += Math.floor(e.value * mult);
    game.burst = clamp(game.burst + (e.type === 'tank' ? 8 : 3), 0, 100);
    burstParticles(e.x, e.y, e.type === 'tank' ? '#ffd76a' : '#ff61d8', e.type === 'tank' ? 34 : 17, 3.2);
    game.rings.push({ x: e.x, y: e.y, r: 4, max: e.r * 3.5, life: .5, color: '#ff61d8' });
    if (Math.random() < .28 || e.type === 'tank') game.pickups.push({ x: e.x, y: e.y, vx: rand(-30,30), vy: rand(-25,25), r: 6, life: 10, phase: Math.random() * TAU });
    audio?.tone(e.type === 'tank' ? 120 : 180, .13, 'triangle', .06, 120);
  }

  function hitPlayer() {
    if (game.player.inv > 0 || game.burstActive > 0) return;
    if (game.upgrades.shield > 0) {
      game.upgrades.shield--;
      game.player.inv = 1.4;
      game.rings.push({ x: game.player.x, y: game.player.y, r: 8, max: 80, life: .8, color: '#ffd76a' });
      toast('麦わら帽子が守った');
      return;
    }
    game.hp--; game.player.inv = 1.8; game.shake = 18; game.flash = .35; game.combo = 0;
    burstParticles(game.player.x, game.player.y, '#ffffff', 32, 4);
    audio?.noise(.2, .1); audio?.tone(110, .3, 'sawtooth', .12, -70);
    if (navigator.vibrate) navigator.vibrate(35);
    if (game.hp <= 0) gameOver();
  }

  function activateBurst() {
    if (state !== 'playing' || game.burst < 100) return;
    game.burst = 0; game.burstActive = 1.5; game.shake = 12; game.flash = .7;
    game.enemyBullets.length = 0;
    game.rings.push({ x: game.player.x, y: game.player.y, r: 8, max: Math.max(W,H) * 1.1, life: 1.1, color: '#ffd76a' });
    for (const e of [...game.enemies]) {
      e.hp -= 7 * game.upgrades.power;
      if (e.hp <= 0) killEnemy(e);
    }
    burstParticles(game.player.x, game.player.y, '#ffd76a', 100, 7);
    audio?.tone(110, 1.0, 'sine', .18, 770); audio?.noise(.55, .08);
    toast('SUMMER BURST');
    if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
  }

  function showUpgrade() {
    state = 'upgrade';
    const available = upgrades.filter(u => game.upgrades[u.key] < u.max);
    const choices = [];
    while (choices.length < Math.min(3, available.length)) {
      const u = pick(available);
      if (!choices.includes(u)) choices.push(u);
    }
    const grid = $('#upgradeChoices'); grid.innerHTML = '';
    choices.forEach(u => {
      const b = document.createElement('button'); b.className = 'upgrade-card';
      b.innerHTML = `<em>Lv.${game.upgrades[u.key]} → ${game.upgrades[u.key] + 1}</em><b>${u.name}</b><span>${u.desc}</span>`;
      b.onclick = () => {
        game.upgrades[u.key]++;
        state = 'playing'; showPanel(null); last = performance.now();
        audio?.tone(440, .35, 'triangle', .12, 440);
        toast(`${u.name} を思い出した`);
      };
      grid.appendChild(b);
    });
    showPanel(ui.upgrade);
  }

  function update(dt) {
    if (state !== 'playing') return;
    game.time += dt; game.waveTimer += dt; game.echoTimer += dt; game.levelTimer += dt;
    game.player.inv = Math.max(0, game.player.inv - dt);
    game.burstActive = Math.max(0, game.burstActive - dt);
    game.flash = Math.max(0, game.flash - dt); game.shake *= Math.pow(.001, dt);
    if (game.comboTimer > 0) game.comboTimer -= dt; else game.combo = 0;

    if (game.waveTimer >= 18) {
      game.waveTimer -= 18; game.wave++;
      toast(`WAVE ${game.wave}`); audio?.tone(260, .5, 'triangle', .1, 520);
    }
    if (game.echoTimer >= 8) { game.echoTimer -= 8; createEcho(); }
    if (game.levelTimer >= 30) { game.levelTimer -= 30; showUpgrade(); return; }

    const p = game.player;
    const follow = 1 - Math.pow(.0008, dt * game.upgrades.speed);
    p.x = lerp(p.x, clamp(p.tx, 22, W - 22), follow);
    p.y = lerp(p.y, clamp(p.ty, 90, H - 75), follow);
    p.trail.unshift({ x: p.x, y: p.y, life: 1 });
    if (p.trail.length > 28) p.trail.pop();
    game.path.push({ x: p.x, y: p.y });
    if (game.path.length > 520) game.path.shift();

    p.fire -= dt;
    if (p.fire <= 0 && game.enemies.length) {
      p.fire = .23 / game.upgrades.fireRate;
      shoot(p.x, p.y, game.upgrades.power, false);
    }

    for (let ei = game.echoes.length - 1; ei >= 0; ei--) {
      const e = game.echoes[ei]; e.age += dt; e.life -= dt;
      e.idx = (e.idx + dt * 60) % e.points.length;
      const pos = e.points[e.idx | 0]; e.x = pos.x; e.y = pos.y;
      e.fire -= dt;
      if (e.fire <= 0 && game.enemies.length) {
        e.fire = .38 / game.upgrades.fireRate;
        shoot(e.x, e.y, .62 * game.upgrades.echoPower * game.upgrades.power, true);
      }
      if (e.life <= 0) game.echoes.splice(ei, 1);
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      game.spawnTimer = Math.max(.28, 1.05 - game.wave * .045) * rand(.72, 1.18);
      spawnEnemy();
      if (game.wave > 4 && Math.random() < .14) spawnEnemy();
    }

    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      e.phase += dt * 2; e.hit = Math.max(0, e.hit - dt * 4);
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.type === 'spinner') {
        e.angle += dt * 1.8;
        e.x += Math.cos(a + Math.sin(e.phase) * .65) * e.speed * dt;
        e.y += Math.sin(a + Math.sin(e.phase) * .65) * e.speed * dt;
      } else {
        e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
      }
      e.fire -= dt;
      if (e.fire <= 0 && e.y > 35) {
        e.fire = e.type === 'spinner' ? 1.45 : e.type === 'tank' ? 2.1 : rand(2.2, 3.1);
        if (e.type !== 'chaser' || game.wave > 3) enemyShoot(e);
      }
      if (dist2(e, p) < (e.r + p.r) ** 2) { game.enemies.splice(i,1); hitPlayer(); }
    }

    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) { game.bullets.splice(i,1); continue; }
      for (const e of [...game.enemies]) {
        if (dist2(b,e) < (b.r + e.r) ** 2) {
          e.hp -= b.power; e.hit = 1;
          burstParticles(b.x,b.y,b.echo?'#79dfff':'#ffffff',3,1.2);
          if (e.hp <= 0) killEnemy(e);
          if (b.pierce > 0) b.pierce--; else { game.bullets.splice(i,1); break; }
        }
      }
    }

    for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
      const b = game.enemyBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) { game.enemyBullets.splice(i,1); continue; }
      if (dist2(b,p) < (b.r + p.r) ** 2) { game.enemyBullets.splice(i,1); hitPlayer(); }
    }

    for (let i = game.pickups.length - 1; i >= 0; i--) {
      const m = game.pickups[i]; m.life -= dt; m.phase += dt * 4;
      const d = Math.sqrt(dist2(m,p));
      const range = 70 + game.upgrades.magnet * 30;
      if (d < range) {
        const a = Math.atan2(p.y-m.y,p.x-m.x), pull = (1 - d/range) * 650;
        m.vx += Math.cos(a)*pull*dt; m.vy += Math.sin(a)*pull*dt;
      }
      m.vx *= Math.pow(.08,dt); m.vy *= Math.pow(.08,dt); m.x += m.vx*dt; m.y += m.vy*dt;
      if (d < p.r + m.r + 4) {
        game.pickups.splice(i,1); game.memory++; game.score += 75; game.burst = clamp(game.burst + 12,0,100);
        audio?.tone(700 + game.memory % 4 * 90,.12,'sine',.08,90);
        burstParticles(m.x,m.y,'#5bf5ff',12,2);
      } else if (m.life <= 0) game.pickups.splice(i,1);
    }

    for (let i = game.particles.length - 1; i >= 0; i--) {
      const q = game.particles[i]; q.life -= dt; q.x += q.vx*dt; q.y += q.vy*dt; q.vx *= Math.pow(.08,dt); q.vy *= Math.pow(.08,dt);
      if (q.life <= 0) game.particles.splice(i,1);
    }
    for (let i = game.rings.length - 1; i >= 0; i--) { const r=game.rings[i]; r.life -= dt; r.r = lerp(r.r,r.max,1-Math.pow(.02,dt)); if(r.life<=0)game.rings.splice(i,1); }
    for (const s of game.stars) { s.y += (8 + s.z * 14) * dt; s.tw += dt*(1+s.z); if (s.y > H) { s.y=-2; s.x=Math.random()*W; } }

    audio?.tick(dt);
    updateHud();
  }

  function updateHud() {
    ui.score.textContent = Math.floor(game.score).toLocaleString();
    ui.wave.textContent = game.wave;
    ui.echo.textContent = `${game.echoes.length}/3`;
    ui.burst.style.width = `${game.burst}%`;
    ui.burstPct.textContent = `${Math.floor(game.burst)}%`;
  }

  function glowCircle(x,y,r,color,blur=18,alpha=1) {
    ctx.save(); ctx.globalAlpha=alpha; ctx.shadowBlur=blur; ctx.shadowColor=color; ctx.fillStyle=color;
    ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); ctx.restore();
  }

  function drawBackground(t) {
    const cycle = (Math.sin(t*.035)+1)/2;
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, `hsl(${245+cycle*35} 55% ${8+cycle*3}%)`);
    g.addColorStop(.55, `hsl(${255+cycle*45} 62% ${10+cycle*5}%)`);
    g.addColorStop(1, '#03040b');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    const sunY = H*(.17+cycle*.07);
    const rg=ctx.createRadialGradient(W*.74,sunY,0,W*.74,sunY,W*.6);
    rg.addColorStop(0,`rgba(255,100,190,${.08+cycle*.05})`); rg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rg;ctx.fillRect(0,0,W,H);
    for(const s of game.stars){ctx.globalAlpha=.15+s.z*.55*(.5+Math.sin(s.tw)*.5);ctx.fillStyle='#dff9ff';ctx.fillRect(s.x,s.y,s.z*1.6,s.z*1.6);}ctx.globalAlpha=1;
    ctx.fillStyle='rgba(3,4,12,.65)';
    ctx.beginPath(); ctx.moveTo(0,H*.82);
    for(let x=0;x<=W;x+=24) ctx.lineTo(x,H*.80+Math.sin(x*.018+1.4)*10+Math.sin(x*.051)*6);
    ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
  }

  function drawPlayer() {
    const p=game.player;
    for(let i=p.trail.length-1;i>=0;i--){const q=p.trail[i],a=(1-i/p.trail.length)*.23;glowCircle(q.x,q.y,Math.max(1,5-i*.1),'#69f6ff',8,a);}
    if (p.inv>0 && ((p.inv*12)|0)%2===0) return;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(game.time*1.4);
    ctx.strokeStyle='#bdfbff';ctx.lineWidth=1.5;ctx.shadowBlur=18;ctx.shadowColor='#5bf5ff';
    ctx.beginPath(); for(let i=0;i<4;i++){const a=i*TAU/4;ctx.moveTo(Math.cos(a)*7,Math.sin(a)*7);ctx.lineTo(Math.cos(a+.35)*15,Math.sin(a+.35)*15);}ctx.stroke();ctx.restore();
    glowCircle(p.x,p.y,6,'#f5ffff',22,1); glowCircle(p.x,p.y,11,'#5bf5ff',22,.24);
    for(let i=0;i<game.hp;i++){const a=-Math.PI/2+(i-(game.maxHp-1)/2)*.35;glowCircle(p.x+Math.cos(a)*22,p.y+Math.sin(a)*22,2.2,'#ff7cde',7,.9);}
  }

  function drawEchoes() {
    for(const e of game.echoes){
      ctx.save();ctx.globalAlpha=Math.min(1,e.age*2)*Math.min(1,e.life*2)*.58;
      ctx.strokeStyle=`hsl(${e.hue} 100% 72%)`;ctx.lineWidth=1;ctx.shadowBlur=14;ctx.shadowColor=ctx.strokeStyle;
      ctx.beginPath();
      for(let i=0;i<e.points.length;i+=10){const q=e.points[i];if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);}ctx.stroke();
      glowCircle(e.x,e.y,5,ctx.strokeStyle,16,.9);ctx.restore();
    }
  }

  function drawEnemy(e) {
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle+game.time*(e.type==='spinner'?1.4:.35));
    const color=e.hit>0?'#ffffff':e.type==='tank'?'#ffcf68':'#ff59c8';
    ctx.strokeStyle=color;ctx.fillStyle='rgba(255,55,170,.08)';ctx.lineWidth=e.type==='tank'?2:1.4;ctx.shadowBlur=14;ctx.shadowColor=color;
    ctx.beginPath();
    const sides=e.type==='tank'?6:e.type==='spinner'?4:3;
    for(let i=0;i<=sides;i++){const a=i*TAU/sides;const rr=e.r*(i%2?0.78:1);const x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.restore();
    if(e.type==='tank'){ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(e.x-e.r,e.y+e.r+6,e.r*2,3);ctx.fillStyle='#ffd76a';ctx.fillRect(e.x-e.r,e.y+e.r+6,e.r*2*(e.hp/e.maxHp),3);}
  }

  function render() {
    ctx.save();
    const sx=(Math.random()-.5)*game.shake,sy=(Math.random()-.5)*game.shake;ctx.translate(sx,sy);
    drawBackground(game.time);
    for(const r of game.rings){ctx.globalAlpha=clamp(r.life,0,1);ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.shadowBlur=16;ctx.shadowColor=r.color;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,TAU);ctx.stroke();}ctx.globalAlpha=1;
    drawEchoes();
    for(const m of game.pickups){glowCircle(m.x,m.y,3+Math.sin(m.phase)*1.5,'#5bf5ff',14,.95);ctx.strokeStyle='rgba(91,245,255,.35)';ctx.beginPath();ctx.arc(m.x,m.y,9+Math.sin(m.phase)*2,0,TAU);ctx.stroke();}
    for(const b of game.bullets)glowCircle(b.x,b.y,b.r,b.echo?'#5bdcff':'#ffffff',10,1);
    for(const b of game.enemyBullets){glowCircle(b.x,b.y,b.r,'#ff4aac',13,.9);ctx.strokeStyle='rgba(255,170,225,.35)';ctx.beginPath();ctx.arc(b.x,b.y,b.r+4,0,TAU);ctx.stroke();}
    for(const e of game.enemies)drawEnemy(e);
    drawPlayer();
    for(const p of game.particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x-p.r/2,p.y-p.r/2,p.r,p.r);}ctx.globalAlpha=1;
    if(game.combo>=3&&state==='playing'){ctx.textAlign='center';ctx.font='900 13px system-ui';ctx.fillStyle='#ffd76a';ctx.shadowBlur=12;ctx.shadowColor='#ff8edc';ctx.fillText(`${game.combo} CHAIN`,W/2,H*.20);}
    if(game.burstActive>0){ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(255,220,130,${game.burstActive*.08})`;ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation='source-over';}
    ctx.restore();
    if(game.flash>0){ctx.fillStyle=`rgba(255,255,255,${game.flash*.42})`;ctx.fillRect(0,0,W,H);}
  }

  function loop(now) {
    const dt=Math.min(.033,(now-last)/1000||0);last=now;
    update(dt);render();requestAnimationFrame(loop);
  }

  function pointerPos(e){const r=canvas.getBoundingClientRect();const p=e.touches?e.touches[0]:e;return{x:p.clientX-r.left,y:p.clientY-r.top};}
  function onDown(e){
    if(state!=='playing')return;e.preventDefault();ensureAudio();const p=pointerPos(e);game.pointer.down=true;game.pointer.x=p.x;game.pointer.y=p.y;game.player.tx=p.x;game.player.ty=p.y;
    const now=performance.now();if(now-game.lastTap<300)activateBurst();game.lastTap=now;
  }
  function onMove(e){if(state!=='playing'||!game.pointer.down)return;e.preventDefault();const p=pointerPos(e);game.player.tx=p.x;game.player.ty=p.y;}
  function onUp(){game.pointer.down=false;}
  canvas.addEventListener('pointerdown',onDown,{passive:false});canvas.addEventListener('pointermove',onMove,{passive:false});canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onUp);

  $('#startBtn').onclick=startGame;
  $('#retryBtn').onclick=startGame;
  $('#helpBtn').onclick=()=>showPanel(ui.help);
  $('#helpClose').onclick=()=>showPanel(ui.menu);
  $('#pauseBtn').onclick=pauseGame;
  $('#resumeBtn').onclick=resumeGame;
  $('#quitBtn').onclick=goTitle;
  $('#titleBtn').onclick=goTitle;
  $('#soundBtn').onclick=()=>{soundOn=!soundOn;localStorage.setItem('natsu-sound',soundOn?'on':'off');ensureAudio();updateBest();audio?.tone(440,.15,'sine',.08,80);};
  $('#shareBtn').onclick=async()=>{
    const text=`NATSU//ECHOで ${Math.floor(game.score).toLocaleString()}点、WAVE ${game.wave}まで夏を生き延びた。あなたの8秒前が味方になるゲーム。`;
    try{if(navigator.share)await navigator.share({title:'NATSU//ECHO',text,url:location.href});else{await navigator.clipboard.writeText(`${text} ${location.href}`);toast('結果をコピーしました');}}catch(_){ }
  };
  addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pauseGame();});
  addEventListener('keydown',e=>{if(e.key==='Escape'){if(state==='playing')pauseGame();else if(state==='paused')resumeGame();}if(e.code==='Space')activateBurst();});

  resize(); updateBest(); render(); loop(performance.now());
  if('serviceWorker'in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();