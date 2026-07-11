'use strict';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const $ = (selector) => document.querySelector(selector);
const ui = {
  menu: $('#menu'), help: $('#help'), upgrade: $('#upgrade'), pause: $('#pause'), over: $('#gameover'),
  hud: $('#hud'), score: $('#score'), wave: $('#wave'), echo: $('#echoCount'), life: $('#lifeCount'),
  burst: $('#burstBar'), burstPct: $('#burstPercent'), best: $('#bestLine'), toast: $('#toast'),
  status: $('#statusLine'), bossWrap: $('#bossWrap'), bossBar: $('#bossBar'), bossPct: $('#bossPercent')
};

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (array) => array[(Math.random() * array.length) | 0];
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* restricted storage */ }
  }
};

let W = 0;
let H = 0;
let DPR = 1;
let last = performance.now();
let state = 'menu';
let soundOn = storage.get('natsu-sound') !== 'off';
let best = Number(storage.get('natsu-best') || 0);
let audio = null;
let toastTimer = 0;

const game = {
  time: 0,
  score: 0,
  wave: 1,
  kills: 0,
  memory: 0,
  combo: 0,
  comboTimer: 0,
  hp: 3,
  maxHp: 3,
  burst: 0,
  burstActive: 0,
  overdrive: 0,
  shake: 0,
  flash: 0,
  spawnTimer: 0,
  waveTimer: 0,
  echoTimer: 0,
  levelTimer: 0,
  pathTimer: 0,
  dashCooldown: 0,
  bossSpawnedWave: 0,
  pointer: { down: false, x: 0, y: 0, sx: 0, sy: 0, started: 0 },
  lastTap: 0,
  path: [],
  echoes: [],
  enemies: [],
  bullets: [],
  enemyBullets: [],
  particles: [],
  pickups: [],
  rings: [],
  stars: [],
  clouds: [],
  texts: [],
  orbitals: [],
  upgrades: {},
  player: { x: 0, y: 0, tx: 0, ty: 0, r: 12, fire: 0, inv: 0, trail: [], angle: -Math.PI / 2 }
};

const upgrades = [
  { key: 'fireRate', name: 'ラムネの泡', desc: '攻撃速度が18%上がる', max: 6, icon: '◌' },
  { key: 'power', name: '夕立の匂い', desc: 'ショットの威力が25%上がる', max: 5, icon: '⚡' },
  { key: 'speed', name: '自転車の帰り道', desc: '移動の追従速度が15%上がる', max: 5, icon: '➤' },
  { key: 'magnet', name: '祭りの引力', desc: '記憶を引き寄せる範囲が広がる', max: 5, icon: '✦' },
  { key: 'echoPower', name: '遠い花火', desc: '残響機の攻撃力が30%上がる', max: 5, icon: '♢' },
  { key: 'shield', name: '麦わらシールド', desc: '1回だけダメージを無効化する', max: 3, icon: '⬡' },
  { key: 'pierce', name: '入道雲を貫く', desc: '弾がさらに1体を貫通する', max: 3, icon: '⇢' },
  { key: 'multiShot', name: '線香花火の枝', desc: '同時発射数が増える', max: 3, icon: '⋔' },
  { key: 'orbit', name: '金魚すくいの衛星', desc: '周囲を回る攻撃衛星が増える', max: 3, icon: '◉' },
  { key: 'critical', name: '真昼の蜃気楼', desc: 'クリティカル率が上がる', max: 4, icon: '✧' }
];

function defaultUpgrades() {
  return {
    fireRate: 1,
    power: 1,
    speed: 1,
    magnet: 1,
    echoPower: 1,
    shield: 0,
    pierce: 0,
    multiShot: 0,
    orbit: 0,
    critical: 0
  };
}

class Synth {
  constructor() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.15;
    this.master.connect(this.ctx.destination);
    this.musicTimer = 0;
  }

  tone(freq, duration = 0.08, type = 'sine', volume = 0.18, slide = 0) {
    if (!soundOn || this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, t);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
  }

  noise(duration = 0.12, volume = 0.06) {
    if (!soundOn || this.ctx.state === 'suspended') return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  tick(dt) {
    if (!soundOn || state !== 'playing') return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = game.overdrive > 0 ? 0.24 : 0.48;
    const scale = [220, 261.63, 329.63, 392, 493.88, 587.33];
    const note = scale[(game.wave + ((game.time * 2) | 0)) % scale.length];
    this.tone(note / 2, 0.28, 'triangle', 0.03, 2);
    if (game.combo > 8 || game.overdrive > 0) this.tone(note * 2, 0.07, 'sine', 0.022, 18);
  }
}

function ensureAudio() {
  try {
    if (!audio) audio = new Synth();
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
  } catch (_) {
    audio = null;
  }
}

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!game.player.x) {
    game.player.x = game.player.tx = W / 2;
    game.player.y = game.player.ty = H * 0.68;
  }
  makeSky();
}

function makeSky() {
  const count = Math.floor((W * H) / 7200);
  game.stars = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    z: rand(0.25, 1),
    tw: Math.random() * TAU
  }));
  game.clouds = Array.from({ length: Math.max(3, Math.floor(W / 180)) }, () => ({
    x: rand(-W, W),
    y: rand(H * 0.12, H * 0.52),
    s: rand(0.45, 1.2),
    v: rand(2, 7),
    a: rand(0.015, 0.055)
  }));
}

function showPanel(panel) {
  document.querySelectorAll('.panel').forEach((item) => item.classList.remove('visible'));
  if (panel) panel.classList.add('visible');
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1450);
}

function floatingText(x, y, text, color = '#fff', size = 13) {
  game.texts.push({ x, y, text, color, size, life: 0.85, max: 0.85, vy: -28 });
}

function reset() {
  Object.assign(game, {
    time: 0,
    score: 0,
    wave: 1,
    kills: 0,
    memory: 0,
    combo: 0,
    comboTimer: 0,
    hp: 3,
    maxHp: 3,
    burst: 0,
    burstActive: 0,
    overdrive: 0,
    shake: 0,
    flash: 0,
    spawnTimer: 0.5,
    waveTimer: 0,
    echoTimer: 0,
    levelTimer: 0,
    pathTimer: 0,
    dashCooldown: 0,
    bossSpawnedWave: 0,
    path: [],
    echoes: [],
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    pickups: [],
    rings: [],
    texts: [],
    orbitals: []
  });
  game.upgrades = defaultUpgrades();
  Object.assign(game.player, {
    x: W / 2,
    y: H * 0.68,
    tx: W / 2,
    ty: H * 0.68,
    r: 12,
    fire: 0,
    inv: 0,
    trail: [],
    angle: -Math.PI / 2
  });
}

function startGame() {
  ensureAudio();
  reset();
  state = 'playing';
  last = performance.now();
  showPanel(null);
  ui.hud.classList.remove('hidden');
  audio?.tone(220, 0.25, 'sine', 0.15, 440);
  toast('指で夏を導いて');
  updateHud();
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  showPanel(ui.pause);
}

function resumeGame() {
  state = 'playing';
  showPanel(null);
  last = performance.now();
}

function goTitle() {
  state = 'menu';
  ui.hud.classList.add('hidden');
  showPanel(ui.menu);
  updateBest();
}

function gameOver() {
  state = 'over';
  ui.hud.classList.add('hidden');
  const isBest = game.score > best;
  if (isBest) {
    best = Math.floor(game.score);
    storage.set('natsu-best', String(best));
  }
  $('#finalScore').textContent = Math.floor(game.score).toLocaleString();
  $('#finalWave').textContent = game.wave;
  $('#finalEcho').textContent = Math.min(3, game.echoes.length);
  $('#finalMemory').textContent = game.memory;
  $('#newBest').classList.toggle('hidden', !isBest);
  showPanel(ui.over);
  audio?.tone(180, 0.8, 'sawtooth', 0.08, -120);
  if (navigator.vibrate) navigator.vibrate([30, 60, 80]);
}

function updateBest() {
  ui.best.textContent = `BEST ${best.toLocaleString()}`;
  $('#soundBtn').textContent = `音：${soundOn ? 'ON' : 'OFF'}`;
}

function createEcho() {
  if (game.path.length < 20) return;
  const points = game.path.slice(-480).map((point) => ({ x: point.x, y: point.y }));
  game.echoes.push({
    points,
    age: 0,
    life: 26,
    idx: 0,
    x: points[0].x,
    y: points[0].y,
    fire: 0,
    hue: 185 + game.echoes.length * 36,
    angle: 0,
    trail: []
  });
  if (game.echoes.length > 3) game.echoes.shift();
  game.path.length = 0;
  burstParticles(game.player.x, game.player.y, '#5bf5ff', 34, 3.2, 'spark');
  game.rings.push({ x: game.player.x, y: game.player.y, r: 10, max: 120, life: 1, color: '#5bf5ff', width: 2 });
  audio?.tone(330, 0.42, 'triangle', 0.13, 330);
  toast(`残響機 ${game.echoes.length}/3 起動`);
  if (navigator.vibrate) navigator.vibrate(18);
}
