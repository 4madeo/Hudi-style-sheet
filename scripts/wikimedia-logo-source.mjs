import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const endpoint = "https://query.wikidata.org/sparql";
const commonsEndpoint = "https://commons.wikimedia.org/w/api.php";
const userAgent = "HUDIOrbCatalog/0.1 (exchange-qualified company-logo fallback)";
let nextDownloadStart = 0;
let downloadQueue = Promise.resolve();
const execFileAsync = promisify(execFile);

const exchangeLabels = {
  HKEX: new Set(["hong kong stock exchange"]),
  KRX: new Set(["korea exchange", "korea stock exchange", "kosdaq"]),
  NASDAQ: new Set(["nasdaq"]),
  NYSE: new Set(["new york stock exchange"]),
  SSE: new Set(["shanghai stock exchange"]),
  SZSE: new Set(["shenzhen stock exchange"]),
  TSE: new Set(["tokyo stock exchange"]),
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sparqlString(value) {
  return `"${String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")}"`;
}

function tickerVariants(row) {
  const variants = new Set([row.symbol]);
  if (row.exchange === "HKEX" && /^0+\d+$/.test(row.symbol)) {
    variants.add(row.symbol.replace(/^0+(?=\d)/, ""));
  }
  return [...variants];
}

function batchQuery(rows) {
  const values = rows.flatMap((row) => tickerVariants(row).map((ticker) => (
    `(${sparqlString(`${row.exchange}:${row.symbol}`)} ${sparqlString(ticker)})`
  ))).join(" ");

  return `
SELECT DISTINCT ?requested ?company ?companyLabel ?exchange ?exchangeLabel ?logo WHERE {
  VALUES (?requested ?ticker) { ${values} }
  ?company p:P414 ?exchangeStatement.
  ?exchangeStatement ps:P414 ?exchange; pq:P249 ?ticker.
  ?company wdt:P154 ?logo.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

async function fetchBatch(rows) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const body = new URLSearchParams({ format: "json", query: batchQuery(rows) });
      const response = await fetch(endpoint, {
        method: "POST",
        body,
        headers: {
          Accept: "application/sparql-results+json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": userAgent,
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay([1_000, 3_000, 8_000, 16_000][attempt]);
    }
  }
  throw lastError ?? new Error("Wikidata query failed");
}

function logoPreference(binding) {
  const filename = decodeURIComponent(new URL(binding.logo.value).pathname).toLowerCase();
  let score = filename.endsWith(".svg") ? 2 : 0;
  if (/\b(white|inverted|monochrome|wordmark|old|former|historical)\b/.test(filename)) score -= 2;
  if (/\b(icon|symbol|mark|logo)\b/.test(filename)) score += 1;
  return score;
}

function bindingCandidate(binding) {
  const sourceUrl = binding.logo.value.replace(/^http:/, "https:");
  const source = new URL(sourceUrl);
  const fileTitle = `File:${decodeURIComponent(source.pathname.split("/").pop()).replaceAll("_", " ")}`;
  source.pathname = source.pathname.replace("/wiki/Special:FilePath/", "/wiki/Special:Redirect/file/");
  source.searchParams.set("width", "512");
  return {
    company: binding.companyLabel?.value ?? null,
    downloadUrl: source.toString(),
    exchange: binding.exchangeLabel.value,
    fileTitle,
    sourceUrl,
    wikidataEntity: binding.company.value,
  };
}

async function fetchCommonsMetadata(candidates) {
  let lastError;
  const retryDelays = [5_000, 10_000, 20_000, 40_000, 60_000, 90_000];
  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      const body = new URLSearchParams({
        action: "query",
        format: "json",
        prop: "imageinfo",
        iiprop: "extmetadata|url",
        iiurlwidth: "512",
        redirects: "1",
        titles: candidates.map((candidate) => candidate.fileTitle).join("|"),
      });
      const response = await fetch(commonsEndpoint, {
        method: "POST",
        body,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": userAgent,
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (response.status === 429 || response.status >= 500) {
        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? Math.min(retryAfterSeconds * 1_000, 90_000)
          : retryDelays[Math.min(attempt, retryDelays.length - 1)];
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt < 6) {
          await delay(wait);
          continue;
        }
        throw lastError;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 6) await delay(retryDelays[Math.min(attempt, retryDelays.length - 1)]);
    }
  }
  throw lastError ?? new Error("Wikimedia Commons metadata request failed");
}

function normalizedFileTitle(value) {
  return value.replace(/^File:/i, "").replaceAll("_", " ").toLowerCase();
}

async function attachCommonsMetadata(candidates, options) {
  const values = [...candidates.values()];
  const batchSize = 40;
  for (let offset = 0; offset < values.length; offset += batchSize) {
    const batch = values.slice(offset, offset + batchSize);
    const result = await fetchCommonsMetadata(batch);
    const pages = Object.values(result.query?.pages ?? {});
    const pagesByTitle = new Map(pages.map((page) => [normalizedFileTitle(page.title), page]));
    const titleAliases = new Map([
      ...(result.query?.normalized ?? []),
      ...(result.query?.redirects ?? []),
    ].map((alias) => [normalizedFileTitle(alias.from), normalizedFileTitle(alias.to)]));
    for (const candidate of batch) {
      let resolvedTitle = normalizedFileTitle(candidate.fileTitle);
      const visited = new Set();
      while (titleAliases.has(resolvedTitle) && !visited.has(resolvedTitle)) {
        visited.add(resolvedTitle);
        resolvedTitle = titleAliases.get(resolvedTitle);
      }
      const page = pagesByTitle.get(resolvedTitle);
      const imageInfo = page?.imageinfo?.[0];
      const metadata = imageInfo?.extmetadata ?? {};
      candidate.downloadUrl = imageInfo?.url ?? imageInfo?.thumburl ?? candidate.downloadUrl;
      candidate.commonsPageUrl = imageInfo?.descriptionurl ?? candidate.sourceUrl;
      candidate.license = metadata.LicenseShortName?.value ?? metadata.UsageTerms?.value ?? null;
      candidate.licenseUrl = metadata.LicenseUrl?.value ?? null;
      candidate.attributionRequired = metadata.AttributionRequired?.value ?? null;
    }
    options.onMetadataBatch?.({
      completed: Math.min(offset + batch.length, values.length),
      total: values.length,
    });
    if (offset + batchSize < values.length) {
      await delay(options.metadataBatchDelay ?? 1_200);
    }
  }
}

export async function findWikimediaLogoCandidates(rows, options = {}) {
  const batchSize = Math.max(20, Math.min(250, options.batchSize ?? 120));
  const candidates = new Map();
  const expectedRows = new Map(rows.map((row) => [`${row.exchange}:${row.symbol}`, row]));

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const result = await fetchBatch(batch);
    const grouped = new Map();
    for (const binding of result.results?.bindings ?? []) {
      const id = binding.requested?.value;
      const row = expectedRows.get(id);
      const acceptedLabels = exchangeLabels[row?.exchange];
      if (!row || !acceptedLabels?.has(binding.exchangeLabel?.value.toLowerCase())) continue;
      const group = grouped.get(id) ?? [];
      group.push(binding);
      grouped.set(id, group);
    }
    for (const [id, bindings] of grouped) {
      bindings.sort((left, right) => logoPreference(right) - logoPreference(left));
      candidates.set(id, bindingCandidate(bindings[0]));
    }
    options.onBatch?.({
      candidates: candidates.size,
      completed: Math.min(offset + batch.length, rows.length),
      total: rows.length,
    });
  }

  if (options.includeLicenseMetadata && candidates.size) {
    await attachCommonsMetadata(candidates, options);
  }

  return candidates;
}

export async function downloadWikimediaLogo(candidate) {
  let lastError;
  const retryDelays = [1_000, 3_000];
  const originalUrl = new URL(candidate.downloadUrl);
  const thumbnailPrefix = "/wikipedia/commons/thumb/";
  if (originalUrl.hostname === "upload.wikimedia.org" && originalUrl.pathname.startsWith(thumbnailPrefix)) {
    const [firstHash, secondHash, filename] = originalUrl.pathname.slice(thumbnailPrefix.length).split("/");
    originalUrl.pathname = `/wikipedia/commons/${firstHash}/${secondHash}/${filename}`;
    originalUrl.search = "";
  }
  const redirectUrl = new URL(candidate.sourceUrl);
  redirectUrl.pathname = redirectUrl.pathname.replace("/wiki/Special:FilePath/", "/wiki/Special:Redirect/file/");
  redirectUrl.searchParams.set("width", "512");
  const downloadUrls = [...new Set([originalUrl.toString(), candidate.downloadUrl, redirectUrl.toString()])];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const downloadUrl of downloadUrls) {
      try {
      let releaseQueue;
      const priorDownload = downloadQueue;
      downloadQueue = new Promise((resolve) => { releaseQueue = resolve; });
      await priorDownload;
      if (nextDownloadStart > Date.now()) await delay(nextDownloadStart - Date.now());
      nextDownloadStart = Date.now() + 1_000;
      releaseQueue();

      const { stdout } = await execFileAsync("curl", [
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--max-time",
        "30",
        downloadUrl,
      ], { encoding: "buffer", maxBuffer: 16_000_000 });
      const bytes = Buffer.from(stdout);
      if (bytes.length > 15_000_000) throw new Error("source exceeds 15 MB");
      if (bytes.length < 64) throw new Error("source is empty or unreadable");
      const input = sharp(bytes, { density: 192, limitInputPixels: 100_000_000 });
      const metadata = await input.metadata();
      const preservedBytes = metadata.format === "svg"
        ? bytes
        : await input
          .resize({
            width: 1024,
            height: 1024,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();
      return {
        bytes: preservedBytes,
        provider: "wikimedia-commons",
        lookup: "wikidata-ticker",
        query: candidate.company,
        sourceUrl: candidate.sourceUrl,
        wikidataEntity: candidate.wikidataEntity,
        commonsPageUrl: candidate.commonsPageUrl,
        sourceLicense: candidate.license,
        sourceLicenseUrl: candidate.licenseUrl,
        attributionRequired: candidate.attributionRequired,
        sourceFormat: metadata.format ?? null,
      };
      } catch (error) {
        lastError = error;
      }
    }
    if (attempt < 2) await delay(retryDelays[attempt]);
  }
  throw lastError ?? new Error("Wikimedia logo request failed");
}
