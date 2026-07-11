function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onDown(event) {
  if (state !== 'playing') return;
  event.preventDefault();
  ensureAudio();
  const point = pointerPosition(event);
  game.pointer.down = true;
  game.pointer.x = point.x;
  game.pointer.y = point.y;
  game.pointer.sx = point.x;
  game.pointer.sy = point.y;
  game.pointer.started = performance.now();
  game.player.tx = point.x;
  game.player.ty = point.y;
  const now = performance.now();
  if (now - game.lastTap < 300) activateBurst();
  game.lastTap = now;
}

function onMove(event) {
  if (state !== 'playing' || !game.pointer.down) return;
  event.preventDefault();
  const point = pointerPosition(event);
  game.pointer.x = point.x;
  game.pointer.y = point.y;
  game.player.tx = point.x;
  game.player.ty = point.y;
}

function onUp(event) {
  if (!game.pointer.down) return;
  const point = event && typeof event.clientX === 'number' ? pointerPosition(event) : { x: game.pointer.x, y: game.pointer.y };
  const elapsed = performance.now() - game.pointer.started;
  const distance = Math.hypot(point.x - game.pointer.sx, point.y - game.pointer.sy);
  game.pointer.down = false;
  if (elapsed < 240 && distance > 70) dashTo(point.x, point.y);
}

canvas.addEventListener('pointerdown', onDown, { passive: false });
canvas.addEventListener('pointermove', onMove, { passive: false });
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);

$('#startBtn').onclick = startGame;
$('#retryBtn').onclick = startGame;
$('#helpBtn').onclick = () => showPanel(ui.help);
$('#helpClose').onclick = () => showPanel(ui.menu);
$('#pauseBtn').onclick = pauseGame;
$('#resumeBtn').onclick = resumeGame;
$('#quitBtn').onclick = goTitle;
$('#titleBtn').onclick = goTitle;
$('#soundBtn').onclick = () => {
  soundOn = !soundOn;
  storage.set('natsu-sound', soundOn ? 'on' : 'off');
  ensureAudio();
  updateBest();
  audio?.tone(440, 0.15, 'sine', 0.08, 80);
};
$('#shareBtn').onclick = async () => {
  const text = `NATSU//ECHOで ${Math.floor(game.score).toLocaleString()}点、WAVE ${game.wave}まで夏を生き延びた。8秒前の自分と編隊を組むゲーム。`;
  try {
    if (navigator.share) await navigator.share({ title: 'NATSU//ECHO', text, url: location.href });
    else {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      toast('結果をコピーしました');
    }
  } catch (_) { /* share cancelled */ }
};

addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});
addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (event.code === 'Space') activateBurst();
});

resize();
updateBest();
render();
loop(performance.now());
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
