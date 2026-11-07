/* Web Worker clásico: solución rápida (Kociemba, cubejs MIT). */
importScripts('../../vendor/cubejs/cube.js', '../../vendor/cubejs/solve.js');
let ready = false;
function ensure() {
  if (!ready) { self.Cube.initSolver(); ready = true; }
}
self.onmessage = (e) => {
  const { id, type, state } = e.data;
  try {
    if (type === 'init') { ensure(); self.postMessage({ id, ok: true }); return; }
    if (type === 'solve') {
      ensure();
      const sol = self.Cube.fromString(state).solve(22);
      self.postMessage({ id, ok: true, moves: sol.trim() ? sol.trim().split(/\s+/) : [] });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
