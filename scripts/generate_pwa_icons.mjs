import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Pure Node.js RGBA PNG Encoder with zero external dependencies
 */
function createPNG(width, height, pixelShader) {
  // Scanlines with filter byte 0
  const stride = width * 4;
  const rawData = Buffer.alloc(height * (stride + 1));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelShader(x, y, width, height);
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(r)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(g)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(b)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);

  const crcData = Buffer.concat([typeBuf, data]);
  const crc = zlib.crc32(crcData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

/**
 * Procedural Pixel Shader for MyCinema Cinematic Lens Icon
 * Concept: Dark luxury squircle + golden anamorphic camera lens + aperture iris
 */
function cinemaIconShader(x, y, w, h) {
  // Normalize coords to [-1, 1]
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;
  const dist = Math.sqrt(nx * nx + ny * ny);

  // Squircle rounded background box
  const cornerRadius = 0.22;
  const squircleDist = Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4);
  if (squircleDist > 0.88) {
    return [0, 0, 0, 0]; // Transparent outside icon squircle
  }

  // Base background: Cinema Black (#09090B) with subtle center radial warmth
  let r = 9;
  let g = 9;
  let b = 11;
  let a = 255;

  // Lens Outer Bezel (dist ~ 0.70 to 0.78)
  const lensRadius = 0.72;
  const bezelThickness = 0.06;
  const inBezel = Math.abs(dist - lensRadius) < bezelThickness;

  if (inBezel) {
    const bezelT = 1 - Math.abs(dist - lensRadius) / bezelThickness;
    // Metallic Gold #E0AD52 with subtle specular reflection
    const angle = Math.atan2(ny, nx);
    const specular = Math.pow(Math.sin(angle * 2), 2) * 0.3 + 0.7;
    r = Math.round(224 * specular * bezelT + r * (1 - bezelT));
    g = Math.round(173 * specular * bezelT + g * (1 - bezelT));
    b = Math.round(82 * specular * bezelT + b * (1 - bezelT));
    return [r, g, b, 255];
  }

  // Inside Lens Chamber (dist < 0.66)
  if (dist < 0.66) {
    // Lens glass gradient (dark deep obsidian #0F1016 with subtle violet flare #8C7AD0)
    const glassT = dist / 0.66;
    r = Math.round(12 + (1 - glassT) * 15);
    g = Math.round(13 + (1 - glassT) * 12);
    b = Math.round(22 + (1 - glassT) * 28);

    // Inner Aperture Ring (dist ~ 0.46 to 0.50)
    const innerRing = Math.abs(dist - 0.48) < 0.025;
    if (innerRing) {
      r = 217;
      g = 160;
      b = 58;
      return [r, g, b, 255];
    }

    // Cinematic Center Emblem: Stylized Golden Cinema Play / Lens Element
    // Centered equilateral triangle / lens focal point
    const triX = nx + 0.04;
    const triY = ny;
    if (triX >= -0.16 && triX <= 0.22 && Math.abs(triY) <= (0.22 - triX) * 0.72) {
      // Golden Prism Fill (#EDC257)
      return [237, 194, 87, 255];
    }

    // Subtle lens reflections (anisotropic highlights)
    if (Math.abs(ny + nx * 0.4) < 0.03 && dist < 0.6) {
      r = Math.min(255, r + 45);
      g = Math.min(255, g + 40);
      b = Math.min(255, b + 65);
    }
  }

  // Anti-aliased border of the squircle
  const edgeAlpha = Math.max(0, Math.min(1, (0.88 - squircleDist) * 15));
  return [r, g, b, Math.round(a * edgeAlpha)];
}

// Generate Icons
const sizes = [
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon.png', size: 64 },
];

console.log('Generating PWA icons for MyCinema...');
for (const { file, size } of sizes) {
  const pngBuffer = createPNG(size, size, cinemaIconShader);
  fs.writeFileSync(path.resolve(file), pngBuffer);
  console.log(`✓ Generated ${file} (${size}x${size}, ${pngBuffer.length} bytes)`);
}

// Also generate scalable SVG icon for vector icon support
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1A1829" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#09090B" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F2D279"/>
      <stop offset="50%" stop-color="#E0AD52"/>
      <stop offset="100%" stop-color="#C28B2B"/>
    </linearGradient>
    <linearGradient id="lensReflect" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8C7AD0" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#E0AD52" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  <!-- Squircle Base -->
  <rect width="512" height="512" rx="112" fill="#09090B"/>
  <rect width="512" height="512" rx="112" fill="url(#bgGlow)"/>
  <rect width="508" height="508" x="2" y="2" rx="110" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2"/>

  <!-- Outer Lens Bezel -->
  <circle cx="256" cy="256" r="184" stroke="url(#goldGradient)" stroke-width="14" stroke-opacity="0.95"/>
  <circle cx="256" cy="256" r="168" stroke="#09090B" stroke-width="6"/>

  <!-- Lens Glass Chamber -->
  <circle cx="256" cy="256" r="162" fill="#0E1019"/>
  <circle cx="256" cy="256" r="162" fill="url(#lensReflect)"/>

  <!-- Inner Aperture Ring -->
  <circle cx="256" cy="256" r="118" stroke="url(#goldGradient)" stroke-width="4" stroke-opacity="0.8" stroke-dasharray="14 8"/>

  <!-- Lens Iris Center Element -->
  <polygon points="216,186 332,256 216,326" fill="url(#goldGradient)"/>
</svg>`;

fs.writeFileSync(path.resolve('public/icon.svg'), svgIcon, 'utf8');
console.log('✓ Generated public/icon.svg');
