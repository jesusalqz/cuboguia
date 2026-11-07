import { STICKERS, EDGE_SLOTS, CORNER_SLOTS, FACES, isSolved } from './model.js';

const OPP = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Orden de referencia de los facelets de cada esquina: [U/D, a, b] en sentido consistente.
const CORNERS = CORNER_SLOTS.map(s => {
  const ud = s.idx.find(i => STICKERS[i].normal[1] !== 0);
  const others = s.idx.filter(i => i !== ud);
  const n = STICKERS[ud].normal;
  if (dot(n, cross(STICKERS[others[0]].normal, STICKERS[others[1]].normal)) < 0) others.reverse();
  const order = [ud, ...others];
  return { order, home: order.map(i => STICKERS[i].face).join('') };
});

// Aristas: facelet de referencia = el de U/D; si no tiene, el de F/B.
const EDGES = EDGE_SLOTS.map(s => {
  const ref = s.idx.find(i => STICKERS[i].normal[1] !== 0) ?? s.idx.find(i => STICKERS[i].normal[2] !== 0);
  const order = [ref, s.idx.find(i => i !== ref)];
  return { order, home: order.map(i => STICKERS[i].face).join('') };
});

const isUD = c => c === 'U' || c === 'D';
const isFB = c => c === 'F' || c === 'B';

function parity(perm) {
  const seen = new Array(perm.length).fill(false);
  let p = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = perm[j]) { seen[j] = true; len++; }
    p += len - 1;
  }
  return p % 2;
}

/**
 * Valida un estado de 54 letras. Devuelve { ok, solved, errors:[{ msg, cells:[índices] }] }.
 */
export function validate(state) {
  const errors = [];
  if (typeof state !== 'string' || state.length !== 54) {
    return { ok: false, errors: [{ msg: 'El estado del cubo está incompleto.', cells: [] }] };
  }
  const centers = FACES.map((_, f) => state[f * 9 + 4]);
  if (new Set(centers).size !== 6) {
    errors.push({ msg: 'Los 6 centros deben ser de colores distintos. Revisa las fotos de las caras.', cells: centers.map((_, f) => f * 9 + 4) });
    return { ok: false, errors };
  }
  for (const f of FACES) {
    const n = [...state].filter(c => c === f).length;
    if (n !== 9) {
      const cells = [...state].map((c, i) => (c === f ? i : -1)).filter(i => i >= 0);
      errors.push({ msg: `Hay ${n} casillas de un color que debería aparecer 9 veces.`, cells, face: f, count: n });
    }
  }
  if (errors.length) return { ok: false, errors };

  // Aristas
  const edgePerm = [];
  let flipSum = 0;
  const edgeSeen = new Map();
  for (let s = 0; s < 12; s++) {
    const [a, b] = EDGES[s].order.map(i => state[i]);
    const cells = EDGES[s].order;
    if (a === b || OPP[a] === b) {
      errors.push({ msg: 'Hay una arista con dos colores que no pueden ir juntos (por ejemplo, colores opuestos).', cells });
      continue;
    }
    // Pieza: buscar el hogar que contenga ambos colores
    const piece = EDGES.findIndex(e => (e.home[0] === a && e.home[1] === b) || (e.home[0] === b && e.home[1] === a));
    if (edgeSeen.has(piece)) {
      errors.push({ msg: 'Hay una arista repetida. Algún color fue mal leído.', cells: [...cells, ...edgeSeen.get(piece)] });
      continue;
    }
    edgeSeen.set(piece, cells);
    edgePerm[s] = piece;
    const pieceRef = isUD(a) || isUD(b) ? (isUD(a) ? 0 : 1) : (isFB(a) ? 0 : 1);
    flipSum += pieceRef;
  }

  // Esquinas
  const cornerPerm = [];
  let twistSum = 0;
  const cornerSeen = new Map();
  for (let s = 0; s < 8; s++) {
    const cols = CORNERS[s].order.map(i => state[i]);
    const cells = CORNERS[s].order;
    const t = cols.findIndex(isUD);
    if (t < 0 || cols.filter(isUD).length !== 1 || new Set(cols).size !== 3 || cols.some((c, i) => cols.some((d, j) => i !== j && OPP[c] === d))) {
      errors.push({ msg: 'Hay una esquina con una combinación de colores imposible.', cells });
      continue;
    }
    const rotated = [cols[t], cols[(t + 1) % 3], cols[(t + 2) % 3]].join('');
    const piece = CORNERS.findIndex(c => c.home === rotated);
    if (piece < 0) {
      errors.push({ msg: 'Hay una esquina con los colores en un orden imposible. Revisa estas casillas.', cells });
      continue;
    }
    if (cornerSeen.has(piece)) {
      errors.push({ msg: 'Hay una esquina repetida. Algún color fue mal leído.', cells: [...cells, ...cornerSeen.get(piece)] });
      continue;
    }
    cornerSeen.set(piece, cells);
    cornerPerm[s] = piece;
    twistSum += t;
  }
  if (errors.length) return { ok: false, errors };

  if (flipSum % 2 !== 0) errors.push({ msg: 'Hay una arista volteada: el cubo pudo haber sido desarmado o un color está mal leído.', cells: [], kind: 'flip' });
  if (twistSum % 3 !== 0) errors.push({ msg: 'Hay una esquina girada: el cubo pudo haber sido desarmado o un color está mal leído.', cells: [], kind: 'twist' });
  if (parity(edgePerm) !== parity(cornerPerm)) errors.push({ msg: 'Dos piezas están intercambiadas: así el cubo no tiene solución. Revisa los colores.', cells: [], kind: 'parity' });

  return { ok: errors.length === 0, solved: errors.length === 0 && isSolved(state), errors };
}
