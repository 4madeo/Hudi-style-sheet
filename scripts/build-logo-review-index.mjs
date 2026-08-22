import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "public/logos/catalog/manifest.json");
const auditPath = path.join(root, "artifacts/logo-source-audit.json");
const outputPath = path.join(root, "public/logos/catalog/review.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const auditById = new Map(audit.results.map((result) => [result.id, result]));
const reviewById = new Map();

function isEmptyGeometricSvg(source) {
  const visible = source.replace(/<defs\b[\s\S]*?<\/defs\s*>/gi, "");
  const shapes = [...visible.matchAll(/<(path|circle|rect|ellipse|polygon|polyline)\b[^>]*>/gi)];
  if (shapes.length !== 1) return false;
  const [markup, tag] = shapes[0];
  if (["circle", "rect", "ellipse"].includes(tag.toLowerCase())) return true;
  if (tag.toLowerCase() === "polygon") {
    const points = /\bpoints\s*=\s*["']([^"']+)/i.exec(markup)?.[1]?.trim().split(/[\s,]+/);
    return Boolean(points && points.length <= 8);
  }
  if (tag.toLowerCase() !== "path") return false;
  const pathData = /\bd\s*=\s*["']([^"']+)/i.exec(markup)?.[1] ?? "";
  const commands = pathData.match(/[a-z]/gi) ?? [];
  const closedSingleShape = commands.filter((command) => command.toLowerCase() === "m").length === 1
    && commands.some((command) => command.toLowerCase() === "z");
  const rectangular = closedSingleShape
    && commands.every((command) => "mhlvz".includes(command.toLowerCase()))
    && commands.length <= 7;
  const circular = closedSingleShape
    && commands.every((command) => "maz".includes(command.toLowerCase()))
    && commands.filter((command) => command.toLowerCase() === "a").length <= 4;
  return rectangular || circular;
}

async function isEmptyGeometricRaster(filename, treatment) {
  const { data, info } = await sharp(filename)
    .ensureAlpha()
    .resize(64, 64, { fit: "contain" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  const channels = [[], [], []];
  let strongPixels = 0;
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const offset = pixel * info.channels;
    const alpha = data[offset + 3];
    if (alpha <= 32) continue;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
    if (alpha < 180) continue;
    strongPixels += 1;
    channels[0].push(data[offset]);
    channels[1].push(data[offset + 1]);
    channels[2].push(data[offset + 2]);
  }
  if (right < left || bottom < top || strongPixels < 32) return false;
  const width = right - left + 1;
  const height = bottom - top + 1;
  const occupancy = strongPixels / (width * height);
  const aspect = width / height;
  const colourDeviation = Math.max(...channels.map((values) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  }));
  const squareOrCircle = aspect >= 0.7 && aspect <= 1.43 && occupancy >= 0.72;
  const solidRectangle = occupancy >= 0.9;
  const renderedColourIsFlattened = treatment !== "original";
  return (colourDeviation <= 12 || renderedColourIsFlattened) && (squareOrCircle || solidRectangle);
}

for (const entry of manifest.entries) {
  if (!entry.logo?.path) continue;
  if (entry.logo.assetFormat === "svg") {
    const logoPath = path.join(root, "public", entry.logo.path.replace(/^\//, ""));
    if (isEmptyGeometricSvg(await readFile(logoPath, "utf8"))) {
      reviewById.set(entry.id, { id: entry.id, reason: "empty-geometric-mark" });
    }
  } else if (entry.logo.assetFormat === "png") {
    const logoPath = path.join(root, "public", entry.logo.path.replace(/^\//, ""));
    if (await isEmptyGeometricRaster(logoPath, entry.logo.logoTreatment)) {
      reviewById.set(entry.id, { id: entry.id, reason: "empty-geometric-mark" });
    }
  }
  const auditResult = auditById.get(entry.id);
  const matchesAuditedAsset = auditResult
    && auditResult.currentPath === entry.logo.path
    && auditResult.currentProvider === entry.logo.provider
    && (auditResult.currentLookup ?? null) === (entry.logo.lookup ?? null);

  if (!reviewById.has(entry.id) && matchesAuditedAsset && auditResult.status === "review") {
    reviewById.set(entry.id, {
      id: entry.id,
      reason: "visual-mismatch",
      similarity: auditResult.similarity,
    });
  } else if (!reviewById.has(entry.id) && matchesAuditedAsset && ["current-unreadable", "comparison-failed"].includes(auditResult.status)) {
    reviewById.set(entry.id, { id: entry.id, reason: "unreadable" });
  }

  if (!reviewById.has(entry.id) && entry.logo.lookup === "name") {
    reviewById.set(entry.id, { id: entry.id, reason: "name-lookup" });
  }

  if (!reviewById.has(entry.id) && entry.logoStatus === "low-resolution") {
    reviewById.set(entry.id, { id: entry.id, reason: "low-resolution" });
  }
}

const reasonPriority = {
  unreadable: 0,
  "empty-geometric-mark": 1,
  "low-resolution": 2,
  "visual-mismatch": 3,
  "name-lookup": 4,
};
const entries = [...reviewById.values()].sort((left, right) => (
  reasonPriority[left.reason] - reasonPriority[right.reason]
  || (left.similarity ?? Number.POSITIVE_INFINITY) - (right.similarity ?? Number.POSITIVE_INFINITY)
  || left.id.localeCompare(right.id)
));
const reasonCounts = Object.fromEntries(Object.keys(reasonPriority).map((reason) => [
  reason,
  entries.filter((entry) => entry.reason === reason).length,
]));
const output = {
  manifestGeneratedAt: manifest.generatedAt,
  sourceAuditGeneratedAt: audit.generatedAt,
  methodology: {
    visualMismatch: `Current logo differs from the exact exchange+ticker cross-check below similarity ${audit.methodology.reviewThreshold}.`,
    nameLookup: "Logo was resolved from a company-name lookup rather than an exchange-qualified ticker.",
    emptyGeometricMark: "Isolated SVG contains only a plain circle, square, rectangle, or similarly empty closed shape.",
    limitation: "These are review candidates, not confirmed errors; alternate official marks can legitimately differ.",
  },
  summary: {
    total: entries.length,
    ...reasonCounts,
  },
  entries,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Catalog review index: ${entries.length} current logo assets written to ${path.relative(root, outputPath)}`);
