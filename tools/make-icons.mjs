// Genera iconos PNG (sin dependencias) y el SVG.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const COLORS = ['#FFD500', '#FFD500', '#009E60', '#E8112D', '#FFD500', '#0051BA', '#FF6A00', '#F5F5F5', '#FFD500'];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function crc32(buf) { let c, crc = ~0; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bg = hex('#0B0D12');
  const pad = size * 0.2, cube = size - pad * 2, gap = cube * 0.04, cell = (cube - gap * 4) / 3, r = cell * 0.18;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let col = bg;
      const lx = x - pad, ly = y - pad;
      if (lx >= 0 && ly >= 0 && lx < cube && ly < cube) {
        col = [17, 17, 17];
        const cx = Math.floor((lx - gap) / (cell + gap)), cy = Math.floor((ly - gap) / (cell + gap));
        if (cx >= 0 && cy >= 0 && cx < 3 && cy < 3) {
          const ix = lx - gap - cx * (cell + gap), iy = ly - gap - cy * (cell + gap);
          if (ix <= cell && iy <= cell) {
            const dx = Math.max(r - ix, 0, ix - (cell - r)), dy = Math.max(r - iy, 0, iy - (cell - r));
            if (dx * dx + dy * dy <= r * r) col = hex(COLORS[cy * 3 + cx]);
          }
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
writeFileSync('assets/icon-192.png', png(192));
writeFileSync('assets/icon-512.png', png(512));
const cells = COLORS.map((c, i) => `<rect x="${14 + (i % 3) * 12.6}" y="${14 + Math.floor(i / 3) * 12.6}" width="11" height="11" rx="2" fill="${c}"/>`).join('');
writeFileSync('assets/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0B0D12"/><rect x="12" y="12" width="40" height="40" rx="5" fill="#111"/>${cells}</svg>`);
console.log('ok');
