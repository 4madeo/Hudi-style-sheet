import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { contrastRatio, correctLogoContrast, LOGO_CONTRAST_TRIGGER, logoContrastBackground } from "./logo-contrast.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.resolve(root, process.argv.slice(2).find((value) => !value.startsWith("--")) ?? "public/logos/catalog/manifest.json");
const outputPath = path.resolve(root, process.argv.find((value) => value.startsWith("--output="))?.slice(9) ?? "artifacts/logo-contrast-audit.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function rgb(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  return match ? { r: Number.parseInt(match[1], 16), g: Number.parseInt(match[2], 16), b: Number.parseInt(match[3], 16) } : undefined;
}

function luminance({ r, g, b }) {
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];
}

function treatedColour(colour, treatment) {
  if (treatment === "light") return { r: 255, g: 255, b: 255 };
  if (treatment === "dark") return { r: 0, g: 0, b: 0 };
  if (treatment === "lift" || treatment === "tint") {
    const slope = treatment === "tint" ? 0.4 : 0.16;
    const intercept = treatment === "tint" ? 0.55 : 0.8;
    return {
      r: Math.min(255, colour.r * slope + 255 * intercept),
      g: Math.min(255, colour.g * slope + 255 * intercept),
      b: Math.min(255, colour.b * slope + 255 * intercept),
    };
  }
  if (treatment === "deepen") return { r: colour.r * 0.48, g: colour.g * 0.48, b: colour.b * 0.48 };
  return colour;
}

function touchesTransparency(data, width, height, channels, x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return true;
      if (data[(nextY * width + nextX) * channels + 3] < 48) return true;
    }
  }
  return false;
}

async function analyse(entry) {
  const logoPath = path.join(root, "public", entry.logo.path.replace(/^\/+/, ""));
  const logoBytes = await readFile(logoPath);
  const { data, info } = await sharp(logoBytes, { density: 192 })
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const wordmark = entry.logo.crop?.width / Math.max(0.001, entry.logo.crop?.height ?? 0) >= 2.25;
  const background = logoContrastBackground(rgb(entry.logo.orbColour));
  const boundaryTrigger = LOGO_CONTRAST_TRIGGER;
  const originalLuminance = [];
  const treatedLuminance = [];
  let boundary = 0;
  let lowBoundary = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset + 3] < 160) continue;
      const original = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      const treated = treatedColour(original, entry.logo.logoTreatment);
      originalLuminance.push(luminance(original));
      treatedLuminance.push(luminance(treated));
      if (background && touchesTransparency(data, info.width, info.height, info.channels, x, y)) {
        boundary += 1;
        if (contrastRatio(treated, background) < boundaryTrigger) lowBoundary += 1;
      }
    }
  }
  originalLuminance.sort((left, right) => left - right);
  treatedLuminance.sort((left, right) => left - right);
  const originalContrast = (percentile(originalLuminance, 0.92) + 0.05) / (percentile(originalLuminance, 0.08) + 0.05);
  const treatedContrast = (percentile(treatedLuminance, 0.92) + 0.05) / (percentile(treatedLuminance, 0.08) + 0.05);
  const contrastPreserved = treatedContrast / Math.max(1, originalContrast);
  const lowBoundaryShare = lowBoundary / Math.max(1, boundary);
  const reasons = [];
  if (["lift", "tint", "deepen"].includes(entry.logo.logoTreatment)
    && originalContrast >= 1.8
    && (treatedContrast < 1.45 || contrastPreserved < 0.45)) reasons.push("treatment-washout");
  if (lowBoundaryShare >= 0.55 && treatedContrast < 1.6) reasons.push("low-exterior-contrast");
  if (lowBoundaryShare >= 0.3 && !entry.logo.logoContrastAdjustment) {
    const proposed = await correctLogoContrast(logoBytes, entry.logo.assetFormat, entry.logo.orbColour, { wordmark });
    if (proposed.kind !== "none") reasons.push("pipeline-correction-available");
  }
  if (!reasons.length) return undefined;
  const highConfidence = (
    reasons.includes("treatment-washout")
    && ["lift", "tint"].includes(entry.logo.logoTreatment)
    && lowBoundaryShare < 0.25
    && treatedContrast < 1.35
    && contrastPreserved < 0.3
  ) || reasons.includes("pipeline-correction-available")
    || (reasons.includes("low-exterior-contrast") && lowBoundaryShare >= 0.8);
  return {
    id: entry.id,
    company: entry.company,
    path: entry.logo.path,
    treatment: entry.logo.logoTreatment,
    reasons,
    confidence: highConfidence ? "high" : "review",
    originalContrast: Number(originalContrast.toFixed(2)),
    treatedContrast: Number(treatedContrast.toFixed(2)),
    contrastPreserved: Number(contrastPreserved.toFixed(2)),
    lowBoundaryShare: Number(lowBoundaryShare.toFixed(3)),
    score: Number(((highConfidence ? 100 : 0) + reasons.length * 10 + (1 - Math.min(1, contrastPreserved)) * 5 + lowBoundaryShare * 3).toFixed(2)),
  };
}

const candidates = manifest.entries.filter((entry) => entry.logo?.path && entry.logo?.orbColour);
const findings = [];
let cursor = 0;
async function worker() {
  while (cursor < candidates.length) {
    const entry = candidates[cursor];
    cursor += 1;
    try {
      const result = await analyse(entry);
      if (result) findings.push(result);
    } catch (error) {
      findings.push({ id: entry.id, company: entry.company, path: entry.logo.path, reasons: ["unreadable"], error: error.message, score: 100 });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(16, candidates.length) }, worker));
findings.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
const report = {
  generatedAt: new Date().toISOString(),
  manifest: path.relative(root, manifestPath),
  inspected: candidates.length,
  flagged: findings.length,
  highConfidence: findings.filter((entry) => entry.confidence === "high").length,
  reasons: Object.fromEntries([...new Set(findings.flatMap((entry) => entry.reasons))].map((reason) => [reason, findings.filter((entry) => entry.reasons.includes(reason)).length])),
  entries: findings,
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
const csvPath = outputPath.replace(/\.json$/i, ".csv");
const csv = (value) => /[",\n]/.test(String(value ?? "")) ? `"${String(value ?? "").replaceAll('"', '""')}"` : String(value ?? "");
const rows = [
  ["id", "company", "confidence", "reasons", "treatment", "original_contrast", "treated_contrast", "contrast_preserved", "low_boundary_share", "path"],
  ...findings.map((entry) => [entry.id, entry.company, entry.confidence, entry.reasons.join("|"), entry.treatment, entry.originalContrast, entry.treatedContrast, entry.contrastPreserved, entry.lowBoundaryShare, entry.path]),
];
await writeFile(csvPath, `${rows.map((row) => row.map(csv).join(",")).join("\n")}\n`, "utf8");
console.log(`Contrast audit: ${findings.length} flagged of ${candidates.length} logos. Wrote ${path.relative(root, outputPath)} and ${path.relative(root, csvPath)}.`);
