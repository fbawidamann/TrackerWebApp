// Generates the PWA icons (dark background, cobalt dumbbell) without any image library.
// Run: npm run icons -w @fitness/web
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [10, 12, 15];
const FG = [79, 134, 247];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Rounded rectangles in unit coordinates (0..1) that form a dumbbell. */
const SHAPES = [
  [0.30, 0.47, 0.70, 0.53, 0.01],   // bar
  [0.22, 0.32, 0.30, 0.68, 0.025],  // inner left plate
  [0.70, 0.32, 0.78, 0.68, 0.025],  // inner right plate
  [0.16, 0.39, 0.22, 0.61, 0.02],   // outer left plate
  [0.78, 0.39, 0.84, 0.61, 0.02],   // outer right plate
];

function inside(x, y) {
  for (const [x0, y0, x1, y1, r] of SHAPES) {
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
  }
  return false;
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const ss = 4; // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        if (inside((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)) hits++;
      }
      const a = hits / (ss * ss);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = new URL("../public/", import.meta.url);
writeFileSync(new URL("icon-192.png", out), png(192));
writeFileSync(new URL("icon-512.png", out), png(512));
writeFileSync(new URL("apple-touch-icon.png", out), png(180));
writeFileSync(new URL("favicon.svg", out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0a0c0f"/><g fill="#4f86f7"><rect x="30" y="47" width="40" height="6" rx="1"/><rect x="22" y="32" width="8" height="36" rx="2.5"/><rect x="70" y="32" width="8" height="36" rx="2.5"/><rect x="16" y="39" width="6" height="22" rx="2"/><rect x="78" y="39" width="6" height="22" rx="2"/></g></svg>\n`);
console.log("Icons written to apps/web/public");
