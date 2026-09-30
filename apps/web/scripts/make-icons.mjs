// Renders the app icon (assets/app-icon.svg, "Goal Ring") into all PWA / iOS / favicon files in public/.
// Run: npm run icons -w @fitness/web
import { copyFileSync, readFileSync } from "node:fs";
import sharp from "sharp";

const src = new URL("../assets/app-icon.svg", import.meta.url);
const out = (name) => new URL(`../public/${name}`, import.meta.url);
const svg = readFileSync(src);

const sizes = [
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["favicon-32.png", 32],
];
for (const [name, size] of sizes) {
  // Render at high density, then downscale, so gradients and the glow stay smooth.
  await sharp(svg, { density: Math.ceil((size / 100) * 72 * 4) })
    .resize(size, size)
    .flatten({ background: "#0A0C0F" }) // iOS icons must not be transparent
    .png({ compressionLevel: 9 })
    .toFile(out(name).pathname.replace(/^\/([A-Z]:)/, "$1"));
}
copyFileSync(src, out("favicon.svg"));
console.log("Icons written to apps/web/public");
