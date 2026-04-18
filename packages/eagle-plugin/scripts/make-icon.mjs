#!/usr/bin/env node
// Generates packages/eagle-plugin/logo.png — a 256x256 purple-to-blue gradient
// square with an "E→F" mark. One-shot; commit the result.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../logo.png");

const size = 256;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c5cff"/>
      <stop offset="100%" stop-color="#2dd4bf"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="48" fill="url(#g)"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
    font-family="-apple-system, SF Pro Display, sans-serif" font-size="96" font-weight="700" fill="white">E→F</text>
</svg>
`.trim();

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`wrote ${out}`);
