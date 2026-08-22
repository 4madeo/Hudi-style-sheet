import { access, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoDirectory = path.join(root, "public/logos");
const sourceDirectory = path.join(logoDirectory, "source");
const manifestPath = path.join(logoDirectory, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await mkdir(sourceDirectory, { recursive: true });

function sourcePathFor(asset) {
  if (asset.sourcePath) return path.join(root, "public", asset.sourcePath.replace(/^\//, ""));
  return path.join(sourceDirectory, path.basename(asset.path));
}

function outputPathFor(asset) {
  return path.join(root, "public", asset.path.replace(/^\//, "").replace(/\.[^.]+$/, ".png"));
}

function foregroundBounds(asset, width, height) {
  if (!asset.crop) return { left: 0, top: 0, right: width, bottom: height };

  const left = Math.max(0, Math.min(width - 1, Math.floor(asset.crop.left * width)));
  const top = Math.max(0, Math.min(height - 1, Math.floor(asset.crop.top * height)));
  const right = Math.max(left + 1, Math.min(width, Math.ceil((asset.crop.left + asset.crop.width) * width)));
  const bottom = Math.max(top + 1, Math.min(height, Math.ceil((asset.crop.top + asset.crop.height) * height)));
  return { left, top, right, bottom };
}

function backgroundColour(data, width, height, channels) {
  const counts = new Map();
  const border = Math.max(2, Math.round(Math.min(width, height) * 0.025));

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x >= border && x < width - border && y >= border && y < height - border) continue;
      const offset = (y * width + x) * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const key = `${r >> 3},${g >> 3},${b >> 3}`;
      const entry = counts.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      entry.count += 1;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      counts.set(key, entry);
    }
  }

  const mode = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return {
    r: Math.round(mode.r / mode.count),
    g: Math.round(mode.g / mode.count),
    b: Math.round(mode.b / mode.count),
  };
}

function dominantOpaqueColour(data, width, height, channels) {
  const counts = new Map();
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * channels;
      if (data[offset + 3] < 220) continue;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const key = `${r >> 3},${g >> 3},${b >> 3}`;
      const entry = counts.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      entry.count += 1;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      counts.set(key, entry);
    }
  }
  const mode = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return {
    r: Math.round(mode.r / mode.count),
    g: Math.round(mode.g / mode.count),
    b: Math.round(mode.b / mode.count),
  };
}

async function processAsset(symbol, asset) {
  const sourcePath = sourcePathFor(asset);
  const outputPath = outputPathFor(asset);

  try {
    await access(sourcePath);
  } catch {
    await copyFile(outputPath, sourcePath);
  }

  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let translucentPixels = 0;
  for (let offset = 3; offset < data.length; offset += info.channels) {
    if (data[offset] < 250) translucentPixels += 1;
  }
  const pixelCount = info.width * info.height;
  const hasTransparency = translucentPixels > pixelCount * 0.001;
  const opaqueCoverage = 1 - (translucentPixels / pixelCount);
  const removeDominantFill = hasTransparency && opaqueCoverage > 0.45;
  const background = removeDominantFill
    ? dominantOpaqueColour(data, info.width, info.height, info.channels)
    : backgroundColour(data, info.width, info.height, info.channels);
  const rgba = Buffer.alloc(info.width * info.height * 4);
  const crop = foregroundBounds(asset, info.width, info.height);
  const backgroundTolerance = asset.backgroundTolerance ?? 5;

  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const sourceOffset = (y * info.width + x) * info.channels;
      const targetOffset = (y * info.width + x) * 4;
      const r = data[sourceOffset];
      const g = data[sourceOffset + 1];
      const b = data[sourceOffset + 2];
      const distance = Math.max(
        Math.abs(r - background.r),
        Math.abs(g - background.g),
        Math.abs(b - background.b),
      );
      const sourceAlpha = data[sourceOffset + 3];
      const extractedAlpha = Math.max(
        0,
        Math.min(255, Math.round((distance - backgroundTolerance) * 10.2)),
      );
      const alpha = hasTransparency && !removeDominantFill
        ? sourceAlpha
        : Math.round(sourceAlpha * extractedAlpha / 255);

      rgba[targetOffset] = r;
      rgba[targetOffset + 1] = g;
      rgba[targetOffset + 2] = b;
      rgba[targetOffset + 3] = alpha;

      if (
        alpha > 20
        && x >= crop.left
        && x < crop.right
        && y >= crop.top
        && y < crop.bottom
      ) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) throw new Error(`${symbol}: no foreground found`);

  const foregroundWidth = right - left + 1;
  const foregroundHeight = bottom - top + 1;
  const padding = Math.max(8, Math.round(Math.max(foregroundWidth, foregroundHeight) * 0.06));
  const extractedLeft = Math.max(crop.left, left - padding);
  const extractedTop = Math.max(crop.top, top - padding);
  const extractedRight = Math.min(crop.right, right + padding + 1);
  const extractedBottom = Math.min(crop.bottom, bottom + padding + 1);
  const extractedWidth = extractedRight - extractedLeft;
  const extractedHeight = extractedBottom - extractedTop;
  const output = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({
      left: extractedLeft,
      top: extractedTop,
      width: extractedWidth,
      height: extractedHeight,
    })
    .resize({
      width: 1000,
      height: 1000,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const temporaryPath = `${outputPath}.process`;
  await writeFile(temporaryPath, output);
  await rename(temporaryPath, outputPath);

  return {
    ...asset,
    format: "png",
    path: `/logos/${path.basename(outputPath)}`,
    sourcePath: `/logos/source/${path.basename(sourcePath)}`,
    bytes: output.length,
    background: hasTransparency && !removeDominantFill
      ? "transparent"
      : `#${[background.r, background.g, background.b]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`,
  };
}

const processed = {};
for (const [symbol, asset] of Object.entries(manifest)) {
  processed[symbol] = await processAsset(symbol, asset);
  console.log(`${symbol}: transparent PNG (${processed[symbol].bytes} bytes)`);
}

await writeFile(manifestPath, `${JSON.stringify(processed, null, 2)}\n`, "utf8");
console.log(`Processed ${Object.keys(processed).length} logo assets.`);
