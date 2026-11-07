import { FACES, NORMALS, stickerAt } from '../cube/model.js';

/**
 * Orden de captura. Orientación de resolución: AMARILLO arriba, VERDE al frente.
 * normal: cara que mira a la cámara; up: dirección que queda arriba en la foto.
 */
export const CAPTURE_ORDER = [
  { face: 'F', color: 'green', upColor: 'yellow', up: [0, 1, 0], text: 'Centro <b>verde</b> mirando a la cámara y <b>amarillo</b> arriba.' },
  { face: 'R', color: 'orange', upColor: 'yellow', up: [0, 1, 0], text: 'Gira el cubo <b>hacia la izquierda</b>: centro <b>naranja</b> al frente, <b>amarillo</b> arriba.' },
  { face: 'B', color: 'blue', upColor: 'yellow', up: [0, 1, 0], text: 'Otra vez hacia la izquierda: centro <b>azul</b> al frente, <b>amarillo</b> arriba.' },
  { face: 'L', color: 'red', upColor: 'yellow', up: [0, 1, 0], text: 'Otra vez hacia la izquierda: centro <b>rojo</b> al frente, <b>amarillo</b> arriba.' },
  { face: 'U', color: 'yellow', upColor: 'blue', up: [0, 0, -1], text: 'Vuelve al verde al frente e inclina el cubo hacia ti: centro <b>amarillo</b> a la cámara y <b>azul</b> arriba.' },
  { face: 'D', color: 'white', upColor: 'green', up: [0, 0, 1], text: 'Centro <b>blanco</b> a la cámara y <b>verde</b> arriba.' },
];

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Índices de facelet de cada casilla (fila, columna) de la foto de esa cara. */
export function photoIndices(step) {
  const n = NORMALS[step.face];
  const up = step.up;
  const right = cross(up, n);
  const out = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const pos = [0, 1, 2].map(k => n[k] + up[k] * (1 - r) + right[k] * (c - 1));
    out.push(stickerAt(pos, n));
  }
  return out;
}

/** Arma el arreglo de 54 muestras a partir de 6 cuadrículas (9 muestras cada una, en orden de foto). */
export function assembleSamples(grids) {
  const out = new Array(54);
  CAPTURE_ORDER.forEach((step, i) => {
    const idx = photoIndices(step);
    idx.forEach((fi, k) => { out[fi] = grids[step.face][k]; });
  });
  return out;
}

export { FACES };
