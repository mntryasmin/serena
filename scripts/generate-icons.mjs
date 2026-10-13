import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const ICONS_DIR = path.join(ROOT, "icons");
const COLORS = ["#3B1E69", "#1E6958", "#692D1E", "#69531E"];

function radiusAt(t) {
  const lobes = 1 + 0.16 * Math.cos(4 * t + Math.PI);
  const wave =
    1 +
    0.055 * Math.cos(8 * t + 0.55) +
    0.028 * Math.sin(12 * t - 0.9) +
    0.012 * Math.cos(6 * t + 1.2);
  return 10 * lobes * wave;
}

function contourPoints(samples) {
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const r = radiusAt(t);
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return pts;
}

function fmt(n) {
  return (Math.round(n * 100) / 100).toString();
}

function pointsToSmoothPath(pts) {
  const n = pts.length;
  const p = (i) => pts[(i + n) % n];
  let d = `M${fmt(p(0)[0])} ${fmt(p(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return `${d}Z`;
}

function layerScales(layers) {
  const maxScale = 1;
  const minScale = 0.14;
  return Array.from({ length: layers }, (_, i) => {
    const t = layers === 1 ? 0 : i / (layers - 1);
    const eased = t * t * 0.15 + t * 0.85;
    return maxScale - eased * (maxScale - minScale);
  });
}

/** Compact SVG with defs/use for the popup + icon.svg */
function buildCompactSvg({ size, layers, strokeWidth, padding, samples }) {
  const base = pointsToSmoothPath(contourPoints(samples));
  const uses = layerScales(layers)
    .map((scale, i) => {
      const color = COLORS[i % COLORS.length];
      const transform = i === 0 ? "" : ` transform="scale(${fmt(scale)})"`;
      return `<use href="#c" stroke="${color}"${transform}/>`;
    })
    .join("\n    ");

  const mid = size / 2;
  const fit = (size - padding * 2) / 23.2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
  <defs>
    <path id="c" d="${base}" fill="none" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
  </defs>
  <g transform="translate(${mid} ${mid}) scale(${fmt(fit)})">
    ${uses}
  </g>
</svg>`;
}

/** Expanded paths — reliable for sharp rasterization */
function buildRasterSvg({ size, layers, strokeWidth, padding, samples }) {
  const base = pointsToSmoothPath(contourPoints(samples));
  const paths = layerScales(layers)
    .map((scale, i) => {
      const color = COLORS[i % COLORS.length];
      const transform = i === 0 ? "" : ` transform="scale(${fmt(scale)})"`;
      return `<path d="${base}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="round"${transform}/>`;
    })
    .join("\n    ");

  const mid = size / 2;
  const fit = (size - padding * 2) / 23.2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
  <g transform="translate(${mid} ${mid}) scale(${fmt(fit)})">
    ${paths}
  </g>
</svg>`;
}

async function writePng(svg, outPath, px) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(px, px, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log("wrote", outPath);
}

async function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const markSvg = buildCompactSvg({
    size: 24,
    layers: 7,
    strokeWidth: 0.72,
    padding: 1.6,
    samples: 40,
  });
  const iconMaster = buildCompactSvg({
    size: 128,
    layers: 10,
    strokeWidth: 1.05,
    padding: 10,
    samples: 64,
  });

  fs.writeFileSync(path.join(ICONS_DIR, "icon.svg"), iconMaster, "utf8");
  fs.writeFileSync(path.join(ROOT, "popup", "mark.svg"), markSvg, "utf8");

  const presets = {
    16: { layers: 5, strokeWidth: 1.55, padding: 12, samples: 36 },
    32: { layers: 6, strokeWidth: 1.25, padding: 11, samples: 48 },
    48: { layers: 8, strokeWidth: 1.15, padding: 10, samples: 56 },
    128: { layers: 10, strokeWidth: 1.05, padding: 10, samples: 64 },
  };

  for (const [px, opts] of Object.entries(presets)) {
    const n = Number(px);
    const svg = buildRasterSvg({ size: 128, ...opts });
    await writePng(svg, path.join(ICONS_DIR, `icon${n}.png`), n);
  }

  console.log("mark bytes", Buffer.byteLength(markSvg));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
