import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"))
  ?? "public/logos/catalog/manifest.json";
const manifestPath = path.resolve(root, manifestArgument);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const containerRemovals = manifest.entries.filter((entry) => entry.logo?.containerRemoved);
const failures = [];

for (const entry of containerRemovals) {
  const logoPath = path.join(root, "public", entry.logo.path.replace(/^\//, ""));
  const { data, info } = await sharp(logoPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visible = 0;
  let strong = 0;
  let alphaTotal = 0;
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= 8) continue;
      visible += 1;
      alphaTotal += alpha / 255;
      if (alpha > 160) strong += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  const width = right - left + 1;
  const height = bottom - top + 1;
  const strongShare = visible ? strong / visible : 0;
  const meanAlpha = visible ? alphaTotal / visible : 0;
  const aspect = width > 0 && height > 0
    ? Math.max(width / height, height / width)
    : Number.POSITIVE_INFINITY;
  const reasons = [];
  if (!visible) reasons.push("empty");
  if (strongShare < 0.05 || meanAlpha < 0.2) reasons.push("weak-alpha-outline");
  if (aspect > 15) reasons.push("collapsed-to-line");
  if (reasons.length) {
    failures.push({ id: entry.id, company: entry.company, reasons, strongShare, meanAlpha, width, height });
  }
}

if (failures.length) {
  console.error(`Found ${failures.length} likely background-removal failures:`);
  for (const failure of failures) {
    console.error(`${failure.id} ${failure.company}: ${failure.reasons.join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Checked ${containerRemovals.length} container removals; no outline-only failures found.`);
}
