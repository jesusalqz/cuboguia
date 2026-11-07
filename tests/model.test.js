import test from 'node:test';
import assert from 'node:assert/strict';
import { SOLVED, applyMove, applyMoves, invertMoves, simplify, isSolved, randomScramble, PERMS } from '../src/cube/model.js';
import { validate } from '../src/cube/validate.js';

test('cada giro x4 es la identidad', () => {
  for (const m of Object.keys(PERMS)) {
    let s = applyMoves(SOLVED, randomScramble(20));
    const s0 = s;
    for (let i = 0; i < 4; i++) s = applyMove(s, m);
    assert.equal(s, s0, m);
  }
});

test('X seguido de X\' es la identidad y "sexy move" x6 también', () => {
  const s0 = applyMoves(SOLVED, randomScramble(20));
  for (const m of ['U', 'R', 'F', 'D', 'L', 'B', 'y']) assert.equal(applyMoves(s0, [m, m + "'"]), s0);
  let s = s0;
  for (let i = 0; i < 6; i++) s = applyMoves(s, "R U R' U'");
  assert.equal(s, s0);
});

test('giros conocidos: U mueve la fila de F hacia L', () => {
  const s = applyMove(SOLVED, 'U');
  // la fila superior de L (índices 36-38) ahora tiene el color de F
  assert.equal(s.slice(36, 39), 'FFF');
  const r = applyMove(SOLVED, 'R');
  // la columna derecha de U ahora tiene el color de F
  assert.equal(r[2] + r[5] + r[8], 'FFF');
  const f = applyMove(SOLVED, 'F');
  // la fila inferior de U ahora tiene el color de L
  assert.equal(f.slice(6, 9), 'LLL');
});

test('inverso y simplificación', () => {
  const sc = randomScramble(30);
  assert.ok(isSolved(applyMoves(applyMoves(SOLVED, sc), invertMoves(sc))));
  assert.deepEqual(simplify(['R', 'R']), ['R2']);
  assert.deepEqual(simplify(['R', "R'"]), []);
  assert.deepEqual(simplify(['U', 'U', 'U']), ["U'"]);
  assert.deepEqual(simplify(['R', 'U', "U'", "R'", 'F']), ['F']);
});

test('validación: estados mezclados son válidos', () => {
  for (let i = 0; i < 200; i++) assert.ok(validate(applyMoves(SOLVED, randomScramble(25))).ok);
  assert.ok(validate(SOLVED).solved);
});

const swap = (s, i, j) => { const a = [...s]; [a[i], a[j]] = [a[j], a[i]]; return a.join(''); };

test('validación: detecta errores', () => {
  // arista volteada: UF (U7=7, F1=19)
  assert.equal(validate(swap(SOLVED, 7, 19)).errors[0].kind, 'flip');
  // esquina girada: URF = U9(8), R1(9), F3(20) rotados
  const a = [...SOLVED]; [a[8], a[9], a[20]] = [a[9], a[20], a[8]];
  assert.equal(validate(a.join('')).errors[0].kind, 'twist');
  // dos aristas intercambiadas: UF<->UR  (U7,F1) <-> (U5? U6=5, R1? R2=10)
  const b = [...SOLVED]; [b[7], b[5]] = [b[5], b[7]]; [b[19], b[10]] = [b[10], b[19]];
  assert.equal(validate(b.join('')).errors[0].kind, 'parity');
  // conteo incorrecto
  const c = [...SOLVED]; c[0] = 'R';
  const v = validate(c.join(''));
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => e.count === 8));
});
