import { parseMove } from './model.js';

const FACE_NAME = {
  U: 'superior', D: 'inferior', R: 'derecha', L: 'izquierda', F: 'frontal', B: 'trasera',
};

// Dirección de un cuarto de vuelta (sin prima), descrita desde el frente.
const DIR = {
  U: ['hacia la izquierda', 'hacia la derecha'],
  D: ['hacia la derecha', 'hacia la izquierda'],
  R: ['hacia arriba', 'hacia abajo'],
  L: ['hacia abajo', 'hacia arriba'],
  F: ['en sentido horario', 'en sentido antihorario'],
  B: ['en sentido antihorario (visto de frente)', 'en sentido horario (visto de frente)'],
};

const ROT = {
  y: ['Gira todo el cubo hacia la izquierda (la cara derecha pasa al frente)', 'Gira todo el cubo hacia la derecha (la cara izquierda pasa al frente)', 'Gira todo el cubo media vuelta (la cara trasera pasa al frente)'],
  x: ['Inclina todo el cubo hacia atrás (la cara frontal pasa arriba)', 'Inclina todo el cubo hacia ti (la cara superior pasa al frente)', 'Voltea todo el cubo de arriba a abajo'],
  z: ['Gira todo el cubo como un volante a la derecha', 'Gira todo el cubo como un volante a la izquierda', 'Gira todo el cubo media vuelta como un volante'],
};

/** Texto en español para un movimiento. Devuelve { title, html }. */
export function describeMove(m) {
  const { base, suffix } = parseMove(m);
  if (ROT[base]) {
    const t = ROT[base][suffix === "'" ? 1 : suffix === '2' ? 2 : 0];
    return { title: t, html: t, rotation: true };
  }
  const face = FACE_NAME[base];
  if (suffix === '2') {
    const html = `Gira la cara <b>${face}</b> <b>media vuelta</b> (dos veces)`;
    return { title: strip(html), html };
  }
  const dir = DIR[base][suffix === "'" ? 1 : 0];
  const html = `Gira la cara <b>${face}</b> <b>${dir}</b>`;
  return { title: strip(html), html };
}

const strip = s => s.replace(/<[^>]+>/g, '');

export const NOTATION_GUIDE = [
  { m: 'R', t: 'Cara derecha hacia arriba' },
  { m: 'L', t: 'Cara izquierda hacia abajo' },
  { m: 'U', t: 'Cara superior hacia la izquierda' },
  { m: 'D', t: 'Cara inferior hacia la derecha' },
  { m: 'F', t: 'Cara frontal en sentido horario' },
  { m: 'B', t: 'Cara trasera, horario visto desde atrás' },
  { m: "R'", t: 'La prima (\') invierte el sentido' },
  { m: 'R2', t: 'El 2 significa media vuelta' },
  { m: 'y', t: 'Girar todo el cubo (no cambia el estado)' },
];
