import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logoSignature, logoSimilarity } from "./logo-similarity.mjs";
import { downloadTradingViewLogo, findTradingViewLogoCandidates } from "./tradingview-logo-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arguments_ = process.argv.slice(2);
const manifestArgument = arguments_.find((argument) => !argument.startsWith("--"));
const concurrencyArgument = arguments_.find((argument) => argument.startsWith("--concurrency="));
const limitArgument = arguments_.find((argument) => argument.startsWith("--limit="));
const thresholdArgument = arguments_.find((argument) => argument.startsWith("--threshold="));
const manifestPath = path.resolve(root, manifestArgument ?? "public/logos/catalog/manifest.json");
const concurrency = Math.max(1, Math.min(32, Number(concurrencyArgument?.split("=")[1] ?? 16)));
const limit = limitArgument ? Math.max(1, Number(limitArgument.split("=")[1])) : undefined;
const reviewThreshold = Math.max(0, Math.min(1, Number(thresholdArgument?.split("=")[1] ?? 0.48)));
const reportStem = limit ? `logo-source-audit-${limit}` : "logo-source-audit";
const reportPath = path.join(root, "artifacts", `${reportStem}.json`);
const csvPath = path.join(root, "artifacts", `${reportStem}.csv`);

function publicFile(publicPath) {
  return path.join(root, "public", publicPath.replace(/^\//, ""));
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = limit ? manifest.entries.slice(0, limit) : manifest.entries;
const rows = entries.map((entry) => ({ exchange: entry.exchange, symbol: entry.symbol }));
const tradingViewCandidates = await findTradingViewLogoCandidates(rows, {
  onBatch: ({ candidates, completed, total }) => {
    console.log(`TradingView symbols ${completed}/${total} · ${candidates} exact logo matches`);
  },
});

const currentSignatureCache = new Map();
const tradingViewSignatureCache = new Map();
async function currentSignature(entry) {
  if (!entry.logo?.path) return undefined;
  if (!currentSignatureCache.has(entry.logo.path)) {
    currentSignatureCache.set(entry.logo.path, logoSignature(publicFile(entry.logo.path)));
  }
  return currentSignatureCache.get(entry.logo.path);
}
async function tradingViewSignature(candidate) {
  if (!tradingViewSignatureCache.has(candidate.logoid)) {
    tradingViewSignatureCache.set(candidate.logoid, (async () => {
      const download = await downloadTradingViewLogo(candidate);
      return logoSignature(download.bytes);
    })());
  }
  return tradingViewSignatureCache.get(candidate.logoid);
}

const results = new Array(entries.length);
let nextIndex = 0;
let completed = 0;
async function worker() {
  while (nextIndex < entries.length) {
    const index = nextIndex;
    nextIndex += 1;
    const entry = entries[index];
    const candidate = tradingViewCandidates.get(entry.id);
    const base = {
      id: entry.id,
      company: entry.company,
      exchange: entry.exchange,
      symbol: entry.symbol,
      currentProvider: entry.logo?.provider ?? null,
      currentLookup: entry.logo?.lookup ?? null,
      currentPath: entry.logo?.path ?? null,
      tradingViewLogoid: candidate?.logoid ?? null,
      tradingViewSourceUrl: candidate?.sourceUrl ?? null,
      tradingViewAssetUrl: candidate?.downloadUrl ?? null,
    };
    try {
      if (!candidate) {
        results[index] = { ...base, status: "tradingview-missing", similarity: null };
      } else if (!entry.logo?.path) {
        results[index] = { ...base, status: "current-missing", similarity: null };
      } else if (entry.logo.provider === "tradingview" && entry.logo.tradingViewLogoid === candidate.logoid) {
        results[index] = { ...base, status: "same-tradingview-source", similarity: 1 };
      } else {
        let catalogSignature;
        try {
          catalogSignature = await currentSignature(entry);
        } catch (error) {
          results[index] = { ...base, status: "current-unreadable", similarity: null, error: error.message };
          completed += 1;
          continue;
        }
        let exactSignature;
        try {
          exactSignature = await tradingViewSignature(candidate);
        } catch (error) {
          results[index] = { ...base, status: "tradingview-unreadable", similarity: null, error: error.message };
          completed += 1;
          continue;
        }
        const score = logoSimilarity(catalogSignature, exactSignature);
        results[index] = {
          ...base,
          status: score < reviewThreshold ? "review" : "likely-match",
          similarity: score,
        };
      }
    } catch (error) {
      results[index] = { ...base, status: "comparison-failed", similarity: null, error: error.message };
    }
    completed += 1;
    if (completed % 250 === 0 || completed === entries.length) {
      const reviewCount = results.filter((result) => result?.status === "review").length;
      console.log(`Compared ${completed}/${entries.length} · ${reviewCount} review candidates`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));

const statusCounts = {};
const providerCounts = {};
for (const result of results) {
  statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
  const provider = result.currentProvider ?? "none";
  providerCounts[provider] = (providerCounts[provider] ?? 0) + 1;
}
const report = {
  generatedAt: new Date().toISOString(),
  manifest: path.relative(root, manifestPath),
  manifestGeneratedAt: manifest.generatedAt,
  methodology: {
    exactMatchKey: "exchange+ticker",
    currentAsset: "processed renderer asset from the catalog manifest",
    logoDevSource: "cached local catalog snapshot; the audit makes no automated bulk requests to Logo.dev",
    comparison: "blurred, scale-normalized alpha-shape overlap and cosine similarity",
    reviewThreshold,
    limitation: "A review result is a visual discrepancy, not an automatic assertion that either provider is correct.",
  },
  summary: {
    total: results.length,
    tradingViewResolved: tradingViewCandidates.size,
    tradingViewCoverage: Number((tradingViewCandidates.size / results.length).toFixed(4)),
    status: statusCounts,
    currentProvider: providerCounts,
  },
  results,
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const csvHeaders = [
  "id", "company", "exchange", "symbol", "status", "similarity", "currentProvider", "currentLookup",
  "currentPath", "tradingViewLogoid", "tradingViewSourceUrl", "tradingViewAssetUrl", "error",
];
const reviewRows = results
  .filter((result) => result.status !== "likely-match" && result.status !== "same-tradingview-source")
  .sort((left, right) => (left.similarity ?? -1) - (right.similarity ?? -1));
const csv = [
  csvHeaders.join(","),
  ...reviewRows.map((result) => csvHeaders.map((header) => csvCell(result[header])).join(",")),
].join("\n");
await writeFile(csvPath, `${csv}\n`, "utf8");

const reportHash = createHash("sha256").update(JSON.stringify(report.summary)).digest("hex").slice(0, 12);
console.log(`Audit written to ${reportPath}`);
console.log(`Review queue written to ${csvPath}`);
console.log(JSON.stringify({ ...report.summary, reportHash }, null, 2));
