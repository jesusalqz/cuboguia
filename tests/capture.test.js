import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_ORDER, photoIndices, assembleSamples } from '../src/capture/order.js';
import { classifyCube, nearestName } from '../src/capture/colors.js';
import { FACES, SOLVED, applyMoves, randomScramble } from '../src/cube/model.js';

test('cada foto corresponde exactamente a la cara en orden Kociemba', () => {
  for (const step of CAPTURE_ORDER) {
    const f = FACES.indexOf(step.face);
    assert.deepEqual(photoIndices(step), [...Array(9)].map((_, k) => f * 9 + k), step.face);
  }
});

const BASE = { U: [215, 205, 40], R: [235, 105, 35], F: [20, 150, 75], D: [215, 220, 222], L: [180, 25, 40], B: [20, 75, 170] };
const tint = (rgb, [kr, kg, kb], noise, rnd) => rgb.map((v, i) => Math.max(0, Math.min(255, v * [kr, kg, kb][i] + (rnd() - 0.5) * noise)));
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

test('cubo virtual fotografiado se reconstruye igual con luz cálida y fría', () => {
  const rnd = rng(3);
  for (const light of [[1, 1, 1], [1.1, 0.95, 0.75], [0.85, 0.95, 1.12], [0.7, 0.7, 0.7]]) {
    for (let t = 0; t < 30; t++) {
      const st = applyMoves(SOLVED, randomScramble(25, rnd));
      const grids = {};
      for (const step of CAPTURE_ORDER) grids[step.face] = photoIndices(step).map(i => tint(BASE[st[i]], light, 24, rnd));
      const res = classifyCube(assembleSamples(grids));
      assert.equal(res.letters, st, 'luz ' + light);
    }
  }
});

test('rojo y naranja se distinguen', () => {
  assert.equal(nearestName([190, 30, 40]), 'red');
  assert.equal(nearestName([240, 110, 30]), 'orange');
  assert.equal(nearestName([230, 215, 50]), 'yellow');
  assert.equal(nearestName([230, 230, 230]), 'white');
});
