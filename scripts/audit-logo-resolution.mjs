import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXACT_TICKER_LOGO_RESOLUTION_FLOOR,
  LOGO_RESOLUTION_FLOOR,
  measureLogoResolution,
  resolutionFailureMessage,
} from "./logo-resolution.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"))
  ?? "public/logos/catalog/manifest.json";
const manifestPath = path.resolve(root, manifestArgument);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const candidates = manifest.entries.filter((entry) => entry.logo?.sourcePath);
const measurements = new Map();
const results = new Array(candidates.length);
let nextIndex = 0;
let completed = 0;

async function worker() {
  while (nextIndex < candidates.length) {
    const index = nextIndex;
    nextIndex += 1;
    const entry = candidates[index];
    const sourcePath = path.join(root, "public", entry.logo.sourcePath.replace(/^\//, ""));
    const exactTickerSource = entry.logo.provider === "wikimedia-commons" && entry.logo.lookup === "wikidata-ticker";
    const floor = exactTickerSource ? EXACT_TICKER_LOGO_RESOLUTION_FLOOR : LOGO_RESOLUTION_FLOOR;
    const cacheKey = `${sourcePath}:${JSON.stringify(entry.logo.crop ?? null)}:${exactTickerSource ? "exact" : "general"}`;
    let measurementPromise = measurements.get(cacheKey);
    if (!measurementPromise) {
      measurementPromise = measureLogoResolution(sourcePath, entry.logo.crop, floor);
      measurements.set(cacheKey, measurementPromise);
    }
    try {
      const measurement = await measurementPromise;
      results[index] = {
        id: entry.id,
        exchange: entry.exchange,
        symbol: entry.symbol,
        company: entry.company,
        provider: entry.logo.provider,
        sourcePath: entry.logo.sourcePath,
        ...measurement,
        error: measurement.passes ? null : resolutionFailureMessage(measurement, floor),
      };
    } catch (error) {
      results[index] = {
        id: entry.id,
        exchange: entry.exchange,
        symbol: entry.symbol,
        company: entry.company,
        provider: entry.logo.provider,
        sourcePath: entry.logo.sourcePath,
        passes: false,
        reasons: ["unreadable"],
        error: error.message,
      };
    }
    completed += 1;
    if (completed % 500 === 0 || completed === candidates.length) {
      console.log(`Measured ${completed}/${candidates.length} logo sources.`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(32, candidates.length) }, worker));
const failures = results
  .filter((result) => !result.passes)
  .sort((left, right) => (left.sharpness ?? -1) - (right.sharpness ?? -1));
const report = {
  generatedAt: new Date().toISOString(),
  manifest: path.relative(root, manifestPath),
  floors: {
    general: LOGO_RESOLUTION_FLOOR,
    exactWikidataTicker: EXACT_TICKER_LOGO_RESOLUTION_FLOOR,
  },
  summary: {
    catalogEntries: manifest.entries.length,
    measured: results.length,
    passed: results.length - failures.length,
    belowFloor: failures.length,
    unresolvedWithoutLogo: manifest.entries.length - candidates.length,
  },
  failures,
};
const reportDirectory = path.dirname(manifestPath);
const reportPath = path.join(reportDirectory, "logo-resolution-report.json");
const csvPath = path.join(reportDirectory, "logo-resolution-report.csv");
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = [
  ["exchange", "symbol", "company", "provider", "width", "height", "sharpness", "translucent_pixel_share", "soft_visible_pixel_share", "reasons", "source_path", "error"],
  ...failures.map((result) => [
    result.exchange,
    result.symbol,
    result.company,
    result.provider,
    result.width,
    result.height,
    result.sharpness,
    result.translucentPixelShare,
    result.softVisiblePixelShare,
    result.reasons.join("|"),
    result.sourcePath,
    result.error,
  ]),
].map((row) => row.map(csvCell).join(",")).join("\n");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(csvPath, `${csv}\n`, "utf8");
console.log(`Resolution floor: ${LOGO_RESOLUTION_FLOOR.minimumRasterDimension}px long edge, ${LOGO_RESOLUTION_FLOOR.minimumRasterShortDimension}px short edge, ${LOGO_RESOLUTION_FLOOR.minimumSharpness.toFixed(2)} effective sharpness, and alpha integrity.`);
console.log(`Exact Wikidata ticker floor: ${EXACT_TICKER_LOGO_RESOLUTION_FLOOR.minimumRasterDimension}px long edge and ${EXACT_TICKER_LOGO_RESOLUTION_FLOOR.minimumRasterShortDimension}px short edge with the same sharpness and alpha checks.`);
console.log(`Below floor: ${failures.length}/${results.length}.`);
console.log(`Reports written to ${reportPath} and ${csvPath}.`);
