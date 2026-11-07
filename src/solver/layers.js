// Método principiante por capas.
// Orientación: AMARILLO arriba (U), BLANCO abajo (D). Se usan giros de cubo "y"
// para llevar siempre el hueco de trabajo al frente-derecha.
import {
  applyMove, applyMoves, splitMoves, simplify, isSolved, rotateVec,
  EDGE_SLOTS, CORNER_SLOTS, STICKERS, faceOfNormal, centerOf,
} from '../cube/model.js';

export const STAGES = [
  { id: 'daisy', title: 'Margarita', goal: 'Coloca las 4 aristas blancas alrededor del centro amarillo, con el blanco hacia arriba.', done: 'Arriba ves una "flor": centro amarillo con 4 pétalos blancos.' },
  { id: 'cross', title: 'Cruz blanca', goal: 'Baja cada pétalo blanco a la cara inferior cuando su color lateral coincida con el centro.', done: 'Abajo hay una cruz blanca y cada arista coincide con el centro de su lado.' },
  { id: 'corners1', title: 'Esquinas blancas', goal: 'Completa la cara blanca colocando las 4 esquinas.', done: 'La cara inferior es toda blanca y la primera capa coincide con los centros.' },
  { id: 'middle', title: 'Segunda capa', goal: 'Coloca las 4 aristas de la capa del medio.', done: 'Las dos capas de abajo están completas.' },
  { id: 'ycross', title: 'Cruz amarilla', goal: 'Forma una cruz amarilla en la cara superior.', done: 'Arriba hay una cruz amarilla.' },
  { id: 'yedges', title: 'Aristas amarillas', goal: 'Haz que los lados de la cruz amarilla coincidan con los centros.', done: 'Cada arista amarilla coincide con el centro de su lado.' },
  { id: 'ycorners', title: 'Esquinas a su lugar', goal: 'Lleva cada esquina amarilla a su posición correcta (aunque esté girada).', done: 'Cada esquina está entre sus tres colores, aunque esté girada.' },
  { id: 'orient', title: 'Girar esquinas', goal: 'Gira las esquinas amarillas hasta que todo quede resuelto.', done: '¡Cubo resuelto!' },
];

const FACE_MOVES = ['U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2', 'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2'];
const OPP_ORDER = { U: 'D', R: 'L', F: 'B' }; // poda: tras D no va U, etc.

const centerAtNormal = (s, n) => centerOf(s, faceOfNormal(n));
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

function findPiece(s, slots, colors) {
  for (const slot of slots) {
    const cols = slot.idx.map(i => s[i]);
    if (sameSet(cols, colors)) return slot;
  }
  return null;
}
const pieceSolved = (s, slot) => slot.idx.every(i => s[i] === centerAtNormal(s, STICKERS[i].normal));
const colorOn = (s, slot, normal) => s[slot.idx.find(i => STICKERS[i].normal.join() === normal.join())];
const UP = [0, 1, 0];

/** Número de giros y para llevar (x,z) a (1,1). */
function yAlign(x, z) {
  let p = [x, 0, z];
  for (let k = 0; k < 4; k++) {
    if (p[0] === 1 && p[2] === 1) return k;
    p = rotateVec(p, 'y', -1);
  }
  throw new Error('yAlign');
}
function yAlignFace(normal) { // llevar una cara lateral al frente
  let p = normal;
  for (let k = 0; k < 4; k++) {
    if (p[2] === 1) return k;
    p = rotateVec(p, 'y', -1);
  }
  throw new Error('yAlignFace');
}
const Y = ['', 'y', 'y2', "y'"];
const UT = ['', 'U', 'U2', "U'"];

class Builder {
  constructor(state) { this.s = state; this.moves = []; }
  push(seq, stage, alg = null, hint = null) {
    const list = Array.isArray(seq) ? seq : splitMoves(seq);
    for (const m of list) {
      if (!m) continue;
      this.s = applyMove(this.s, m);
      this.moves.push({ move: m, stage, alg, hint });
    }
  }
}

// ---------- Etapa 1: margarita ----------
function daisyCount(s, W) {
  let n = 0;
  for (const slot of EDGE_SLOTS) if (slot.pos[1] === 1 && colorOn(s, slot, UP) === W) n++;
  return n;
}
function iddfs(s, goal, maxDepth) {
  const path = [];
  function dfs(st, depth, last) {
    if (depth === 0) return goal(st);
    for (const m of FACE_MOVES) {
      const b = m[0];
      if (last && (b === last || OPP_ORDER[b] === last)) continue;
      path.push(m);
      if (dfs(applyMove(st, m), depth - 1, b)) return true;
      path.pop();
    }
    return false;
  }
  for (let d = 1; d <= maxDepth; d++) if (dfs(s, d, null)) return path.slice();
  return null;
}

function crossSolved(s, W) {
  return EDGE_SLOTS.filter(sl => sl.pos[1] === -1).every(sl => pieceSolved(s, sl)) && centerOf(s, 'D') === W;
}

function stageDaisy(b, W) {
  if (crossSolved(b.s, W)) return;
  let c = daisyCount(b.s, W);
  while (c < 4) {
    const seq = iddfs(b.s, st => daisyCount(st, W) > c, 6);
    if (!seq) throw new Error('No se encontró la margarita');
    b.push(seq, 'daisy', 'Llevar arista blanca arriba', 'Sube una arista blanca junto al centro amarillo con el blanco mirando hacia arriba, sin quitar los pétalos ya puestos.');
    c = daisyCount(b.s, W);
  }
}

function stageCrossClean(b, W) {
  if (crossSolved(b.s, W)) return;
  for (let guard = 0; guard < 8 && daisyCount(b.s, W) > 0; guard++) {
    let found = null;
    for (let u = 0; u < 4 && !found; u++) {
      const st = u ? applyMove(b.s, UT[u]) : b.s;
      for (const slot of EDGE_SLOTS) {
        if (slot.pos[1] !== 1 || colorOn(st, slot, UP) !== W) continue;
        const sideN = [slot.pos[0], 0, slot.pos[2]];
        if (colorOn(st, slot, sideN) === centerAtNormal(st, sideN)) { found = { u, face: faceOfNormal(sideN) }; break; }
      }
    }
    if (!found) throw new Error('Cruz: no se pudo alinear');
    if (found.u) b.push(UT[found.u], 'cross', 'Alinear pétalo', 'Gira la cara superior hasta que el color lateral de un pétalo coincida con el centro de ese lado.');
    b.push(found.face + '2', 'cross', 'Bajar pétalo', `Media vuelta a esa cara para bajar la arista blanca a su lugar.`);
  }
  if (!crossSolved(b.s, W)) throw new Error('Cruz incompleta');
}

// ---------- Etapa 2: esquinas blancas ----------
const SEXY = "R U R' U'";
const CORNER_INSERTS = [
  { seq: "R U R'", name: "R U R'", hint: 'El blanco mira a la derecha: sube y baja la cara derecha para meter la esquina.' },
  { seq: "F' U' F", name: "F' U' F", hint: 'El blanco mira al frente: usa la cara frontal para meter la esquina.' },
  { seq: "U R U' R'", name: "U R U' R'", hint: 'Inserta la esquina en su hueco de abajo a la derecha.' },
  { seq: "R U' R' U2 R U R'", name: "R U' R' U2 R U R'", hint: 'El blanco mira hacia arriba: este algoritmo gira la esquina y la mete en su lugar.' },
  { seq: "R U R' U'", name: "R U R' U'", hint: 'Inserta la esquina en su hueco de abajo a la derecha.' },
];
function stageCorners1(b, W) {
  for (let guard = 0; guard < 30; guard++) {
    const unsolved = CORNER_SLOTS.map(sl => ({ sl, cols: sl.idx.map(i => b.s[i]) }))
      .filter(o => o.cols.includes(W) && !(o.sl.pos[1] === -1 && pieceSolved(b.s, o.sl)));
    if (!unsolved.length) return;
    const top = unsolved.find(o => o.sl.pos[1] === 1);
    if (top) {
      const others = top.cols.filter(c => c !== W);
      // hueco destino: esquina inferior entre los centros de esos dos colores
      const target = CORNER_SLOTS.find(sl => sl.pos[1] === -1 &&
        sameSet([centerAtNormal(b.s, [sl.pos[0], 0, 0]), centerAtNormal(b.s, [0, 0, sl.pos[2]])], others));
      const k = yAlign(target.pos[0], target.pos[2]);
      if (k) b.push(Y[k], 'corners1', 'Girar el cubo', 'Gira todo el cubo para que el hueco de la esquina quede abajo a la derecha, al frente.');
      // llevar la esquina arriba de ese hueco
      for (let u = 0; u < 4; u++) {
        const sl = findPiece(b.s, CORNER_SLOTS, [W, ...others]);
        if (sl.pos[0] === 1 && sl.pos[2] === 1) break;
        b.push('U', 'corners1', 'Colocar esquina encima', 'Gira la cara superior hasta que la esquina quede justo encima de su lugar (arriba, frente-derecha).');
      }
      const dfr = CORNER_SLOTS.find(sl => sl.pos.join() === '1,-1,1');
      const solvedBefore = CORNER_SLOTS.filter(sl => sl.pos[1] === -1 && sl !== dfr && pieceSolved(b.s, sl));
      const ok = st => pieceSolved(st, dfr) && crossSolved(st, W) && solvedBefore.every(sl => pieceSolved(st, sl));
      const ins = CORNER_INSERTS.find(c => ok(applyMoves(b.s, c.seq)));
      if (ins) {
        b.push(ins.seq, 'corners1', ins.name, ins.hint);
      } else {
        let reps = 0;
        while (!pieceSolved(b.s, dfr)) {
          if (++reps > 6) throw new Error('Esquina blanca: demasiadas repeticiones');
          b.push(SEXY, 'corners1', "R U R' U'", 'Repite este algoritmo hasta que la esquina blanca quede en su lugar con el blanco abajo.');
        }
      }
    } else {
      const o = unsolved[0];
      const k = yAlign(o.sl.pos[0], o.sl.pos[2]);
      if (k) b.push(Y[k], 'corners1', 'Girar el cubo', 'Gira todo el cubo para que la esquina mal puesta quede abajo a la derecha, al frente.');
      b.push(SEXY, 'corners1', "R U R' U'", 'Este algoritmo saca la esquina mal colocada hacia arriba.');
    }
  }
  throw new Error('Esquinas blancas: no converge');
}

// ---------- Etapa 3: segunda capa ----------
const RIGHT_ALG = "U R U' R' U' F' U F";
const LEFT_ALG = "U' L' U L U F U' F'";
function stageMiddle(b, W, YC) {
  for (let guard = 0; guard < 30; guard++) {
    const mids = EDGE_SLOTS.map(sl => ({ sl, cols: sl.idx.map(i => b.s[i]) }))
      .filter(o => !o.cols.includes(W) && !o.cols.includes(YC));
    const unsolved = mids.filter(o => !(o.sl.pos[1] === 0 && pieceSolved(b.s, o.sl)));
    if (!unsolved.length) return;
    const top = unsolved.find(o => o.sl.pos[1] === 1);
    if (top) {
      const sideN = [top.sl.pos[0], 0, top.sl.pos[2]];
      const sideColor = colorOn(b.s, top.sl, sideN);
      const topColor = colorOn(b.s, top.sl, UP);
      const faceN = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].find(n => centerAtNormal(b.s, n) === sideColor);
      const k = yAlignFace(faceN);
      if (k) b.push(Y[k], 'middle', 'Girar el cubo', 'Gira todo el cubo para que el centro del color lateral de la arista quede al frente.');
      for (let u = 0; u < 4; u++) {
        const sl = findPiece(b.s, EDGE_SLOTS, [sideColor, topColor]);
        if (sl.pos.join() === '0,1,1') break;
        b.push('U', 'middle', 'Formar la T', 'Gira la cara superior hasta que la arista forme una "T" invertida con el centro del frente.');
      }
      if (topColor === centerOf(b.s, 'R')) b.push(RIGHT_ALG, 'middle', 'Arista a la derecha', 'El color de arriba coincide con el centro derecho: aplica el algoritmo hacia la derecha.');
      else if (topColor === centerOf(b.s, 'L')) b.push(LEFT_ALG, 'middle', 'Arista a la izquierda', 'El color de arriba coincide con el centro izquierdo: aplica el algoritmo hacia la izquierda.');
      else throw new Error('Segunda capa: color inesperado');
    } else {
      const o = unsolved[0];
      const k = yAlign(o.sl.pos[0], o.sl.pos[2]);
      if (k) b.push(Y[k], 'middle', 'Girar el cubo', 'Gira todo el cubo para que la arista mal puesta quede al frente-derecha.');
      b.push(RIGHT_ALG, 'middle', 'Sacar arista', 'Este algoritmo saca la arista mal colocada hacia la capa superior.');
    }
  }
  throw new Error('Segunda capa: no converge');
}

// ---------- Búsqueda por bloques (capa superior) ----------
function blockSearch(s, blocks, goal, maxBlocks, finals = ['']) {
  let frontier = [{ s, path: [] }];
  for (let d = 0; d <= maxBlocks; d++) {
    for (const node of frontier) {
      for (const f of finals) {
        const st = f ? applyMoves(node.s, f) : node.s;
        if (goal(st)) return { path: node.path, final: f };
      }
    }
    if (d === maxBlocks) break;
    const next = [];
    for (const node of frontier) for (const blk of blocks) next.push({ s: applyMoves(node.s, blk.seq), path: [...node.path, blk] });
    frontier = next;
  }
  return null;
}
const uEdges = s => EDGE_SLOTS.filter(sl => sl.pos[1] === 1);
const uCorners = s => CORNER_SLOTS.filter(sl => sl.pos[1] === 1);
const yellowCross = (s, YC) => uEdges(s).every(sl => colorOn(s, sl, UP) === YC);
const edgesMatch = s => uEdges(s).every(sl => pieceSolved(s, sl));
const f2lSolved = s => [...EDGE_SLOTS, ...CORNER_SLOTS].filter(sl => sl.pos[1] < 1).every(sl => pieceSolved(s, sl));

const OLL_EDGES = "F R U R' U' F'";
function stageYCross(b, YC) {
  const blocks = [0, 1, 2, 3].map(u => ({ u, seq: (UT[u] + ' ' + OLL_EDGES).trim() }));
  const res = blockSearch(b.s, blocks, st => yellowCross(st, YC), 3);
  if (!res) throw new Error('Cruz amarilla: sin solución');
  for (const blk of res.path) {
    if (blk.u) b.push(UT[blk.u], 'ycross', 'Colocar la figura', 'Gira la cara superior para dejar la "L" atrás-izquierda o la línea horizontal.');
    b.push(OLL_EDGES, 'ycross', "F R U R' U' F'", 'Este algoritmo avanza: punto → L → línea → cruz.');
  }
}

const SUNE = "R U R' U R U2 R'";
function stageYEdges(b, YC) {
  const blocks = [0, 1, 2, 3].map(u => ({ u, seq: (UT[u] + ' ' + SUNE).trim() }));
  const goal = st => yellowCross(st, YC) && edgesMatch(st);
  const res = blockSearch(b.s, blocks, goal, 3, UT);
  if (!res) throw new Error('Aristas amarillas: sin solución');
  for (const blk of res.path) {
    if (blk.u) b.push(UT[blk.u], 'yedges', 'Preparar', 'Gira la cara superior para colocar las aristas antes del algoritmo.');
    b.push(SUNE, 'yedges', "R U R' U R U2 R'", 'Este algoritmo intercambia aristas de la capa superior.');
  }
  if (res.final) b.push(res.final, 'yedges', 'Alinear', 'Gira la cara superior hasta que las aristas coincidan con los centros.');
}

const NIKLAS = "U R U' L' U R' U' L";
const cornersPlaced = s => uCorners(s).every(sl => sameSet(sl.idx.map(i => s[i]), sl.idx.map(i => centerAtNormal(s, STICKERS[i].normal))));
function stageYCorners(b, YC) {
  const blocks = [0, 1, 2, 3].map(k => ({ k, seq: (Y[k] + ' ' + NIKLAS).trim() }));
  const goal = st => cornersPlaced(st) && edgesMatch(st) && yellowCross(st, YC);
  const res = blockSearch(b.s, blocks, goal, 3);
  if (!res) throw new Error('Esquinas amarillas: sin solución');
  for (const blk of res.path) {
    if (blk.k) b.push(Y[blk.k], 'ycorners', 'Girar el cubo', 'Gira todo el cubo para dejar al frente-derecha la esquina que ya está en su lugar.');
    b.push(NIKLAS, 'ycorners', "U R U' L' U R' U' L", 'Este algoritmo mueve tres esquinas sin tocar la esquina de frente-derecha.');
  }
}

const TWIST = "R' D' R D";
const TWIST_INV = "D' R' D R";
function stageOrient(b, YC) {
  const ufr = () => CORNER_SLOTS.find(sl => sl.pos.join() === '1,1,1');
  for (let guard = 0; guard < 8; guard++) {
    const bad = uCorners(b.s).filter(sl => colorOn(b.s, sl, UP) !== YC);
    if (!bad.length) break;
    // girar U hasta tener una esquina mal orientada en frente-derecha
    let u = 0;
    while (colorOn(b.s, ufr(), UP) === YC) {
      b.push('U', 'orient', 'Siguiente esquina', 'Gira SOLO la cara superior para traer la siguiente esquina sin resolver al frente-derecha. ¡No gires el cubo entero!');
      if (++u > 3) throw new Error('Orientar: bucle');
    }
    // ¿El amarillo mira a la derecha o al frente? Elegimos la versión que necesita 2 repeticiones.
    const twice = applyMoves(b.s, TWIST + ' ' + TWIST);
    const useTwist = colorOn(twice, ufr(), UP) === YC;
    const alg = useTwist ? TWIST : TWIST_INV;
    const hint = useTwist
      ? 'El amarillo de esta esquina mira a la DERECHA: haz este algoritmo 2 veces. Las capas de abajo se desordenan, pero se arreglan solas al final.'
      : 'El amarillo de esta esquina mira al FRENTE: haz este algoritmo 2 veces. Las capas de abajo se desordenan, pero se arreglan solas al final.';
    for (let r = 0; r < 2; r++) b.push(alg, 'orient', alg, hint);
    if (colorOn(b.s, ufr(), UP) !== YC) throw new Error('Orientar: no quedó amarillo arriba');
  }
  for (let u = 0; u < 4; u++) {
    if (isSolved(b.s)) return;
    b.push('U', 'orient', 'Alinear la capa superior', 'Gira la cara superior hasta completar el cubo.');
  }
  if (!isSolved(b.s)) throw new Error('No quedó resuelto');
}

/**
 * Resuelve con el método por capas.
 * @param {string} state 54 letras (amarillo = U, blanco = D en la orientación inicial)
 * @returns {{ moves: Array<{move, stage, alg, hint}> }}
 */
export function solveLayers(state) {
  const b = new Builder(state);
  const W = centerOf(state, 'D');
  const YC = centerOf(state, 'U');
  if (!isSolved(state)) {
    stageDaisy(b, W);
    stageCrossClean(b, W);
    stageCorners1(b, W);
    stageMiddle(b, W, YC);
    stageYCross(b, YC);
    stageYEdges(b, YC);
    stageYCorners(b, YC);
    stageOrient(b, YC);
  }
  return { moves: compact(b.moves) };
}

// Fusiona movimientos consecutivos de la misma cara dentro del mismo paso lógico.
function compact(list) {
  const out = [];
  for (const it of list) {
    const last = out[out.length - 1];
    if (last && last.move[0] === it.move[0] && last.stage === it.stage) {
      const merged = simplify([last.move, it.move]);
      out.pop();
      if (merged.length === 1) out.push({ ...last, move: merged[0] });
      else if (merged.length === 2) out.push(last, it);
      continue;
    }
    out.push(it);
  }
  return out.length === list.length ? out : compact(out);
}

