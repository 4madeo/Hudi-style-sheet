import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiKey = process.env.SERPAPI_API_KEY;
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const concurrencyArgument = process.argv.find((argument) => argument.startsWith("--concurrency="));
const manifestArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"))
  ?? "public/logos/catalog/manifest.json";
const manifestPath = path.resolve(root, manifestArgument);
const outputPath = path.join(root, "artifacts/serpapi-logo-candidates.json");
const csvPath = path.join(root, "artifacts/serpapi-logo-candidates.csv");
const limit = Math.max(1, Math.min(250, Number(limitArgument?.split("=")[1] ?? 250)));
const concurrency = Math.max(1, Math.min(6, Number(concurrencyArgument?.split("=")[1] ?? 3)));

if (!apiKey) throw new Error("SERPAPI_API_KEY is required.");

const stopWords = new Set([
  "ag", "and", "class", "co", "company", "corp", "corporation", "fund", "group", "holding",
  "holdings", "inc", "international", "investment", "limited", "ltd", "ordinary", "plc", "shares",
  "the", "trust", "unit", "units", "warrant", "warrants",
]);
const noisyDomains = [
  "alamy.", "amazon.", "dreamstime.", "facebook.", "instagram.", "linkedin.", "pinterest.",
  "shutterstock.", "stock.adobe.", "tiktok.", "vectorstock.", "x.com", "youtube.",
];

function normalizedName(value) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function nameTokens(value) {
  return normalizedName(value).split(" ").filter((token) => token.length >= 3 && !stopWords.has(token));
}

function localeFor(exchange) {
  if (exchange === "KRX") return { gl: "kr", hl: "ko", logoWord: "공식 로고" };
  if (["HKEX", "SSE", "SZSE"].includes(exchange)) return { gl: "cn", hl: "zh-cn", logoWord: "官方 logo" };
  if (exchange === "TSE") return { gl: "jp", hl: "ja", logoWord: "公式 ロゴ" };
  return { gl: "us", hl: "en", logoWord: "official logo" };
}

function queryFor(entries) {
  const primary = entries[0];
  const symbols = entries.slice(0, 4).map((entry) => `${entry.exchange}:${entry.symbol}`).join(" OR ");
  return `"${primary.company}" ${localeFor(primary.exchange).logoWord} ${symbols}`;
}

function candidateScore(result, company) {
  const original = String(result.original ?? "");
  const link = String(result.link ?? "");
  const source = String(result.source ?? "");
  const title = String(result.title ?? "");
  const haystack = normalizedName(`${title} ${source} ${link}`);
  const tokens = nameTokens(company);
  const tokenMatches = tokens.filter((token) => haystack.includes(token)).length;
  const width = Number(result.original_width ?? 0);
  const height = Number(result.original_height ?? 0);
  const aspect = width > 0 && height > 0 ? width / height : 0;
  let score = Math.max(0, 24 - Number(result.position ?? 100)) + tokenMatches * 14;
  if (/\bofficial\b|公式|官方|공식/iu.test(`${title} ${source}`)) score += 18;
  if (/\blogo\b|ロゴ|로고/iu.test(title)) score += 12;
  if (/\.svg(?:$|[?#])/i.test(original)) score += 20;
  else if (/\.png(?:$|[?#])/i.test(original)) score += 12;
  if (aspect >= 0.55 && aspect <= 1.8) score += 8;
  if (Math.min(width, height) >= 256) score += 6;
  if (result.unsafe || result.is_product) score -= 30;
  if (noisyDomains.some((domain) => `${original} ${link}`.toLocaleLowerCase().includes(domain))) score -= 35;
  return score;
}

function sanitizeCandidate(result, company) {
  return {
    position: Number(result.position ?? 0),
    score: candidateScore(result, company),
    title: String(result.title ?? ""),
    source: String(result.source ?? ""),
    pageUrl: String(result.link ?? ""),
    imageUrl: String(result.original ?? ""),
    thumbnailUrl: String(result.thumbnail ?? ""),
    width: Number(result.original_width ?? 0),
    height: Number(result.original_height ?? 0),
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeOutputs(state) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.write`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporaryPath, outputPath);
  const rows = [["company", "listing_ids", "query", "rank", "score", "title", "source", "page_url", "image_url", "width", "height"]];
  for (const search of Object.values(state.searches)) {
    search.candidates.forEach((candidate, index) => rows.push([
      search.company,
      search.listingIds.join(" "),
      search.query,
      index + 1,
      candidate.score,
      candidate.title,
      candidate.source,
      candidate.pageUrl,
      candidate.imageUrl,
      candidate.width,
      candidate.height,
    ]));
  }
  await writeFile(csvPath, `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
}

let writeQueue = Promise.resolve();
function persistOutputs(state) {
  writeQueue = writeQueue.then(() => writeOutputs(state));
  return writeQueue;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const unresolved = manifest.entries.filter((entry) => !entry.logo);
const grouped = new Map();
for (const entry of unresolved) {
  const key = normalizedName(entry.company);
  const group = grouped.get(key) ?? [];
  group.push(entry);
  grouped.set(key, group);
}
const priority = { missing: 0, failed: 1, "low-resolution": 2, "duplicate-review": 3 };
const groups = [...grouped.entries()].sort((left, right) => {
  const leftPriority = Math.min(...left[1].map((entry) => priority[entry.logoStatus] ?? 9));
  const rightPriority = Math.min(...right[1].map((entry) => priority[entry.logoStatus] ?? 9));
  return leftPriority - rightPriority || left[0].localeCompare(right[0]);
});
let state = { generatedAt: new Date().toISOString(), manifestGeneratedAt: manifest.generatedAt, searches: {} };
try {
  const previous = JSON.parse(await readFile(outputPath, "utf8"));
  state = { ...state, searches: previous.searches ?? {} };
} catch {
  // First run; the credential and raw SerpAPI responses are never cached.
}

const pending = groups.filter(([key]) => !state.searches[key]).slice(0, limit);
let nextIndex = 0;
let completed = 0;

async function searchGroup(key, entries) {
  const query = queryFor(entries);
  const locale = localeFor(entries[0].exchange);
  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google_images",
    q: query,
    ijn: "0",
    safe: "active",
    gl: locale.gl,
    hl: locale.hl,
  });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  const body = await response.json();
  if (!response.ok || body.error) {
    const message = String(body.error ?? `HTTP ${response.status}`).replaceAll(apiKey, "[redacted]");
    if (response.status === 401 || response.status === 429 || /api key|limit|quota|account|plan/i.test(message)) {
      throw new Error(message);
    }
    state.searches[key] = {
      searchedAt: new Date().toISOString(),
      company: entries[0].company,
      listingIds: entries.map((entry) => entry.id),
      statuses: [...new Set(entries.map((entry) => entry.logoStatus))],
      query,
      resultCount: 0,
      candidates: [],
      error: message,
    };
    completed += 1;
    await persistOutputs(state);
    console.log(`${completed}/${pending.length} · ${entries[0].company} · no results`);
    return;
  }
  const candidates = (body.images_results ?? [])
    .filter((result) => /^https?:\/\//i.test(String(result.original ?? "")))
    .map((result) => sanitizeCandidate(result, entries[0].company))
    .sort((left, right) => right.score - left.score || left.position - right.position)
    .slice(0, 8);
  state.searches[key] = {
    searchedAt: new Date().toISOString(),
    company: entries[0].company,
    listingIds: entries.map((entry) => entry.id),
    statuses: [...new Set(entries.map((entry) => entry.logoStatus))],
    query,
    resultCount: Number(body.images_results?.length ?? 0),
    candidates,
  };
  completed += 1;
  await persistOutputs(state);
  console.log(`${completed}/${pending.length} · ${entries[0].company} · ${candidates.length} staged`);
}

async function worker() {
  while (nextIndex < pending.length) {
    const index = nextIndex;
    nextIndex += 1;
    const [key, entries] = pending[index];
    await searchGroup(key, entries);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
state.generatedAt = new Date().toISOString();
await persistOutputs(state);
console.log(`Used ${completed} new SerpAPI searches; ${Object.keys(state.searches).length}/${groups.length} unresolved companies now have staged candidates.`);
console.log(`Candidate reports: ${path.relative(root, outputPath)} and ${path.relative(root, csvPath)}`);
