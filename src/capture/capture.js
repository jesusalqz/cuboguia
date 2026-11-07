// Captura de caras: cámara en vivo o fotos subidas con esquinas ajustables.
import { CAPTURE_ORDER } from './order.js';
import { nearestName, COLOR_HEX } from './colors.js';

const $ = id => document.getElementById(id);

function avgRegion(data, w, x0, y0, x1, y1) {
  // Promedio descartando el 15 % más brillante (reflejos)
  const px = [];
  const step = Math.max(1, Math.floor((x1 - x0) / 10));
  for (let y = Math.floor(y0); y < y1; y += step) for (let x = Math.floor(x0); x < x1; x += step) {
    const i = (y * w + x) * 4;
    px.push([data[i], data[i + 1], data[i + 2]]);
  }
  px.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const keep = px.slice(0, Math.max(1, Math.floor(px.length * 0.85)));
  const acc = [0, 0, 0];
  keep.forEach(p => { acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]; });
  return acc.map(v => v / keep.length);
}

export class FaceCapture {
  constructor({ onFace, onFinish, getAuto }) {
    this.onFace = onFace;
    this.onFinish = onFinish;
    this.getAuto = getAuto;
    this.mode = 'camera';
    this.step = 0;
    this.grids = {};
    this.stream = null;
    this.timer = null;
    this.stable = { key: '', since: 0 };
    this.work = document.createElement('canvas');
    this.ctx = this.work.getContext('2d', { willReadFrequently: true });
    this.cells = [];
    const gc = $('g-cells');
    gc.innerHTML = '';
    for (let i = 0; i < 9; i++) { const d = document.createElement('div'); d.className = 'g-cell'; d.innerHTML = '<i></i>'; gc.appendChild(d); this.cells.push(d.firstChild); }
    $('btn-shot').onclick = () => this.shoot();
    $('btn-prev-face').onclick = () => this.go(this.step - 1);
    $('file-input').onchange = e => { const f = e.target.files[0]; if (f) this.loadImage(f); e.target.value = ''; };
    $('btn-torch').onclick = () => this.toggleTorch();
    this.quad = null;
  }

  async start(mode, onlyFace = null) {
    this.mode = mode;
    this.onlyFace = onlyFace;
    if (!onlyFace) this.grids = {};
    this.step = onlyFace ? CAPTURE_ORDER.findIndex(s => s.face === onlyFace) : 0;
    $('btn-pick').hidden = mode !== 'upload';
    $('auto-wrap').hidden = mode !== 'camera';
    $('cam-video').hidden = mode !== 'camera';
    $('up-canvas').hidden = true;
    $('handles').hidden = true;
    $('grid-overlay').hidden = mode !== 'camera';
    $('btn-shot').textContent = mode === 'camera' ? 'Capturar cara' : 'Usar foto';
    this.render();
    if (mode === 'camera') await this.openCamera();
    else this.showMsg('Toca <b>Elegir foto</b> y selecciona la foto de esta cara.');
  }

  showMsg(html) { const m = $('cam-msg'); m.innerHTML = html; m.hidden = !html; }

  async openCamera() {
    this.showMsg('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      const v = $('cam-video');
      v.srcObject = this.stream;
      await v.play().catch(() => {});
      const track = this.stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      $('btn-torch').hidden = !caps.torch;
      this.timer = setInterval(() => this.sampleLive(), 150);
    } catch (err) {
      this.showMsg('No se pudo abrir la cámara. Revisa los permisos del navegador o usa <b>Subir fotos</b>.');
    }
  }

  async toggleTorch() {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    this.torch = !this.torch;
    try { await track.applyConstraints({ advanced: [{ torch: this.torch }] }); } catch { /* */ }
  }

  stop() {
    clearInterval(this.timer); this.timer = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  /** Lee los 9 colores dentro de la cuadrícula superpuesta al video. */
  readVideoGrid() {
    const v = $('cam-video');
    if (!v.videoWidth) return null;
    const box = $('cam-wrap').getBoundingClientRect();
    const g = $('grid-overlay').getBoundingClientRect();
    const vw = v.videoWidth, vh = v.videoHeight;
    const scale = Math.max(box.width / vw, box.height / vh); // object-fit: cover
    const ox = (box.width - vw * scale) / 2, oy = (box.height - vh * scale) / 2;
    const sx = (g.left - box.left - ox) / scale, sy = (g.top - box.top - oy) / scale, size = g.width / scale;
    const W = 150;
    this.work.width = W; this.work.height = W;
    this.ctx.drawImage(v, sx, sy, size, size, 0, 0, W, W);
    const data = this.ctx.getImageData(0, 0, W, W).data;
    const out = [];
    const cell = W / 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      out.push(avgRegion(data, W, c * cell + cell * 0.3, r * cell + cell * 0.3, c * cell + cell * 0.7, r * cell + cell * 0.7));
    }
    return out;
  }

  sampleLive() {
    const grid = this.readVideoGrid();
    if (!grid) return;
    this.live = grid;
    const names = grid.map(nearestName);
    names.forEach((n, i) => { this.cells[i].style.background = COLOR_HEX[n]; });
    const key = names.join();
    const now = performance.now();
    if (key !== this.stable.key) this.stable = { key, since: now };
    else if (this.getAuto() && now - this.stable.since > 650 && !this.cooldown) {
      const step = CAPTURE_ORDER[this.step];
      if (names[4] === step.color) { this.shoot(); this.cooldown = true; setTimeout(() => (this.cooldown = false), 1600); }
    }
  }

  // ---------- Fotos subidas ----------
  async loadImage(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {});
    const max = 1024;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = $('up-canvas');
    cv.width = Math.round(img.naturalWidth * k);
    cv.height = Math.round(img.naturalHeight * k);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    this.imgData = cx.getImageData(0, 0, cv.width, cv.height);
    cv.hidden = false;
    this.showMsg('');
    // cuadrilátero inicial: cuadrado centrado del 60 %
    const s = Math.min(cv.width, cv.height) * 0.6;
    const x0 = (cv.width - s) / 2, y0 = (cv.height - s) / 2;
    this.quad = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];
    this.setupHandles();
  }

  /** Conversión entre coordenadas de imagen y de pantalla (object-fit: contain). */
  fit() {
    const cv = $('up-canvas');
    const box = $('cam-wrap').getBoundingClientRect();
    const k = Math.min(box.width / cv.width, box.height / cv.height);
    return { k, ox: (box.width - cv.width * k) / 2, oy: (box.height - cv.height * k) / 2 };
  }

  setupHandles() {
    const hs = $('handles');
    hs.hidden = false;
    hs.innerHTML = '<svg id="quad-svg"></svg>';
    this.handleEls = this.quad.map((p, i) => {
      const h = document.createElement('div');
      h.className = 'handle';
      h.setAttribute('aria-label', 'Esquina ' + (i + 1));
      hs.appendChild(h);
      h.addEventListener('pointerdown', e => {
        h.setPointerCapture(e.pointerId);
        const move = ev => {
          const box = $('cam-wrap').getBoundingClientRect();
          const { k, ox, oy } = this.fit();
          const cv = $('up-canvas');
          this.quad[i] = [Math.max(0, Math.min(cv.width, (ev.clientX - box.left - ox) / k)), Math.max(0, Math.min(cv.height, (ev.clientY - box.top - oy) / k))];
          this.drawQuad();
        };
        const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); };
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
      });
      return h;
    });
    this.drawQuad();
  }

  quadPoint(u, v) {
    const [p0, p1, p2, p3] = this.quad;
    const top = [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u];
    const bot = [p3[0] + (p2[0] - p3[0]) * u, p3[1] + (p2[1] - p3[1]) * u];
    return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
  }

  readQuadGrid() {
    const { data, width, height } = this.imgData;
    const out = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const acc = [];
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
        const [x, y] = this.quadPoint((c + 0.3 + 0.4 * a / 5) / 3, (r + 0.3 + 0.4 * b / 5) / 3);
        const xi = Math.min(width - 1, Math.max(0, Math.round(x))), yi = Math.min(height - 1, Math.max(0, Math.round(y)));
        const i = (yi * width + xi) * 4;
        acc.push([data[i], data[i + 1], data[i + 2]]);
      }
      acc.sort((p, q) => p[0] + p[1] + p[2] - (q[0] + q[1] + q[2]));
      const keep = acc.slice(0, Math.floor(acc.length * 0.85));
      out.push([0, 1, 2].map(ch => keep.reduce((s, p) => s + p[ch], 0) / keep.length));
    }
    return out;
  }

  drawQuad() {
    const { k, ox, oy } = this.fit();
    const scr = p => [ox + p[0] * k, oy + p[1] * k];
    this.handleEls.forEach((h, i) => { const [x, y] = scr(this.quad[i]); h.style.left = x + 'px'; h.style.top = y + 'px'; });
    const lines = [];
    for (let t = 0; t <= 3; t++) {
      const a = scr(this.quadPoint(t / 3, 0)), b = scr(this.quadPoint(t / 3, 1));
      const c = scr(this.quadPoint(0, t / 3)), d = scr(this.quadPoint(1, t / 3));
      lines.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`, `<line x1="${c[0]}" y1="${c[1]}" x2="${d[0]}" y2="${d[1]}"/>`);
    }
    const names = this.readQuadGrid().map(nearestName);
    const dots = names.map((n, i) => {
      const r = Math.floor(i / 3), c = i % 3;
      const [x, y] = scr(this.quadPoint((c + 0.5) / 3, (r + 0.5) / 3));
      return `<circle cx="${x}" cy="${y}" r="9" fill="${COLOR_HEX[n]}" stroke="#000" stroke-width="2"/>`;
    });
    $('quad-svg').innerHTML = `<g stroke="#fff" stroke-width="2" opacity=".9">${lines.join('')}</g>${dots.join('')}`;
  }

  // ---------- Flujo ----------
  shoot() {
    let grid;
    if (this.mode === 'camera') grid = this.readVideoGrid();
    else if (this.imgData) grid = this.readQuadGrid();
    if (!grid) { this.toast?.('Primero elige una foto.'); this.onFace?.(null); return; }
    const step = CAPTURE_ORDER[this.step];
    this.grids[step.face] = grid;
    navigator.vibrate?.(30);
    const wrap = $('cam-wrap');
    wrap.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 250 });
    if (this.onlyFace) { this.finish(); return; }
    this.go(this.step + 1);
  }

  go(i) {
    if (i < 0) return;
    if (i >= CAPTURE_ORDER.length) { this.finish(); return; }
    this.step = i;
    if (this.mode === 'upload') {
      $('up-canvas').hidden = true; $('handles').hidden = true; this.imgData = null;
      this.showMsg('Toca <b>Elegir foto</b> y selecciona la foto de esta cara.');
    }
    this.render();
  }

  finish() {
    this.stop();
    this.onFinish(this.grids, this.onlyFace);
  }

  render() {
    const step = CAPTURE_ORDER[this.step];
    $('face-dots').innerHTML = CAPTURE_ORDER.map((s, i) => `<span class="${this.grids[s.face] ? 'done' : ''} ${i === this.step ? 'cur' : ''}" style="background:${COLOR_HEX[s.color]}"></span>`).join('');
    $('face-text').innerHTML = `<b>Cara ${this.step + 1} de 6.</b> ${step.text}`;
    $('btn-prev-face').disabled = this.step === 0 || !!this.onlyFace;
    $('mini-face').innerHTML = miniFace(step);
  }
}

function miniFace(step) {
  const c = COLOR_HEX[step.color], u = COLOR_HEX[step.upColor];
  return `<rect x="10" y="2" width="44" height="10" rx="3" fill="${u}"/>
  <rect x="10" y="16" width="44" height="44" rx="6" fill="#111" stroke="#2A3140"/>
  ${[0, 1, 2].map(r => [0, 1, 2].map(cc => `<rect x="${13 + cc * 13.5}" y="${19 + r * 13.5}" width="11" height="11" rx="2" fill="${r === 1 && cc === 1 ? c : '#3a3f4b'}"/>`).join('')).join('')}`;
}
