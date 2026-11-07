// Clasificación de colores de stickers.

export const COLOR_NAMES = ['white', 'yellow', 'red', 'orange', 'blue', 'green'];
export const COLOR_HEX = {
  white: '#F5F5F5', yellow: '#FFD500', red: '#E8112D', orange: '#FF6A00', blue: '#0051BA', green: '#009E60',
};
export const COLOR_ES = { white: 'Blanco', yellow: 'Amarillo', red: 'Rojo', orange: 'Naranja', blue: 'Azul', green: 'Verde' };
export const COLOR_LETTER = { white: 'B', yellow: 'A', red: 'R', orange: 'N', blue: 'Z', green: 'V' };

// Colores típicos de stickers vistos por una cámara (RGB).
const REF_RGB = {
  white: [215, 220, 222], yellow: [215, 205, 40], red: [180, 25, 40],
  orange: [235, 105, 35], blue: [20, 75, 170], green: [20, 150, 75],
};

function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// Distancia que pesa poco la luminosidad (la iluminación varía mucho) y mucho el tono.
export function dist(a, b) {
  const dl = (a[0] - b[0]) * 0.45;
  return Math.sqrt(dl * dl + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

const REF_LAB = Object.fromEntries(Object.entries(REF_RGB).map(([k, v]) => [k, rgbToLab(v)]));

/** Normaliza el balance de blancos usando una muestra que se cree blanca (opcional). */
export function nearestName(rgb) {
  const lab = rgbToLab(rgb);
  let best = null, bd = Infinity;
  for (const n of COLOR_NAMES) {
    const d = dist(lab, REF_LAB[n]);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

/**
 * Clasifica los 54 stickers.
 * @param {number[][]} samples 54 colores RGB en orden de facelets
 * @returns {{ letters: string, confidence: number[], centerNames: Record<string,string> }}
 */
export function classifyCube(samples) {
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const labs = samples.map(rgbToLab);
  // Referencias: los centros
  let refs = FACES.map((_, f) => labs[f * 9 + 4].slice());
  let assign = new Array(54).fill(-1);
  for (let iter = 0; iter < 4; iter++) {
    assign = balancedAssign(labs, refs);
    // recalcular referencias (centro pesa doble)
    refs = refs.map((_, k) => {
      const idx = assign.map((a, i) => (a === k ? i : -1)).filter(i => i >= 0);
      const acc = [0, 0, 0];
      let w = 0;
      for (const i of idx) { const ww = i % 9 === 4 ? 2 : 1; acc[0] += labs[i][0] * ww; acc[1] += labs[i][1] * ww; acc[2] += labs[i][2] * ww; w += ww; }
      return acc.map(v => v / w);
    });
  }
  const confidence = labs.map((lab, i) => {
    const ds = refs.map(r => dist(lab, r)).sort((a, b) => a - b);
    const own = dist(lab, refs[assign[i]]);
    return Math.max(0, Math.min(1, (ds[1] - own) / 18 + (own === ds[0] ? 0.3 : 0)));
  });
  const letters = assign.map(k => FACES[k]).join('');
  return { letters, confidence, centerNames: nameCenters(FACES.map((_, f) => samples[f * 9 + 4])) };
}

/** Asignación codiciosa con capacidad 9 por color; los centros quedan fijos. */
function balancedAssign(labs, refs) {
  const assign = new Array(54).fill(-1);
  const cap = new Array(6).fill(9);
  for (let f = 0; f < 6; f++) { assign[f * 9 + 4] = f; cap[f]--; }
  const pairs = [];
  for (let i = 0; i < 54; i++) {
    if (i % 9 === 4) continue;
    for (let k = 0; k < 6; k++) pairs.push([dist(labs[i], refs[k]), i, k]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  for (const [, i, k] of pairs) {
    if (assign[i] >= 0 || cap[k] === 0) continue;
    assign[i] = k; cap[k]--;
  }
  return assign;
}

/** Asigna un nombre de color a cada centro (sin repetir) para pintar la interfaz. */
export function nameCenters(centerRgb) {
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const labs = centerRgb.map(rgbToLab);
  const pairs = [];
  labs.forEach((l, f) => COLOR_NAMES.forEach(n => pairs.push([dist(l, REF_LAB[n]), f, n])));
  pairs.sort((a, b) => a[0] - b[0]);
  const out = {}, used = new Set();
  for (const [, f, n] of pairs) {
    if (out[FACES[f]] || used.has(n)) continue;
    out[FACES[f]] = n; used.add(n);
  }
  return out;
}

/** Colores por defecto de la orientación de resolución (amarillo arriba, verde al frente). */
export const DEFAULT_CENTER_NAMES = { U: 'yellow', R: 'orange', F: 'green', D: 'white', L: 'red', B: 'blue' };
