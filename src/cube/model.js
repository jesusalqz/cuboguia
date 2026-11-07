// Modelo del cubo: 54 facelets en orden Kociemba U R F D L B.
// Cada facelet guarda la LETRA de la cara cuyo centro tiene ese color.
// Coordenadas: x → derecha (R), y → arriba (U), z → frente (F).

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const SOLVED = FACES.map(f => f.repeat(9)).join('');

const NORMALS = {
  U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1],
  D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1],
};

// Posición de la casilla (fila r, columna c) de cada cara, convención Kociemba.
function stickerPos(face, r, c) {
  switch (face) {
    case 'U': return [c - 1, 1, r - 1];
    case 'R': return [1, 1 - r, 1 - c];
    case 'F': return [c - 1, 1 - r, 1];
    case 'D': return [c - 1, -1, 1 - r];
    case 'L': return [-1, 1 - r, c - 1];
    case 'B': return [1 - c, 1 - r, -1];
  }
}

/** STICKERS[i] = { face, index, pos:[x,y,z], normal:[x,y,z] } */
export const STICKERS = [];
FACES.forEach((face, fi) => {
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    STICKERS.push({ face, index: fi * 9 + r * 3 + c, pos: stickerPos(face, r, c), normal: NORMALS[face] });
  }
});

const key = (p, n) => p.join(',') + '|' + n.join(',');
const LOOKUP = new Map(STICKERS.map(s => [key(s.pos, s.normal), s.index]));
export const stickerAt = (pos, normal) => LOOKUP.get(key(pos, normal));

const AXIS = { x: 0, y: 1, z: 2 };

// Rotación de un cuarto de vuelta. sign = +1 antihorario visto desde +eje (regla mano derecha).
export function rotateVec(v, axis, sign) {
  const [x, y, z] = v;
  if (axis === 'x') return sign > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === 'y') return sign > 0 ? [z, y, -x] : [-z, y, x];
  return sign > 0 ? [-y, x, z] : [y, -x, z];
}

// Definición de giros básicos (un cuarto de vuelta en sentido horario visto desde la cara).
// layers: valores de la coordenada del eje afectados.
export const BASE_MOVES = {
  U: { axis: 'y', layers: [1], sign: -1 },
  D: { axis: 'y', layers: [-1], sign: 1 },
  R: { axis: 'x', layers: [1], sign: -1 },
  L: { axis: 'x', layers: [-1], sign: 1 },
  F: { axis: 'z', layers: [1], sign: -1 },
  B: { axis: 'z', layers: [-1], sign: 1 },
  // giros de cubo completo
  x: { axis: 'x', layers: [-1, 0, 1], sign: -1 },
  y: { axis: 'y', layers: [-1, 0, 1], sign: -1 },
  z: { axis: 'z', layers: [-1, 0, 1], sign: -1 },
};

function buildPerm(base) {
  // perm[dest] = src
  const perm = new Array(54);
  for (let i = 0; i < 54; i++) perm[i] = i;
  const ai = AXIS[base.axis];
  for (const s of STICKERS) {
    if (!base.layers.includes(s.pos[ai])) continue;
    const dest = stickerAt(rotateVec(s.pos, base.axis, base.sign), rotateVec(s.normal, base.axis, base.sign));
    perm[dest] = s.index;
  }
  return perm;
}

const compose = (p, q) => q.map(i => p[i]); // aplicar p y luego q

export const PERMS = {};
for (const [name, base] of Object.entries(BASE_MOVES)) {
  const p1 = buildPerm(base);
  const p2 = compose(p1, p1);
  const p3 = compose(p2, p1);
  PERMS[name] = p1;
  PERMS[name + '2'] = p2;
  PERMS[name + "'"] = p3;
}

export function parseMove(m) {
  const base = m[0];
  const suffix = m.slice(1);
  const turns = suffix === '2' ? 2 : suffix === "'" ? 3 : 1;
  return { base, turns, suffix };
}

export function isRotation(m) { return 'xyz'.includes(m[0]); }

export function applyMove(state, move) {
  const perm = PERMS[move];
  if (!perm) throw new Error('Movimiento desconocido: ' + move);
  let out = '';
  for (let i = 0; i < 54; i++) out += state[perm[i]];
  return out;
}

export function applyMoves(state, moves) {
  const list = typeof moves === 'string' ? splitMoves(moves) : moves;
  for (const m of list) state = applyMove(state, m);
  return state;
}

export function splitMoves(str) {
  return str.trim().split(/\s+/).filter(Boolean);
}

export function invertMove(m) {
  const { base, suffix } = parseMove(m);
  if (suffix === '2') return m;
  return suffix === "'" ? base : base + "'";
}

export function invertMoves(list) { return list.slice().reverse().map(invertMove); }

/** Cancela y fusiona movimientos consecutivos de la misma cara. */
export function simplify(list) {
  const out = [];
  for (const m of list) {
    const { base, turns } = parseMove(m);
    const last = out[out.length - 1];
    if (last && parseMove(last).base === base) {
      const t = (parseMove(last).turns + turns) % 4;
      out.pop();
      if (t) out.push(base + (t === 1 ? '' : t === 2 ? '2' : "'"));
    } else {
      out.push(m);
    }
  }
  return out.length === list.length ? out : simplify(out);
}

export function isSolved(state) {
  for (let f = 0; f < 6; f++) {
    const c = state[f * 9 + 4];
    for (let i = 0; i < 9; i++) if (state[f * 9 + i] !== c) return false;
  }
  return true;
}

export function randomScramble(n = 25, rnd = Math.random) {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
  const sfx = ['', "'", '2'];
  const out = [];
  let prev = '';
  while (out.length < n) {
    const f = faces[Math.floor(rnd() * 6)];
    if (f === prev) continue;
    prev = f;
    out.push(f + sfx[Math.floor(rnd() * 3)]);
  }
  return out;
}

// ---------- Piezas ----------

/** Lista de posiciones de piezas con sus índices de facelet. */
function pieces(kind) {
  const res = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const nz = [x, y, z].filter(v => v !== 0).length;
    if ((kind === 'edge' && nz === 2) || (kind === 'corner' && nz === 3)) {
      const pos = [x, y, z];
      const idx = [];
      [[x, 0, 0], [0, y, 0], [0, 0, z]].forEach(n => { if (n.some(v => v)) idx.push(stickerAt(pos, n)); });
      res.push({ pos, idx });
    }
  }
  return res;
}
export const EDGE_SLOTS = pieces('edge');
export const CORNER_SLOTS = pieces('corner');

/** Color (letra) del centro que está en la posición de la cara indicada. */
export function centerOf(state, face) { return state[FACES.indexOf(face) * 9 + 4]; }

/** Devuelve la letra de cara (U..B) correspondiente a un vector normal. */
export function faceOfNormal(n) {
  for (const [f, v] of Object.entries(NORMALS)) if (v[0] === n[0] && v[1] === n[1] && v[2] === n[2]) return f;
}
export { NORMALS };
