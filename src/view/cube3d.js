import * as THREE from '../../vendor/three/three.module.min.js';
import { RoundedBoxGeometry } from '../../vendor/three/RoundedBoxGeometry.js';
import { STICKERS, BASE_MOVES, parseMove } from '../cube/model.js';

const AXIS_VEC = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function roundedSquare(size, r) {
  const s = size / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-s + r, -s);
  sh.lineTo(s - r, -s); sh.quadraticCurveTo(s, -s, s, -s + r);
  sh.lineTo(s, s - r); sh.quadraticCurveTo(s, s, s - r, s);
  sh.lineTo(-s + r, s); sh.quadraticCurveTo(-s, s, -s, s - r);
  sh.lineTo(-s, -s + r); sh.quadraticCurveTo(-s, -s, -s + r, -s);
  return new THREE.ShapeGeometry(sh, 6);
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function labelTexture(hex, letter) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = hex;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = ['#F5F5F5', '#FFD500', '#FF6A00'].includes(hex.toUpperCase()) ? 'rgba(0,0,0,.65)' : 'rgba(255,255,255,.9)';
  g.font = 'bold 64px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Cube3D {
  /**
   * @param {HTMLElement} container
   * @param {{ colors: Record<string,string>, labels?: Record<string,string>, autoRotate?: boolean, interactive?: boolean }} opts
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.colors = opts.colors;
    this.labels = opts.labels || null;
    this.showLabels = false;
    this.autoRotate = !!opts.autoRotate;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.theta = 0.62; this.phi = 0.52; this.radius = opts.radius || 10.5;
    this.updateCamera();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334055, 1.4));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(4, 8, 6);
    this.scene.add(dir);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
    rim.position.set(-6, 2, -4);
    this.scene.add(rim);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -2.2;
    this.scene.add(shadow);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);

    const body = new RoundedBoxGeometry(0.97, 0.97, 0.97, 3, 0.1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.55, metalness: 0.05 });
    const stickerGeo = roundedSquare(0.84, 0.12);
    this.cubies = [];
    this.stickerMeshes = new Array(54);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      const g = new THREE.Group();
      g.userData.home = [x, y, z];
      g.position.set(x, y, z);
      g.add(new THREE.Mesh(body, bodyMat));
      this.root.add(g);
      this.cubies.push(g);
    }
    for (const s of STICKERS) {
      const cubie = this.cubieAt(s.pos);
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.32, metalness: 0.0, emissive: 0x000000 });
      const m = new THREE.Mesh(stickerGeo, mat);
      const n = new THREE.Vector3(...s.normal);
      m.position.copy(n.clone().multiplyScalar(0.487));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      cubie.add(m);
      this.stickerMeshes[s.index] = m;
    }

    this.arrow = null;
    this.dirty = true;
    this.animating = null;
    this.state = null;
    this.textures = {};

    this.bindPointer();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  cubieAt(pos) {
    return this.cubies.find(c => c.userData.home[0] === pos[0] && c.userData.home[1] === pos[1] && c.userData.home[2] === pos[2]);
  }

  setColors(colors, labels) { this.colors = colors; if (labels) this.labels = labels; this.textures = {}; if (this.state) this.setState(this.state); }
  setShowLabels(v) { this.showLabels = v; if (this.state) this.setState(this.state); }

  textureFor(letter) {
    const k = letter + this.colors[letter];
    if (!this.textures[k]) this.textures[k] = labelTexture(this.colors[letter], this.labels?.[letter] || '');
    return this.textures[k];
  }

  /** Pinta los 54 stickers. Las letras desconocidas ('?') se ven grises. */
  setState(state) {
    this.state = state;
    for (let i = 0; i < 54; i++) {
      const L = state[i];
      const mat = this.stickerMeshes[i].material;
      const hex = this.colors[L] || '#3a3f4b';
      if (this.showLabels && this.colors[L]) {
        mat.map = this.textureFor(L);
        mat.color.set(0xffffff);
      } else {
        mat.map = null;
        mat.color.set(hex);
      }
      mat.needsUpdate = true;
    }
    this.dirty = true;
  }

  updateCamera() {
    const r = this.radius;
    this.camera.position.set(r * Math.cos(this.phi) * Math.sin(this.theta), r * Math.sin(this.phi), r * Math.cos(this.phi) * Math.cos(this.theta));
    this.camera.lookAt(0, -0.15, 0);
    this.dirty = true;
  }

  resetView() {
    const from = { t: this.theta, p: this.phi };
    const to = { t: 0.62, p: 0.52 };
    const start = performance.now();
    const step = now => {
      const k = Math.min(1, (now - start) / 350);
      this.theta = from.t + (to.t - from.t) * ease(k);
      this.phi = from.p + (to.p - from.p) * ease(k);
      this.updateCamera();
      if (this.arrowMove) this.showArrow(this.arrowMove);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Vista para "fotografiar" una cara: normal y vector arriba. */
  lookAtFace(normal, up) {
    this.camera.up.set(...up);
    this.camera.position.set(normal[0] * this.radius, normal[1] * this.radius, normal[2] * this.radius);
    this.camera.lookAt(0, 0, 0);
    this.fixedView = true;
    this.dirty = true;
  }

  bindPointer() {
    const el = this.renderer.domElement;
    let last = null;
    el.addEventListener('pointerdown', e => { if (this.fixedView) return; last = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); this.userTouched = true; });
    el.addEventListener('pointermove', e => {
      if (!last) return;
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      last = [e.clientX, e.clientY];
      this.theta -= dx * 0.01;
      this.phi = Math.max(-1.2, Math.min(1.2, this.phi + dy * 0.01));
      this.updateCamera();
      if (this.arrowMove) this.showArrow(this.arrowMove);
    });
    const end = () => { last = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    // Ajustar distancia para que el cubo quepa en pantallas angostas
    this.camera.fov = w / h < 0.8 ? 40 : 32;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    if (this.autoRotate && !this.reducedMotion && !this.userTouched) {
      this.root.rotation.y = now * 0.00025;
      this.root.rotation.x = Math.sin(now * 0.0003) * 0.12;
      this.dirty = true;
    }
    if (this.animating) { this.animating(now); this.dirty = true; }
    if (this.arrow) {
      const s = 1 + Math.sin(now * 0.006) * 0.04;
      this.arrow.children.forEach(c => c.material && (c.material.opacity = 0.85 + Math.sin(now * 0.006) * 0.15));
      this.arrow.scale.setScalar(s);
      this.dirty = true;
    }
    if (this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; }
  }

  moveInfo(move) {
    const { base, turns } = parseMove(move);
    const def = BASE_MOVES[base];
    const angle = def.sign * (turns === 3 ? -1 : turns) * Math.PI / 2;
    return { def, angle, base };
  }

  /** Anima un movimiento y deja el cubo pintado con `nextState`. */
  animateMove(move, nextState, duration = 420) {
    if (this.reducedMotion) duration = Math.min(duration, 160);
    const { def, angle } = this.moveInfo(move);
    const ai = { x: 0, y: 1, z: 2 }[def.axis];
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.updateMatrixWorld();
    const layer = this.cubies.filter(c => def.layers.includes(c.userData.home[ai]));
    layer.forEach(c => this.pivot.attach(c));
    this.highlight(layer, true);
    const axis = AXIS_VEC[def.axis];
    if (Math.abs(angle) > 2) duration *= 1.35;
    return new Promise(resolve => {
      const start = performance.now();
      this.animating = now => {
        const k = Math.min(1, (now - start) / duration);
        this.pivot.quaternion.setFromAxisAngle(axis, angle * ease(k));
        if (k >= 1) {
          this.animating = null;
          this.highlight(layer, false);
          this.resetCubies();
          this.setState(nextState);
          resolve();
        }
      };
    });
  }

  resetCubies() {
    for (const c of this.cubies) {
      this.root.attach(c);
      c.position.set(...c.userData.home);
      c.quaternion.identity();
    }
    this.pivot.quaternion.identity();
  }

  highlight(cubies, on) {
    for (const c of cubies) c.children.forEach((m, i) => { if (i > 0) m.material.emissive.set(on ? 0x1d3566 : 0x000000); });
    this.dirty = true;
  }

  /** Flecha curva que muestra el sentido del próximo giro. */
  showArrow(move) {
    this.hideArrow();
    if (!move) return;
    this.arrowMove = move;
    const { def, angle, base } = this.moveInfo(move);
    const whole = 'xyz'.includes(base);
    const axis = AXIS_VEC[def.axis].clone();
    const layer = whole ? 0 : def.layers[0];
    const R = whole ? 2.3 : 1.45;
    const offset = whole ? 0 : layer * 1.78;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    // centrar el arco hacia la cámara
    const camLocal = this.camera.position.clone().applyQuaternion(this.root.quaternion.clone().invert()).applyQuaternion(q.clone().invert());
    const phi = Math.atan2(camLocal.y, camLocal.x);
    const arc = Math.abs(angle) > 2 ? 2.6 : 1.7;
    const color = 0x6aa6ff;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false });
    const g = new THREE.Group();
    const tor = new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 10, 48, arc), mat);
    const startAng = phi - arc / 2;
    tor.rotation.z = startAng;
    g.add(tor);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.6, 20), mat);
    const ccw = angle > 0;
    const e = ccw ? startAng + arc : startAng;
    head.position.set(R * Math.cos(e), R * Math.sin(e), 0);
    head.rotation.z = ccw ? e : e + Math.PI;
    g.add(head);
    if (Math.abs(angle) > 2) { // media vuelta: segunda punta
      const h2 = head.clone();
      const e2 = ccw ? startAng + arc * 0.55 : startAng + arc * 0.45;
      h2.position.set(R * Math.cos(e2), R * Math.sin(e2), 0);
      h2.rotation.z = ccw ? e2 : e2 + Math.PI;
      g.add(h2);
    }
    const holder = new THREE.Group();
    holder.quaternion.copy(q);
    holder.position.copy(axis.clone().multiplyScalar(offset));
    holder.add(g);
    holder.renderOrder = 10;
    g.children.forEach(c => (c.renderOrder = 10));
    this.arrow = g;
    this.arrowHolder = holder;
    this.root.add(holder);
    this.dirty = true;
  }

  hideArrow() {
    if (this.arrowHolder) {
      this.root.remove(this.arrowHolder);
      this.arrowHolder.traverse(o => { o.geometry?.dispose(); });
    }
    this.arrow = null; this.arrowHolder = null; this.arrowMove = null;
    this.dirty = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
