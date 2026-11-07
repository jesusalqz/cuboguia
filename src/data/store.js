// Ajustes (localStorage) e historial (IndexedDB). Todo con try/catch y respaldo en memoria.

const DEFAULTS = { speed: 1, labels: false, vibrate: true, autoCapture: false };
let mem = { ...DEFAULTS };

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('cg.settings') || '{}') }; } catch { return { ...mem }; }
}
export function setSettings(patch) {
  const s = { ...getSettings(), ...patch };
  mem = s;
  try { localStorage.setItem('cg.settings', JSON.stringify(s)); } catch { /* sin almacenamiento */ }
  return s;
}

let dbp = null;
let memHist = [];
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    try {
      const r = indexedDB.open('cuboguia', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('solves', { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('solves', mode);
    const out = fn(t.objectStore('solves'));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}

export async function addSolve(entry) {
  try { return await tx('readwrite', s => s.add(entry)); } catch { memHist.push({ ...entry, id: Date.now() }); }
}
export async function listSolves() {
  try {
    const all = await tx('readonly', s => s.getAll());
    return all.sort((a, b) => b.date - a.date);
  } catch { return memHist.slice().reverse(); }
}
export async function deleteSolve(id) {
  try { await tx('readwrite', s => s.delete(id)); } catch { memHist = memHist.filter(h => h.id !== id); }
}
export async function clearSolves() {
  try { await tx('readwrite', s => s.clear()); } catch { memHist = []; }
}
export function wipeAll() {
  try { localStorage.clear(); } catch { /* */ }
  return clearSolves();
}
