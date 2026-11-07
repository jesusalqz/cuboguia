import { SOLVED, applyMove, applyMoves, randomScramble, invertMove, isRotation, FACES } from './cube/model.js';
import { validate } from './cube/validate.js';
import { describeMove, NOTATION_GUIDE } from './cube/notation.js';
import { solveLayers, STAGES } from './solver/layers.js';
import { Cube3D } from './view/cube3d.js';
import { FaceCapture } from './capture/capture.js';
import { CAPTURE_ORDER, assembleSamples } from './capture/order.js';
import { classifyCube, COLOR_HEX, COLOR_LETTER, COLOR_ES, DEFAULT_CENTER_NAMES } from './capture/colors.js';
import { getSettings, setSettings, addSolve, listSolves, deleteSolve, clearSolves, wipeAll } from './data/store.js';

const $ = id => document.getElementById(id);
const STAGE_COLORS = ['#7AA8FF', '#4F8CFF', '#2ECC71', '#22B8CF', '#FFD500', '#F5A623', '#FF6A00', '#E05BFF'];
const FAST_STAGE = { id: 'fast', title: 'Solución rápida', goal: 'Sigue cada movimiento.', done: '¡Cubo resuelto!' };

const app = {
  settings: getSettings(),
  centerNames: { ...DEFAULT_CENTER_NAMES },
  state: null,
  confidence: null,
  grids: null,
  overrides: {},
  source: 'camera',
  stack: ['home'],
  cubes: {},
};

// ---------------- Utilidades ----------------
function colorsMap() { return Object.fromEntries(FACES.map(f => [f, COLOR_HEX[app.centerNames[f]]])); }
function labelsMap() { return Object.fromEntries(FACES.map(f => [f, COLOR_LETTER[app.centerNames[f]]])); }
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
let toastT = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
}
function confirmBox(title, text) {
  return new Promise(res => {
    $('mc-title').textContent = title; $('mc-text').textContent = text;
    $('m-confirm').hidden = false;
    const done = v => { $('m-confirm').hidden = true; res(v); };
    $('mc-yes').onclick = () => done(true);
    $('mc-no').onclick = () => done(false);
  });
}
function cube(name, el, opts = {}) {
  if (!app.cubes[name]) {
    app.cubes[name] = new Cube3D($(el), { colors: colorsMap(), labels: labelsMap(), ...opts });
  } else {
    app.cubes[name].setColors(colorsMap(), labelsMap());
  }
  app.cubes[name].setShowLabels(app.settings.labels);
  return app.cubes[name];
}

// ---------------- Navegación ----------------
function show(name, push = true) {
  const cur = document.querySelector('.screen.active');
  const leaving = cur?.id.slice(2);
  if (leaving === 'capture' && name !== 'capture') capture.stop();
  if (leaving === 'player' && name !== 'player') stopPlayer();
  cur?.classList.remove('active');
  $('s-' + name).classList.add('active');
  if (push && app.stack[app.stack.length - 1] !== name) app.stack.push(name);
  onEnter[name]?.();
}
function back() {
  if (app.stack.length <= 1) return show('home', false);
  app.stack.pop();
  show(app.stack[app.stack.length - 1], false);
}
function goHome() { app.stack = ['home']; show('home', false); }

const onEnter = {
  home() { const c = cube('home', 'home-cube', { autoRotate: true }); c.setState(applyMoves(SOLVED, randomScramble(18))); },
  history: renderHistory,
  settings: renderSettings,
};

document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go) {
    const where = go.dataset.go;
    if (where === 'camera' || where === 'upload') { app.source = where; app.stack = ['home']; show('intro'); return; }
    if (where === 'home') return goHome();
    show(where);
  }
  if (e.target.closest('[data-back]')) {
    if (document.querySelector('#s-player.active')) return exitPlayer();
    back();
  }
  if (e.target.closest('[data-close-modal]')) e.target.closest('.modal').hidden = true;
  if (e.target.closest('[data-close-sheet]') || e.target.classList.contains('sheet')) $('list-sheet').hidden = true;
});
window.addEventListener('popstate', () => {});

// ---------------- Captura ----------------
const capture = new FaceCapture({
  getAuto: () => app.settings.autoCapture,
  onFinish: (grids, onlyFace) => {
    app.grids = { ...(app.grids || {}), ...grids };
    if (onlyFace) {
      // conservar correcciones manuales de las otras caras
      for (const k of Object.keys(app.overrides)) if (FACES[Math.floor(k / 9)] === onlyFace) delete app.overrides[k];
    } else app.overrides = {};
    classifyFromGrids();
    app.stack = ['home', 'review'];
    show('review', false);
  },
});
capture.toast = toast;
$('btn-intro-go').onclick = () => { show('capture'); capture.start(app.source); };
$('auto-capture').onchange = e => { app.settings = setSettings({ autoCapture: e.target.checked }); };

function classifyFromGrids() {
  const samples = assembleSamples(app.grids);
  const res = classifyCube(samples);
  const arr = [...res.letters];
  for (const [k, v] of Object.entries(app.overrides)) arr[k] = v;
  app.state = arr.join('');
  app.confidence = res.confidence;
  app.centerNames = res.centerNames;
}

$('btn-practice').onclick = () => {
  app.centerNames = { ...DEFAULT_CENTER_NAMES };
  app.state = applyMoves(SOLVED, randomScramble(25));
  app.confidence = null; app.grids = null; app.overrides = {};
  app.stack = ['home', 'review'];
  show('review', false);
};

// ---------------- Revisión ----------------
onEnter.review = () => { renderReview(); };
function renderReview() {
  const net = $('net');
  const v = validate(app.state);
  const bad = new Set(v.errors.filter(e => !e.face).flatMap(e => e.cells));
  const order = ['U', 'L', 'F', 'R', 'B', 'D'];
  net.innerHTML = order.map(f => {
    const fi = FACES.indexOf(f);
    return `<div class="nf ${f}" style="grid-row:${f === 'U' ? 1 : f === 'D' ? 3 : 2};grid-column:${{ U: 2, L: 1, F: 2, R: 3, B: 4, D: 2 }[f]}">${[...Array(9)].map((_, k) => {
      const i = fi * 9 + k;
      const L = app.state[i];
      const low = app.confidence && app.confidence[i] < 0.35 && !app.overrides[i];
      return `<button class="nc ${k === 4 ? 'center' : ''} ${low ? 'low' : ''} ${bad.has(i) ? 'bad' : ''}" data-i="${i}" style="background:${COLOR_HEX[app.centerNames[L]]}" aria-label="${COLOR_ES[app.centerNames[L]]}">${app.settings.labels ? COLOR_LETTER[app.centerNames[L]] : ''}</button>`;
    }).join('')}</div>`;
  }).join('');
  // conteos
  $('counts').innerHTML = FACES.map(f => {
    const n = [...app.state].filter(c => c === f).length;
    return `<span class="count ${n !== 9 ? 'warn' : ''}"><i style="background:${COLOR_HEX[app.centerNames[f]]}"></i>${COLOR_ES[app.centerNames[f]]} ${n}/9${n !== 9 ? ' ⚠' : ''}</span>`;
  }).join('');
  const errs = $('errors');
  if (v.ok && v.solved) errs.innerHTML = '<div class="ok">¡Tu cubo ya está resuelto! 🎉 Revuélvelo y vuelve a escanearlo.</div>';
  else if (v.ok) errs.innerHTML = '<div class="ok">Todo correcto: el cubo tiene solución.</div>';
  else errs.innerHTML = v.errors.map(e => `<div class="err">${e.face ? `Hay <b>${e.count}</b> casillas de color <b>${COLOR_ES[app.centerNames[e.face]].toLowerCase()}</b> y deben ser 9. Toca la casilla equivocada para corregirla.` : e.msg}</div>`).join('');
  $('btn-solve').disabled = !v.ok || v.solved;
  $('redo').innerHTML = app.grids ? CAPTURE_ORDER.map(s => `<button data-redo="${s.face}"><i style="background:${COLOR_HEX[s.color]}"></i>Repetir ${COLOR_ES[s.color].toLowerCase()}</button>`).join('') : '';
  const c = cube('review', 'review-cube');
  c.setState(app.state);
}
$('net').addEventListener('click', e => {
  const b = e.target.closest('.nc');
  if (!b || b.classList.contains('center')) return;
  openPalette(b, +b.dataset.i);
});
function openPalette(btn, i) {
  const p = $('palette');
  p.innerHTML = FACES.map(f => `<button data-f="${f}" style="background:${COLOR_HEX[app.centerNames[f]]}" aria-label="${COLOR_ES[app.centerNames[f]]}">${app.settings.labels ? COLOR_LETTER[app.centerNames[f]] : ''}</button>`).join('');
  p.hidden = false;
  const r = btn.getBoundingClientRect();
  const pw = 3 * 52 + 2 * 8 + 20, ph = 2 * 52 + 8 + 20;
  p.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + 'px';
  p.style.top = (r.top - ph - 8 > 8 ? r.top - ph - 8 : r.bottom + 8) + 'px';
  p.onclick = e => {
    const f = e.target.closest('[data-f]')?.dataset.f;
    if (!f) return;
    const a = [...app.state]; a[i] = f; app.state = a.join('');
    app.overrides[i] = f;
    p.hidden = true;
    renderReview();
  };
  setTimeout(() => document.addEventListener('pointerdown', function close(ev) {
    if (!p.contains(ev.target)) { p.hidden = true; document.removeEventListener('pointerdown', close); }
  }), 0);
}
$('redo').addEventListener('click', e => {
  const f = e.target.closest('[data-redo]')?.dataset.redo;
  if (!f) return;
  show('capture');
  capture.start(app.source, f);
});
$('btn-solve').onclick = () => show('mode');

// ---------------- Solucionador rápido (Web Worker) ----------------
let worker = null, wid = 0;
const pending = new Map();
let workerReady = false;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./solver/kociemba.worker.js', import.meta.url));
  worker.onmessage = e => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p(e.data); } };
  return worker;
}
function call(type, state) {
  return new Promise(res => { const id = ++wid; pending.set(id, res); getWorker().postMessage({ id, type, state }); });
}
function warmSolver() { call('init').then(r => { workerReady = r.ok; }); }
(window.requestIdleCallback || (f => setTimeout(f, 1500)))(warmSolver);

onEnter.mode = async () => {
  const learn = solveLayers(app.state);
  app.learn = learn;
  $('n-learn').textContent = `${learn.moves.filter(m => !isRotation(m.move)).length} movimientos`;
  $('n-fast').textContent = 'Calculando…';
  $('mode-status').textContent = workerReady ? '' : 'Preparando el solucionador rápido (solo la primera vez)…';
  app.fast = null;
  const st = app.state;
  const r = await call('solve', st);
  if (st !== app.state) return;
  $('mode-status').textContent = '';
  if (r.ok) { app.fast = r.moves; $('n-fast').textContent = `${r.moves.length} movimientos`; }
  else $('n-fast').textContent = 'No disponible';
};
document.querySelectorAll('.mode-card').forEach(b => b.onclick = async () => {
  const mode = b.dataset.mode;
  if (mode === 'learn') startPlayer('learn', app.learn.moves);
  else {
    if (!app.fast) {
      $('mode-status').textContent = 'Calculando la solución más corta…';
      const r = await call('solve', app.state);
      if (!r.ok) { toast('No se pudo calcular: ' + r.error); return; }
      app.fast = r.moves;
    }
    startPlayer('fast', app.fast.map(m => ({ move: m, stage: 'fast', alg: null, hint: null })));
  }
});

// ---------------- Reproductor ----------------
const P = { moves: [], states: [], i: 0, busy: false, playing: false, mode: 'learn', t0: 0, elapsed: 0, timer: null, wake: null };
const SPEEDS = [0.5, 1, 1.5, 2];

function stageInfo(id) { return id === 'fast' ? FAST_STAGE : STAGES.find(s => s.id === id); }
function stageList() {
  const out = [];
  P.moves.forEach((m, k) => {
    const last = out[out.length - 1];
    if (!last || last.id !== m.stage) out.push({ id: m.stage, start: k, end: k + 1 });
    else last.end = k + 1;
  });
  return out;
}

function startPlayer(mode, moves) {
  P.mode = mode;
  P.moves = moves;
  P.states = [app.state];
  for (const m of moves) P.states.push(applyMove(P.states[P.states.length - 1], m.move));
  P.i = 0; P.busy = false; P.playing = false; P.elapsed = 0; P.t0 = 0;
  P.speed = app.settings.speed;
  P.stages = stageList();
  app.stack = ['home', 'review', 'mode', 'player'];
  show('player', false);
  const c = cube('player', 'player-cube');
  c.resetCubies();
  c.setState(P.states[0]);
  renderPlayer();
  renderTimer();
  requestWake();
  showModal('Prepárate', `Sostén tu cubo con el centro <b>${COLOR_ES[app.centerNames.U].toLowerCase()}</b> arriba y el <b>${COLOR_ES[app.centerNames.F].toLowerCase()}</b> al frente. Mantenlo así: la app te avisará cuando haya que girar el cubo completo.`, mode === 'learn' ? `Primera etapa: ${stageInfo(P.moves[0].stage).title}. ${stageInfo(P.moves[0].stage).goal}` : `${moves.length} movimientos. El cronómetro empieza con tu primer paso.`, 'Empezar', false);
}

function renderPlayer() {
  const c = app.cubes.player;
  const n = P.moves.length;
  const cur = P.moves[Math.min(P.i, n - 1)];
  const st = stageInfo(cur.stage);
  const si = P.stages.findIndex(s => s.id === cur.stage && P.i >= s.start && P.i < s.end);
  $('stage-name').textContent = P.mode === 'learn' ? `Etapa ${Math.max(0, si) + 1}/${P.stages.length} · ${st.title}` : st.title;
  $('stage-name').style.setProperty('--sc', STAGE_COLORS[Math.max(0, si) % STAGE_COLORS.length]);
  $('step-count').textContent = `Paso ${Math.min(P.i + 1, n)} de ${n}`;
  if (P.i < n) {
    const m = P.moves[P.i];
    const d = describeMove(m.move);
    const big = $('move-big');
    big.textContent = m.move;
    big.className = 'move-big' + (isRotation(m.move) ? ' rot' : '');
    $('move-text').innerHTML = d.html;
    $('hint').textContent = m.hint || (isRotation(m.move) ? 'Gira el cubo completo, sin mover ninguna capa.' : (m.alg ? `Algoritmo: ${m.alg}` : 'Sigue la flecha azul sobre el cubo.'));
    c.showArrow(m.move);
  }
  $('btn-back').disabled = P.i === 0;
  // progreso
  $('progress').innerHTML = P.stages.map((s, k) => {
    const p = Math.max(0, Math.min(1, (P.i - s.start) / (s.end - s.start)));
    return `<button class="seg" data-jump="${s.start}" style="--w:${s.end - s.start};--p:${p * 100}%;--c:${STAGE_COLORS[k % STAGE_COLORS.length]}" aria-label="Ir a ${stageInfo(s.id).title}"><b></b></button>`;
  }).join('');
  $('btn-play').innerHTML = `<svg class="ic"><use href="#i-${P.playing ? 'pause' : 'play'}"/></svg>`;
  $('btn-play').classList.toggle('on', P.playing);
  $('btn-speed').textContent = P.speed + '×';
}

function startTimer() {
  if (P.timer) return;
  P.t0 = performance.now() - P.elapsed;
  P.timer = setInterval(renderTimer, 500);
}
function pauseTimer() {
  if (!P.timer) return;
  clearInterval(P.timer); P.timer = null;
  P.elapsed = performance.now() - P.t0;
}
function renderTimer() {
  const ms = P.timer ? performance.now() - P.t0 : P.elapsed;
  $('timer').textContent = fmtTime(ms);
}

const dur = () => 460 / P.speed;

async function next() {
  if (P.busy || P.i >= P.moves.length) return;
  startTimer();
  P.busy = true;
  const c = app.cubes.player;
  c.hideArrow();
  await c.animateMove(P.moves[P.i].move, P.states[P.i + 1], dur());
  P.i++;
  P.busy = false;
  if (app.settings.vibrate) navigator.vibrate?.(15);
  if (P.i >= P.moves.length) { finishPlayer(); return; }
  renderPlayer();
  if (P.mode === 'learn' && P.moves[P.i].stage !== P.moves[P.i - 1].stage) stageDone(P.moves[P.i - 1].stage, P.moves[P.i].stage);
}
async function prev() {
  if (P.busy || P.i === 0) return;
  P.busy = true;
  const c = app.cubes.player;
  c.hideArrow();
  await c.animateMove(invertMove(P.moves[P.i - 1].move), P.states[P.i - 1], dur());
  P.i--;
  P.busy = false;
  renderPlayer();
}
async function replay() {
  if (P.busy || P.i >= P.moves.length) return;
  P.busy = true;
  const c = app.cubes.player;
  c.hideArrow();
  const m = P.moves[P.i].move;
  await c.animateMove(m, P.states[P.i + 1], dur());
  await new Promise(r => setTimeout(r, 250));
  await c.animateMove(invertMove(m), P.states[P.i], dur() * 0.7);
  P.busy = false;
  renderPlayer();
}
function jump(k) {
  if (P.busy) return;
  P.i = Math.max(0, Math.min(P.moves.length - 1, k));
  app.cubes.player.setState(P.states[P.i]);
  renderPlayer();
  $('list-sheet').hidden = true;
}
async function togglePlay() {
  P.playing = !P.playing;
  renderPlayer();
  while (P.playing && P.i < P.moves.length && document.querySelector('#s-player.active')) {
    await next();
    if (!$('m-stage').hidden) { P.playing = false; break; }
    await new Promise(r => setTimeout(r, 380 / P.speed));
  }
  P.playing = false;
  if (document.querySelector('#s-player.active')) renderPlayer();
}

function showModal(title, text, nextText, btn = 'Continuar', wrong = true) {
  $('ms-title').textContent = title;
  $('ms-text').innerHTML = text;
  $('ms-next').innerHTML = nextText || '';
  $('ms-continue').textContent = btn;
  $('ms-wrong').hidden = !wrong;
  $('m-stage').querySelector('.badge-ok').hidden = !wrong;
  $('m-stage').hidden = false;
}
function stageDone(doneId, nextId) {
  const d = stageInfo(doneId), n = stageInfo(nextId);
  pauseTimer();
  showModal(`¡${d.title} completada!`, d.done, `Siguiente: <b>${n.title}</b>. ${n.goal}`);
}
$('ms-continue').onclick = () => { $('m-stage').hidden = true; if (P.i > 0) startTimer(); };
$('ms-wrong').onclick = async () => {
  $('m-stage').hidden = true;
  if (await confirmBox('¿Volver a escanear?', 'Escanea tu cubo tal como está ahora y calcularé una nueva solución desde ahí.')) {
    show('intro');
  }
};

async function finishPlayer() {
  pauseTimer();
  const ms = P.elapsed;
  const count = P.moves.filter(m => !isRotation(m.move)).length;
  await addSolve({ date: Date.now(), mode: P.mode, moves: count, timeMs: ms, initial: app.state });
  const all = await listSolves();
  const best = all.filter(h => h.mode === P.mode).reduce((b, h) => (b == null || h.timeMs < b ? h.timeMs : b), null);
  app.lastDone = { ms, count, mode: P.mode };
  $('d-time').textContent = fmtTime(ms);
  $('d-moves').textContent = count;
  $('d-mode').textContent = P.mode === 'learn' ? 'Aprender' : 'Rápido';
  $('d-best').textContent = best != null && best >= ms ? '¡Nuevo mejor tiempo en este modo!' : best != null ? `Tu mejor tiempo: ${fmtTime(best)}` : '';
  app.stack = ['home', 'done'];
  show('done', false);
  const c = cube('done', 'done-cube', { autoRotate: true });
  c.setState(SOLVED);
}
async function exitPlayer() {
  P.playing = false;
  if (P.i > 0 && !(await confirmBox('¿Salir de la solución?', 'Perderás el avance de esta resolución.'))) return;
  back();
}
function stopPlayer() {
  P.playing = false;
  pauseTimer();
  app.cubes.player?.hideArrow();
  P.wake?.release?.().catch(() => {});
  P.wake = null;
}
async function requestWake() {
  try { P.wake = await navigator.wakeLock?.request('screen'); } catch { /* sin wake lock */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.querySelector('#s-player.active')) requestWake(); });

$('btn-next').onclick = next;
$('btn-back').onclick = prev;
$('btn-replay').onclick = replay;
$('btn-play').onclick = togglePlay;
$('btn-speed').onclick = () => { P.speed = SPEEDS[(SPEEDS.indexOf(P.speed) + 1) % SPEEDS.length]; renderPlayer(); };
$('btn-view').onclick = () => app.cubes.player.resetView();
$('progress').addEventListener('click', e => { const j = e.target.closest('[data-jump]'); if (j) jump(+j.dataset.jump); });
$('btn-help').onclick = () => {
  $('notation').innerHTML = NOTATION_GUIDE.map(n => `<div><b>${n.m}</b>${n.t}</div>`).join('');
  $('m-help').hidden = false;
};
$('btn-list').onclick = () => {
  $('move-list').innerHTML = P.stages.map(s => `<div class="ml-stage">${stageInfo(s.id).title}</div><div class="ml-moves">${P.moves.slice(s.start, s.end).map((m, k) => {
    const idx = s.start + k;
    return `<button data-jump="${idx}" class="${idx < P.i ? 'done' : ''} ${idx === P.i ? 'cur' : ''} ${isRotation(m.move) ? 'rot' : ''}">${m.move}</button>`;
  }).join('')}</div>`).join('');
  $('list-sheet').hidden = false;
};
$('move-list').addEventListener('click', e => { const j = e.target.closest('[data-jump]'); if (j) jump(+j.dataset.jump); });
// Deslizar sobre la tarjeta
(() => {
  let x0 = null;
  const card = $('step-card');
  card.addEventListener('pointerdown', e => { if (!e.target.closest('button')) x0 = e.clientX; });
  card.addEventListener('pointerup', e => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (dx < -50) next(); else if (dx > 50) prev();
  });
})();
document.addEventListener('keydown', e => {
  if (!document.querySelector('#s-player.active') || !$('m-stage').hidden) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
  if (e.key === 'ArrowLeft') prev();
});

$('btn-share').onclick = async () => {
  const d = app.lastDone;
  if (!d) return;
  const text = `Resolví mi cubo de Rubik con CuboGuía en ${fmtTime(d.ms)} (${d.count} movimientos, modo ${d.mode === 'learn' ? 'Aprender' : 'Rápido'}).`;
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast('Copiado al portapapeles'); }
  } catch { /* cancelado */ }
};

// ---------------- Historial ----------------
async function renderHistory() {
  const list = await listSolves();
  const el = $('hist-list');
  if (!list.length) { el.innerHTML = '<div class="empty">Aún no has resuelto ningún cubo.<br>¡Escanea el tuyo para empezar!</div>'; return; }
  const best = {};
  list.forEach(h => { if (!best[h.mode] || h.timeMs < best[h.mode].timeMs) best[h.mode] = h; });
  el.innerHTML = list.map(h => {
    const isBest = best[h.mode] === h;
    const date = new Date(h.date).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
    return `<div class="hist ${isBest ? 'best' : ''}">
      <div class="h-main">${isBest ? '<div class="tag">Mejor tiempo</div>' : ''}<div class="h-t">${fmtTime(h.timeMs)}</div>
      <div class="h-d">${h.mode === 'learn' ? 'Aprender' : 'Rápido'} · ${h.moves} movimientos · ${date}</div></div>
      <button class="icon-btn" data-repeat="${h.id}" aria-label="Repetir esta solución"><svg class="ic"><use href="#i-replay"/></svg></button>
      <button class="icon-btn" data-del="${h.id}" aria-label="Borrar"><svg class="ic"><use href="#i-trash"/></svg></button>
    </div>`;
  }).join('');
  el.onclick = async e => {
    const del = e.target.closest('[data-del]');
    const rep = e.target.closest('[data-repeat]');
    if (del) { await deleteSolve(+del.dataset.del); renderHistory(); }
    if (rep) {
      const h = list.find(x => x.id === +rep.dataset.repeat);
      app.state = h.initial; app.grids = null; app.confidence = null; app.overrides = {};
      app.centerNames = { ...DEFAULT_CENTER_NAMES };
      app.stack = ['home', 'review'];
      show('review', false);
    }
  };
}
$('btn-clear-hist').onclick = async () => {
  if (await confirmBox('¿Borrar el historial?', 'Se eliminarán todas tus resoluciones guardadas.')) { await clearSolves(); renderHistory(); }
};

// ---------------- Ajustes ----------------
function renderSettings() {
  const s = app.settings;
  $('set-speed').value = String(s.speed);
  $('set-labels').checked = s.labels;
  $('set-vibrate').checked = s.vibrate;
  $('set-auto').checked = s.autoCapture;
}
$('set-speed').onchange = e => { app.settings = setSettings({ speed: +e.target.value }); };
$('set-labels').onchange = e => { app.settings = setSettings({ labels: e.target.checked }); Object.values(app.cubes).forEach(c => c.setShowLabels(e.target.checked)); };
$('set-vibrate').onchange = e => { app.settings = setSettings({ vibrate: e.target.checked }); };
$('set-auto').onchange = e => { app.settings = setSettings({ autoCapture: e.target.checked }); };
$('btn-wipe').onclick = async () => {
  if (await confirmBox('¿Borrar todos los datos?', 'Se borrarán el historial y los ajustes de este dispositivo.')) {
    await wipeAll(); app.settings = getSettings(); renderSettings(); toast('Datos borrados');
  }
};
onEnter.capture = () => { $('auto-capture').checked = app.settings.autoCapture; };

// ---------------- Inicio ----------------
show('home', false);
const isDev = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw');
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isDev) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
