import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SOLVED, applyMoves, isSolved, randomScramble } from '../src/cube/model.js';
import { solveLayers } from '../src/solver/layers.js';

const require = createRequire(import.meta.url);
const Cube = require('../vendor/cubejs/cube.js');
require('../vendor/cubejs/solve.js');

// PRNG determinista
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

test('Modo Aprender: 1000 mezclas quedan resueltas', () => {
  const rnd = rng(42);
  let total = 0, worst = 0;
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) {
    const sc = randomScramble(25, rnd);
    const st = applyMoves(SOLVED, sc);
    const { moves } = solveLayers(st);
    const end = applyMoves(st, moves.map(m => m.move));
    assert.ok(isSolved(end), 'mezcla ' + sc.join(' '));
    const n = moves.filter(m => !'xyz'.includes(m.move[0])).length;
    total += n; worst = Math.max(worst, n);
  }
  const ms = (performance.now() - t0) / 1000;
  console.log(`Aprender: media ${(total / 1000).toFixed(1)} giros, peor ${worst}, ${ms.toFixed(1)} ms/cubo`);
  assert.ok(total / 1000 < 150);
});

test('Modo Rápido: 1000 mezclas, ≤ 22 movimientos', () => {
  Cube.initSolver();
  const rnd = rng(7);
  let total = 0;
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) {
    const st = applyMoves(SOLVED, randomScramble(25, rnd));
    const sol = Cube.fromString(st).solve(22).trim().split(/\s+/).filter(Boolean);
    assert.ok(isSolved(applyMoves(st, sol)));
    assert.ok(sol.length <= 22);
    total += sol.length;
  }
  console.log(`Rápido: media ${(total / 1000).toFixed(1)} giros, ${((performance.now() - t0) / 1000).toFixed(1)} ms/cubo`);
});
