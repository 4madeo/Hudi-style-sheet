import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { deriveBrandColourFromLogo, detectLogoColourMode, dominantChromaticColour } from "./brand-colour.mjs";
import {
  EXACT_TICKER_LOGO_RESOLUTION_FLOOR,
  measureLogoResolution,
  resolutionFailureMessage,
} from "./logo-resolution.mjs";
import { logoSignature, logoSimilarity } from "./logo-similarity.mjs";
import { manualLogoOverrides } from "./manual-logo-overrides.mjs";
import { canvasEdgeLineInsets, stripExtractedCanvasEdgeLines } from "./png-logo-processing.mjs";
import {
  downloadSimpleIconsLogo,
  findSimpleIconsBrandColourCandidates,
  findSimpleIconsLogoCandidates,
} from "./simple-icons-logo-source.mjs";
import { buildIsolatedVectorLogo, isSvgBytes, prepareVectorLogo } from "./svg-logo-processing.mjs";
import { downloadWikimediaLogo, findWikimediaLogoCandidates } from "./wikimedia-logo-source.mjs";
import { downloadTradingViewLogo, findTradingViewLogoCandidates } from "./tradingview-logo-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pngAdjustmentDocument = JSON.parse(await readFile(path.join(root, "data/png-logo-adjustments.json"), "utf8"));
const pngLogoAdjustments = new Map(pngAdjustmentDocument.adjustments.map((adjustment) => [adjustment.sourceSha256, adjustment]));
const token = process.env.LOGO_DEV_PUBLISHABLE_KEY;
const csvPath = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const concurrencyArgument = process.argv.find((argument) => argument.startsWith("--concurrency="));
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const reprocessIdsArgument = process.argv.find((argument) => argument.startsWith("--reprocess-ids="));
const serpApiDecisionsArgument = process.argv.find((argument) => argument.startsWith("--serpapi-decisions="));
const fromManifest = process.argv.includes("--from-manifest");
const materializeOpenSources = process.argv.includes("--materialize-open-sources");
const noOpenDownloads = process.argv.includes("--no-open-downloads");
const preferTradingView = process.argv.includes("--prefer-tradingview");
const preferTradingViewAll = process.argv.includes("--prefer-tradingview-all");
const refreshTradingView = process.argv.includes("--refresh-tradingview");
const refreshLogoDevSvg = process.argv.includes("--refresh-logo-dev-svg");
const revalidate = process.argv.includes("--revalidate");
const reprocess = process.argv.includes("--reprocess");
const reprocessAutoEmblems = process.argv.includes("--reprocess-auto-emblems");
const reprocessNeutralBackgrounds = process.argv.includes("--reprocess-neutral-backgrounds");
const refreshPresentation = process.argv.includes("--refresh-presentation");
const skipTradingView = process.argv.includes("--skip-tradingview");
const skipWikimedia = process.argv.includes("--skip-wikimedia");
const effectiveSkipTradingView = skipTradingView || materializeOpenSources;
const concurrency = Math.max(1, Math.min(32, Number(concurrencyArgument?.split("=")[1] ?? (materializeOpenSources ? 4 : 12))));
const limit = limitArgument ? Math.max(1, Number(limitArgument.split("=")[1])) : undefined;
const reprocessIds = reprocessIdsArgument
  ? new Set(reprocessIdsArgument.split("=").slice(1).join("=").split(",").map((id) => id.trim()).filter(Boolean))
  : undefined;

if (preferTradingView && !reprocessIds?.size) {
  throw new Error("--prefer-tradingview requires an explicit --reprocess-ids list.");
}
if (preferTradingView && preferTradingViewAll) {
  throw new Error("Use either --prefer-tradingview or --prefer-tradingview-all, not both.");
}
if (materializeOpenSources && !fromManifest) {
  throw new Error("--materialize-open-sources requires --from-manifest so unmatched listings retain their existing local asset or HUDI fallback.");
}
if (noOpenDownloads && !materializeOpenSources) {
  throw new Error("--no-open-downloads requires --materialize-open-sources.");
}

if (token && !token.startsWith("pk_")) {
  throw new Error("LOGO_DEV_PUBLISHABLE_KEY must be a Logo.dev publishable pk_ key.");
}
if (!csvPath && !fromManifest) {
  throw new Error("Usage: npm run import:catalog -- /absolute/path/to/listings.csv [options], --from-manifest, or --from-manifest /path/to/overlay.csv");
}

const referenceAliases = {
  "HKEX:9988": "BABA-HK",
  "HKEX:1211": "BYD",
  "HKEX:3690": "MEITUAN",
  "HKEX:0100": "MINIMAX",
  "HKEX:0700": "TENCENT",
  "KRX:034020": "DOOSANENERB",
  "KRX:247540": "ECOPROBM",
  "KRX:042700": "HANMI",
  "KRX:012450": "HANWHAAERO",
  "KRX:042660": "HANWHAOCEAN",
  "KRX:272210": "HANWHASYS",
  "KRX:267260": "HDHYUNDAIELEC",
  "KRX:009540": "HDKSOE",
  "KRX:011200": "HMM",
  "KRX:005380": "HYUNDAI",
  "KRX:047810": "KAI",
  "KRX:373220": "LGES",
  "KRX:005930": "SAMSUNG",
  "KRX:000660": "SKHYNIX",
  "NASDAQ:META": "META",
  "NASDAQ:MU": "MICRON",
  "NASDAQ:MSFT": "MSFT",
  "NASDAQ:MSTR": "MSTR",
  "NASDAQ:NVDA": "NVDA",
  "NASDAQ:SNDK": "SANDISK",
  "NASDAQ:TSLA": "TSLA",
  "TSE:6857": "ADVANTEST",
  "TSE:5803": "FUJIKURA",
  "TSE:4062": "IBIDEN",
  "TSE:8001": "ITOCHU",
  "TSE:285A": "KIOXIA",
  "TSE:7974": "NINTENDO",
  "TSE:9984": "SOFTBANK",
  "TSE:6758": "SONY",
  "TSE:8035": "TOKYOELEC",
};

// Source-specific geometry is only used when the provider image contains an
// outer app-tile/container that cannot be separated from the mark by colour
// alone. Keep these overrides exchange-qualified and auditable.
const logoProcessingOverrides = {
  "HKEX:0308": {
    sourceCrop: { left: 0.15, top: 0.12, width: 0.7, height: 0.76 },
    backgroundTolerance: 40,
    containerRemoved: true,
  },
  "HKEX:6099": {
    stripVisibleElementIndexes: [0, 1],
    deriveOrbColourFromSource: true,
  },
  "HKEX:1310": {
    // The blue square is HKBN's emblem, not a removable app-tile container.
    retainContainer: true,
  },
};

const exchangeSuffixes = {
  CMDTY: [""],
  FX: [""],
  HKEX: [".HK"],
  INDEX: [""],
  KRX: [".KS", ".KQ"],
  NASDAQ: [""],
  NYSE: [""],
  SSE: [".SS"],
  SZSE: [".SZ"],
  TSE: [".T"],
  TWSE: [".TW"],
};

function parseCsv(value) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows;
  if (!headers) return [];
  headers[0] = headers[0].replace(/^\uFEFF/, "");
  return records
    .filter((record) => record.some(Boolean))
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function mergeListingRows(baseRows, overlayRows) {
  const overlayIds = new Set();
  const merged = new Map(baseRows.map((row) => [`${row.exchange}:${row.symbol}`, row]));
  for (const row of overlayRows) {
    const id = `${row.exchange}:${row.symbol}`;
    if (overlayIds.has(id)) throw new Error(`Duplicate overlay listing ${id}`);
    overlayIds.add(id);
    merged.set(id, row);
  }
  return [...merged.values()];
}

function fileExists(filename) {
  return access(filename).then(() => true, () => false);
}

function safeStem(symbol) {
  const base = symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "symbol";
  if (/^[a-z0-9]+$/i.test(symbol)) return base;
  const hash = createHash("sha1").update(symbol).digest("hex").slice(0, 8);
  return `${base}-${hash}`;
}

function publicPath(filename) {
  return `/${path.relative(path.join(root, "public"), filename).split(path.sep).join("/")}`;
}

function localPublicPath(value) {
  return path.join(root, "public", value.replace(/^\/+/, ""));
}

function previousAssetPath(previous, key, fallback) {
  return previous?.logo?.[key] ? localPublicPath(previous.logo[key]) : fallback;
}

function sourceFormatFromUrl(value) {
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    return pathname.match(/\.(svg|png|jpe?g|gif|webp)(?:\/|$)/i)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function isPng(bytes) {
  return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchLogoDevAsset(url, format) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (response.status === 404) return undefined;
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`);
        await delay([400, 1_200, 3_000, 6_000][attempt]);
        continue;
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.nonRetryable = true;
        throw error;
      }
      if (format === "svg" && !isSvgBytes(bytes)) return undefined;
      if (format === "png" && !isPng(bytes)) throw new Error(`expected PNG, received ${response.headers.get("content-type") ?? "unknown"}`);
      return bytes;
    } catch (error) {
      lastError = error;
      if (error.nonRetryable) throw error;
      if (attempt < 3) await delay([400, 1_200, 3_000, 6_000][attempt]);
    }
  }
  throw lastError ?? new Error("Logo request failed");
}

function logoUrl(kind, query, format) {
  const params = new URLSearchParams({
    token,
    format,
    size: "512",
    fallback: "404",
    theme: "light",
  });
  return `https://img.logo.dev/${kind}/${encodeURIComponent(query)}?${params}`;
}

async function downloadStagedCandidate(candidate) {
  const parsed = new URL(candidate.imageUrl);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("invalid staged image URL");
  }
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLocaleLowerCase())) {
    throw new Error("local staged image URLs are not allowed");
  }
  const response = await fetch(parsed, {
    headers: { "user-agent": "Mozilla/5.0 HUDI-logo-review/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 15_000_000) throw new Error("staged image exceeds 15 MB");
  const original = Buffer.from(await response.arrayBuffer());
  if (original.length > 15_000_000) throw new Error("staged image exceeds 15 MB");
  const metadata = await sharp(original, { density: 576 }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("staged image has no readable dimensions");
  const bytes = await sharp(original, { density: 576 }).png().toBuffer();
  return {
    bytes,
    provider: "serpapi-google-images",
    lookup: "manually-reviewed-company-image",
    query: candidate.company,
    sourceUrl: candidate.imageUrl,
    sourcePageUrl: candidate.pageUrl,
    sourceTitle: candidate.title,
  };
}

async function downloadManualLogo(candidate) {
  return {
    bytes: candidate.bytes,
    provider: "manual-review",
    lookup: "user-supplied-reference",
    query: candidate.id,
    sourceFormat: candidate.sourceFormat ?? "png",
    manualAssetHash: candidate.hash,
  };
}

async function downloadLogo(row, exactCandidates, preferExact = false) {
  const suffixes = exchangeSuffixes[row.exchange];
  if (!suffixes) throw new Error(`Unsupported exchange ${row.exchange}`);

  const errors = [];
  const tryManual = async () => exactCandidates.manual
    ? downloadManualLogo(exactCandidates.manual)
    : undefined;
  const trySerpApi = async () => {
    if (!exactCandidates.serpApi) return undefined;
    try {
      return await downloadStagedCandidate(exactCandidates.serpApi);
    } catch (error) {
      errors.push(`Reviewed Google Images candidate ${error.message}`);
      return undefined;
    }
  };
  const tryTradingView = async () => {
    if (!exactCandidates.tradingView) return undefined;
    try {
      return await downloadTradingViewLogo(exactCandidates.tradingView);
    } catch (error) {
      errors.push(`TradingView ${error.message}`);
      return undefined;
    }
  };
  const tryWikimedia = async () => {
    if (!exactCandidates.wikimedia) return undefined;
    try {
      return await downloadWikimediaLogo(exactCandidates.wikimedia);
    } catch (error) {
      errors.push(`Wikimedia ${error.message}`);
      return undefined;
    }
  };
  const trySimpleIcons = async () => {
    if (!exactCandidates.simpleIcons) return undefined;
    try {
      return await downloadSimpleIconsLogo(exactCandidates.simpleIcons);
    } catch (error) {
      errors.push(`Simple Icons ${error.message}`);
      return undefined;
    }
  };

  if (preferExact) {
    const manual = await tryManual();
    if (manual) return manual;
    const serpApi = await trySerpApi();
    if (serpApi) return serpApi;
    const tradingView = await tryTradingView();
    if (tradingView) return tradingView;
    const wikimedia = await tryWikimedia();
    if (wikimedia) return wikimedia;
    const simpleIcon = await trySimpleIcons();
    if (simpleIcon) return simpleIcon;
  }

  if (token) {
    for (const suffix of suffixes) {
      const ticker = `${row.symbol}${suffix}`;
      for (const format of ["svg", "png"]) {
        try {
          const bytes = await fetchLogoDevAsset(logoUrl("ticker", ticker, format), format);
          if (bytes) return { bytes, provider: "logo.dev", lookup: "ticker", query: ticker, sourceFormat: format };
        } catch (error) {
          errors.push(`Logo.dev ticker ${ticker} ${format.toUpperCase()}: ${error.message}`);
        }
      }
    }
  }

  if (!preferExact) {
    const manual = await tryManual();
    if (manual) return manual;
    const serpApi = await trySerpApi();
    if (serpApi) return serpApi;
    const tradingView = await tryTradingView();
    if (tradingView) return tradingView;
    const wikimedia = await tryWikimedia();
    if (wikimedia) return wikimedia;
    const simpleIcon = await trySimpleIcons();
    if (simpleIcon) return simpleIcon;
  }

  // Name lookup is deliberately last. It may resolve an unrelated person or
  // site that happens to share the issuer's short name or domain.
  if (token) {
    for (const format of ["svg", "png"]) {
      try {
        const bytes = await fetchLogoDevAsset(logoUrl("name", row.name, format), format);
        if (bytes) return { bytes, provider: "logo.dev", lookup: "name", query: row.name, sourceFormat: format };
      } catch (error) {
        errors.push(`Logo.dev name ${row.name} ${format.toUpperCase()}: ${error.message}`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join("; "));
  return undefined;
}

async function looksLikePhotograph(filename) {
  try {
    const { data } = await sharp(filename)
      .resize(64, 64, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const colours = new Set();
    const borderColours = new Map();
    let transparent = 0;
    let borderPixels = 0;

    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        const offset = (y * 64 + x) * 4;
        colours.add(`${data[offset] >> 3},${data[offset + 1] >> 3},${data[offset + 2] >> 3}`);
        if (data[offset + 3] < 245) transparent += 1;
        if (x < 3 || x > 60 || y < 3 || y > 60) {
          borderPixels += 1;
          const key = `${data[offset] >> 4},${data[offset + 1] >> 4},${data[offset + 2] >> 4}`;
          borderColours.set(key, (borderColours.get(key) ?? 0) + 1);
        }
      }
    }

    const dominantBorderShare = Math.max(...borderColours.values()) / borderPixels;
    return transparent / (64 * 64) < 0.01
      && colours.size > 300
      && dominantBorderShare < 0.45;
  } catch {
    return false;
  }
}

function colourDistance(left, right) {
  return Math.max(
    Math.abs(left.r - right.r),
    Math.abs(left.g - right.g),
    Math.abs(left.b - right.b),
  );
}

function borderBackground(data, width, height, channels) {
  const counts = new Map();
  const border = Math.max(2, Math.round(Math.min(width, height) * 0.025));
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x >= border && x < width - border && y >= border && y < height - border) continue;
      const offset = (y * width + x) * channels;
      const key = `${data[offset] >> 3},${data[offset + 1] >> 3},${data[offset + 2] >> 3}`;
      const bucket = counts.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += data[offset];
      bucket.g += data[offset + 1];
      bucket.b += data[offset + 2];
      counts.set(key, bucket);
    }
  }
  const mode = [...counts.values()].sort((left, right) => right.count - left.count)[0];
  return mode
    ? { r: Math.round(mode.r / mode.count), g: Math.round(mode.g / mode.count), b: Math.round(mode.b / mode.count) }
    : { r: 255, g: 255, b: 255 };
}

function dominantOpaqueBackground(data, width, height, channels) {
  const counts = new Map();
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * channels;
      if (data[offset + 3] < 220) continue;
      const key = `${data[offset] >> 3},${data[offset + 1] >> 3},${data[offset + 2] >> 3}`;
      const bucket = counts.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += data[offset];
      bucket.g += data[offset + 1];
      bucket.b += data[offset + 2];
      counts.set(key, bucket);
    }
  }
  const mode = [...counts.values()].sort((left, right) => right.count - left.count)[0];
  return mode
    ? { r: Math.round(mode.r / mode.count), g: Math.round(mode.g / mode.count), b: Math.round(mode.b / mode.count) }
    : { r: 255, g: 255, b: 255 };
}

function dominantOpaqueColour(data, mask, width, bounds) {
  const counts = new Map();
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      const offset = pixel * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const key = `${r >> 3},${g >> 3},${b >> 3}`;
      const bucket = counts.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      counts.set(key, bucket);
    }
  }
  const mode = [...counts.values()].sort((left, right) => right.count - left.count)[0];
  return mode
    ? { r: Math.round(mode.r / mode.count), g: Math.round(mode.g / mode.count), b: Math.round(mode.b / mode.count) }
    : undefined;
}

function foregroundBounds(mask, width, height, region = { left: 0, top: 0, right: width, bottom: height }) {
  let left = region.right;
  let top = region.bottom;
  let right = region.left - 1;
  let bottom = region.top - 1;
  let pixels = 0;
  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1) {
      if (!mask[y * width + x]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      pixels += 1;
    }
  }
  return right >= left ? { left, top, right: right + 1, bottom: bottom + 1, pixels } : undefined;
}

function stripRectangularContainer(data, mask, width, height, bounds) {
  const foregroundWidth = bounds.right - bounds.left;
  const foregroundHeight = bounds.bottom - bounds.top;
  const area = foregroundWidth * foregroundHeight;
  if (area < 256 || bounds.pixels / area < 0.18) return undefined;

  const colour = dominantOpaqueColour(data, mask, width, bounds);
  if (!colour) return undefined;

  const tolerance = 30;
  const matte = new Uint8Array(width * height);
  let mattePixels = 0;
  let distinctPixels = 0;
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      const offset = pixel * 4;
      const candidate = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      if (colourDistance(candidate, colour) <= tolerance) {
        matte[pixel] = 1;
        mattePixels += 1;
      } else {
        distinctPixels += 1;
      }
    }
  }

  // Containers are dense surfaces with a smaller contrasting mark inside.
  // A lower threshold also admits broad single glyphs (C, D, N, and similar),
  // which then get hollowed out into the same outline-only failure as a
  // multi-line wordmark.
  if (mattePixels / area < 0.82 || distinctPixels / area < 0.002) return undefined;

  const band = Math.max(2, Math.round(Math.min(foregroundWidth, foregroundHeight) * 0.035));
  const sideCoverage = [
    { left: bounds.left, top: bounds.top, right: Math.min(bounds.right, bounds.left + band), bottom: bounds.bottom },
    { left: Math.max(bounds.left, bounds.right - band), top: bounds.top, right: bounds.right, bottom: bounds.bottom },
    { left: bounds.left, top: bounds.top, right: bounds.right, bottom: Math.min(bounds.bottom, bounds.top + band) },
    { left: bounds.left, top: Math.max(bounds.top, bounds.bottom - band), right: bounds.right, bottom: bounds.bottom },
  ].map((region) => {
    let pixels = 0;
    const regionArea = (region.right - region.left) * (region.bottom - region.top);
    for (let y = region.top; y < region.bottom; y += 1) {
      for (let x = region.left; x < region.right; x += 1) pixels += matte[y * width + x];
    }
    return pixels / regionArea;
  });
  const averageSideCoverage = sideCoverage.reduce((sum, value) => sum + value, 0) / sideCoverage.length;
  const horizontalContainer = Math.min(sideCoverage[0], sideCoverage[1]) >= 0.55
    && (sideCoverage[0] + sideCoverage[1]) / 2 >= 0.7;
  const verticalContainer = Math.min(sideCoverage[2], sideCoverage[3]) >= 0.55
    && (sideCoverage[2] + sideCoverage[3]) / 2 >= 0.7;
  // A real rectangular tile reaches every side of its own bounds. Requiring
  // only one axis also matches ordinary wordmarks: the first and last glyphs
  // can cover the left/right bands even though there is no surrounding tile.
  // Stripping those marks erases their solid fill and leaves an antialiased
  // outline behind.
  if (!horizontalContainer || !verticalContainer || averageSideCoverage < 0.22) return undefined;

  // Edge coverage must also belong to one continuous matte. Separate glyphs
  // in a dense, multi-line wordmark can collectively reach all four sides,
  // but they do not form the connected surface of a tile behind the mark.
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(area);
  let containerComponent;
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const start = y * width + x;
      if (!matte[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      let componentPixels = 0;
      const touches = [false, false, false, false];
      queue[tail++] = start;
      visited[start] = 1;
      while (head < tail) {
        const pixel = queue[head++];
        const pixelX = pixel % width;
        const pixelY = Math.floor(pixel / width);
        componentPixels += 1;
        if (pixelX < bounds.left + band) touches[0] = true;
        if (pixelX >= bounds.right - band) touches[1] = true;
        if (pixelY < bounds.top + band) touches[2] = true;
        if (pixelY >= bounds.bottom - band) touches[3] = true;

        const neighbours = [];
        if (pixelX > bounds.left) neighbours.push(pixel - 1);
        if (pixelX + 1 < bounds.right) neighbours.push(pixel + 1);
        if (pixelY > bounds.top) neighbours.push(pixel - width);
        if (pixelY + 1 < bounds.bottom) neighbours.push(pixel + width);
        for (const neighbour of neighbours) {
          if (!matte[neighbour] || visited[neighbour]) continue;
          visited[neighbour] = 1;
          queue[tail++] = neighbour;
        }
      }
      if (!containerComponent || componentPixels > containerComponent.pixels) {
        containerComponent = { pixels: componentPixels, touches };
      }
    }
  }
  if (!containerComponent
    || containerComponent.pixels / mattePixels < 0.55
    || !containerComponent.touches.every(Boolean)) return undefined;

  const distinctMask = new Uint8Array(width * height);
  for (let pixel = 0; pixel < distinctMask.length; pixel += 1) {
    if (mask[pixel] && !matte[pixel]) distinctMask[pixel] = 1;
  }
  const distinctBounds = foregroundBounds(distinctMask, width, height, bounds);
  if (!distinctBounds) return undefined;
  const distinctWidth = distinctBounds.right - distinctBounds.left;
  const distinctHeight = distinctBounds.bottom - distinctBounds.top;
  const isInset = distinctWidth <= foregroundWidth * 0.98 || distinctHeight <= foregroundHeight * 0.98;
  if (!isInset) return undefined;

  // A removable tile must reveal a substantive inner mark. Colour gradients
  // inside a single glyph can otherwise look like a matte plus contrasting
  // content even though stripping them leaves only weak edge antialiasing.
  let retainedStrongPixels = 0;
  let retainedLeft = bounds.right;
  let retainedTop = bounds.bottom;
  let retainedRight = bounds.left - 1;
  let retainedBottom = bounds.top - 1;
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      const offset = pixel * 4;
      const candidate = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      const distance = colourDistance(candidate, colour);
      const retainedAlpha = data[offset + 3] * Math.max(0, Math.min(1, (distance - tolerance) / 18));
      if (retainedAlpha > 96) retainedStrongPixels += 1;
      if (retainedAlpha > 24) {
        retainedLeft = Math.min(retainedLeft, x);
        retainedTop = Math.min(retainedTop, y);
        retainedRight = Math.max(retainedRight, x);
        retainedBottom = Math.max(retainedBottom, y);
      }
    }
  }
  if (retainedStrongPixels < Math.max(2, Math.round(area * 0.0002))) return undefined;
  const retainedWidth = retainedRight - retainedLeft + 1;
  const retainedHeight = retainedBottom - retainedTop + 1;
  if (retainedWidth <= 0 || retainedHeight <= 0
    || Math.max(retainedWidth / retainedHeight, retainedHeight / retainedWidth) > 15) return undefined;

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      const offset = pixel * 4;
      const candidate = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      const distance = colourDistance(candidate, colour);
      data[offset + 3] = Math.round(data[offset + 3] * Math.max(0, Math.min(1, (distance - tolerance) / 18)));
      mask[pixel] = data[offset + 3] > 24 ? 1 : 0;
    }
  }

  return { colour, sideCoverage, matteShare: mattePixels / area };
}

function gapRuns(projection, start, end, threshold) {
  const runs = [];
  let runStart;
  for (let index = start; index <= end; index += 1) {
    const isGap = index < end && projection[index] <= threshold;
    if (isGap && runStart === undefined) runStart = index;
    if (!isGap && runStart !== undefined) {
      runs.push({ start: runStart, end: index, size: index - runStart });
      runStart = undefined;
    }
  }
  return runs;
}

function emblemCrop(mask, width, height, full) {
  const fullWidth = full.right - full.left;
  const fullHeight = full.bottom - full.top;
  if (fullWidth / fullHeight >= 1.85) {
    const columns = new Uint32Array(width);
    for (let y = full.top; y < full.bottom; y += 1) {
      for (let x = full.left; x < full.right; x += 1) {
        if (mask[y * width + x]) columns[x] += 1;
      }
    }
    const gaps = gapRuns(columns, full.left, full.right, Math.max(1, Math.round(fullHeight * 0.004)))
      .filter((gap) => gap.size >= Math.max(5, Math.round(fullWidth * 0.055)));
    const split = gaps.find((gap) => {
      const candidate = foregroundBounds(mask, width, height, {
        left: full.left,
        top: full.top,
        right: gap.start,
        bottom: full.bottom,
      });
      if (!candidate) return false;
      const candidateWidth = candidate.right - candidate.left;
      const candidateHeight = candidate.bottom - candidate.top;
      const candidateAspect = candidateWidth / candidateHeight;
      const remainingWidth = full.right - gap.end;
      return candidateAspect >= 0.65
        && candidateAspect <= 1.45
        && candidateHeight >= fullHeight * 0.72
        && candidateWidth >= fullWidth * 0.14
        && candidateWidth <= fullWidth * 0.3
        && remainingWidth >= candidateWidth * 1.6;
    });
    if (split) {
      const bounds = foregroundBounds(mask, width, height, {
        left: full.left,
        top: full.top,
        right: split.start,
        bottom: full.bottom,
      });
      if (bounds) return { bounds, mode: "auto-emblem" };
    }
  }

  const rows = new Uint32Array(height);
  for (let y = full.top; y < full.bottom; y += 1) {
    for (let x = full.left; x < full.right; x += 1) {
      if (mask[y * width + x]) rows[y] += 1;
    }
  }
  const horizontalGaps = gapRuns(rows, full.top, full.bottom, Math.max(1, Math.round(fullWidth * 0.004)))
    .filter((gap) => gap.size >= Math.max(5, Math.round(fullHeight * 0.06)));
  const horizontalSplit = horizontalGaps.find((gap) => {
    const candidate = foregroundBounds(mask, width, height, {
      left: full.left,
      top: full.top,
      right: full.right,
      bottom: gap.start,
    });
    if (!candidate) return false;
    const candidateWidth = candidate.right - candidate.left;
    const candidateHeight = candidate.bottom - candidate.top;
    const candidateAspect = candidateWidth / candidateHeight;
    const remainingHeight = full.bottom - gap.end;
    const centre = (candidate.left + candidate.right) / 2;
    const fullCentre = (full.left + full.right) / 2;
    return candidateAspect >= 0.65
      && candidateAspect <= 1.6
      && candidateWidth <= fullWidth * 0.6
      && candidateHeight >= fullHeight * 0.2
      && remainingHeight >= candidateHeight * 0.8
      && Math.abs(centre - fullCentre) <= fullWidth * 0.18;
  });
  if (horizontalSplit) {
    const bounds = foregroundBounds(mask, width, height, {
      left: full.left,
      top: full.top,
      right: full.right,
      bottom: horizontalSplit.start,
    });
    if (bounds) return { bounds, mode: "auto-emblem" };
  }

  return { bounds: full, mode: "full-mark" };
}

function hexColour(colour) {
  return `#${[colour.r, colour.g, colour.b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(colour) {
  const channels = [colour.r, colour.g, colour.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function parseSvgColour(value) {
  const input = String(value ?? "").trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/.exec(input);
  if (short) return Object.fromEntries(["r", "g", "b"].map((key, index) => [key, Number.parseInt(short[1][index].repeat(2), 16)]));
  const full = /^#([0-9a-f]{6})$/.exec(input);
  if (full) return { r: Number.parseInt(full[1].slice(0, 2), 16), g: Number.parseInt(full[1].slice(2, 4), 16), b: Number.parseInt(full[1].slice(4, 6), 16) };
  const rgb = /^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/.exec(input);
  if (rgb) return { r: Math.min(255, Number(rgb[1])), g: Math.min(255, Number(rgb[2])), b: Math.min(255, Number(rgb[3])) };
  return ({ black: { r: 0, g: 0, b: 0 }, white: { r: 255, g: 255, b: 255 }, red: { r: 255, g: 0, b: 0 } })[input];
}

function isUsefulBrandColour(colour) {
  if (!colour) return false;
  const max = Math.max(colour.r, colour.g, colour.b);
  const min = Math.min(colour.r, colour.g, colour.b);
  return max - min >= 35 && relativeLuminance(colour) > 0.025 && relativeLuminance(colour) < 0.94;
}

function averageSvgColours(values) {
  const colours = (values ?? []).map(parseSvgColour).filter(Boolean);
  if (!colours.length) return undefined;
  return {
    r: Math.round(colours.reduce((sum, colour) => sum + colour.r, 0) / colours.length),
    g: Math.round(colours.reduce((sum, colour) => sum + colour.g, 0) / colours.length),
    b: Math.round(colours.reduce((sum, colour) => sum + colour.b, 0) / colours.length),
  };
}

async function processLogo(sourcePath, outputPath, {
  provider,
  preserveFullMark = false,
  autoCropEmblem = false,
  sourceCrop,
  excludeRegions = [],
  backgroundTolerance = 30,
  lightPixelThreshold,
  stripCanvasEdgeLines = false,
  retainContainer = false,
  containerRemoved: forcedContainerRemoval = false,
  stripVisibleElementIndexes,
  deriveOrbColourFromSource = false,
} = {}) {
  const sourceBytes = await readFile(sourcePath);
  const sourceBrandColour = deriveOrbColourFromSource
    ? await deriveBrandColourFromLogo(sourceBytes)
    : undefined;
  const preparedVector = prepareVectorLogo(sourceBytes, {
    stripCanvasBackground: provider === "tradingview",
    stripVisibleElementIndexes,
  });
  // TradingView serves compact SVGs (commonly 56x56). Rasterize vector input
  // near the final output size so its antialiasing is not enlarged into fuzzy
  // edges and detached colour pixels during the later 512px normalization.
  const { data, info } = await sharp(preparedVector?.analysisBytes ?? sourceBytes, { density: 576 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  const mask = new Uint8Array(info.width * info.height);
  let transparentPixels = 0;
  for (let offset = 3; offset < data.length; offset += info.channels) {
    if (data[offset] < 245) transparentPixels += 1;
  }
  const hasTransparency = transparentPixels > info.width * info.height * 0.001;
  const opaqueCoverage = 1 - (transparentPixels / (info.width * info.height));
  // A transparent mark may legitimately occupy half of its square canvas
  // (Apple is a common example). Only treat the dominant opaque colour as a
  // matte when it covers almost the entire response.
  const removeDominantFill = hasTransparency && opaqueCoverage > 0.88;
  const edgeInsets = stripCanvasEdgeLines
    ? canvasEdgeLineInsets(data, info.width, info.height, info.channels)
    : { left: 0, top: 0, right: 0, bottom: 0 };
  const background = removeDominantFill
    ? dominantOpaqueBackground(data, info.width, info.height, info.channels)
    : borderBackground(data, info.width, info.height, info.channels);

  function extractForeground(tolerance) {
    mask.fill(0);
    for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
      const sourceOffset = pixel * info.channels;
      const targetOffset = pixel * 4;
      const colour = { r: data[sourceOffset], g: data[sourceOffset + 1], b: data[sourceOffset + 2] };
      const sourceAlpha = data[sourceOffset + 3];
      const distance = colourDistance(colour, background);
      const sourceX = pixel % info.width;
      const sourceY = Math.floor(pixel / info.width);
      const withinSourceCrop = !sourceCrop || (
        sourceX >= Math.floor(sourceCrop.left * info.width)
        && sourceX < Math.ceil((sourceCrop.left + sourceCrop.width) * info.width)
        && sourceY >= Math.floor(sourceCrop.top * info.height)
        && sourceY < Math.ceil((sourceCrop.top + sourceCrop.height) * info.height)
      );
      const withinExcludedRegion = excludeRegions.some((region) => (
        sourceX >= Math.floor(region.left * info.width)
        && sourceX < Math.ceil((region.left + region.width) * info.width)
        && sourceY >= Math.floor(region.top * info.height)
        && sourceY < Math.ceil((region.top + region.height) * info.height)
      ));
      const withinEdgeInsets = sourceX >= edgeInsets.left
        && sourceX < info.width - edgeInsets.right
        && sourceY >= edgeInsets.top
        && sourceY < info.height - edgeInsets.bottom;
      const lightAlpha = lightPixelThreshold == null
        ? undefined
        : Math.max(0, Math.min(255, Math.round((Math.min(colour.r, colour.g, colour.b) - lightPixelThreshold) * 10.2)));
      const alpha = !withinSourceCrop || withinExcludedRegion || !withinEdgeInsets
        ? 0
        : lightAlpha != null
        ? Math.round(sourceAlpha * lightAlpha / 255)
        : hasTransparency && !removeDominantFill
        ? sourceAlpha
        : Math.round(sourceAlpha * Math.max(0, Math.min(255, Math.round((distance - tolerance) * 10.2))) / 255);
      rgba[targetOffset] = colour.r;
      rgba[targetOffset + 1] = colour.g;
      rgba[targetOffset + 2] = colour.b;
      rgba[targetOffset + 3] = alpha;
      if (alpha > 24) mask[pixel] = 1;
    }
    if (stripCanvasEdgeLines) stripExtractedCanvasEdgeLines(rgba, mask, info.width, info.height);
  }

  let effectiveBackgroundTolerance = backgroundTolerance;
  extractForeground(effectiveBackgroundTolerance);
  let full = foregroundBounds(mask, info.width, info.height);
  if (!full && effectiveBackgroundTolerance > 16) {
    effectiveBackgroundTolerance = 16;
    extractForeground(effectiveBackgroundTolerance);
    full = foregroundBounds(mask, info.width, info.height);
  }
  if (!full) throw new Error("no foreground found");
  let removedContainer = retainContainer
    ? undefined
    : stripRectangularContainer(rgba, mask, info.width, info.height, full);
  if (removedContainer) {
    full = foregroundBounds(mask, info.width, info.height);
    if (!full) {
      extractForeground(effectiveBackgroundTolerance);
      full = foregroundBounds(mask, info.width, info.height);
      removedContainer = undefined;
    }
  }
  const crop = preserveFullMark || !autoCropEmblem
    ? { mode: "full-mark", bounds: full }
    : emblemCrop(mask, info.width, info.height, full);
  const bounds = crop.bounds;
  const foregroundWidth = bounds.right - bounds.left;
  const foregroundHeight = bounds.bottom - bounds.top;
  const foregroundCoverage = bounds.pixels / (foregroundWidth * foregroundHeight);
  const padding = Math.max(4, Math.round(Math.max(foregroundWidth, foregroundHeight) * 0.06));
  const extractedLeft = Math.max(0, bounds.left - padding);
  const extractedTop = Math.max(0, bounds.top - padding);
  const extractedRight = Math.min(info.width, bounds.right + padding);
  const extractedBottom = Math.min(info.height, bounds.bottom + padding);
  const dominant = dominantChromaticColour(rgba, mask, info.width, bounds);
  const logoColourMode = detectLogoColourMode(rgba, mask, info.width, bounds);
  const removedVectorBackground = averageSvgColours(preparedVector?.removedBackgroundColours);
  const removedBackground = removedContainer?.colour ?? removedVectorBackground;
  const useRemovedBackgroundColour = dominant.source === "neutral-fallback" && isUsefulBrandColour(removedBackground);
  const colour = useRemovedBackgroundColour ? removedBackground : dominant.colour;
  const aspect = foregroundWidth / foregroundHeight;
  const logoScale = crop.mode === "auto-emblem" ? 0.54 : aspect > 2.2 ? 0.6 : 0.56;
  const logoTreatment = dominant.source === "logo-derived" || useRemovedBackgroundColour
    ? "original"
    : foregroundCoverage > 0.68
    ? "original"
    : relativeLuminance(colour) > 0.58 ? "dark" : "light";

  const normalizedCrop = {
    left: Number((bounds.left / info.width).toFixed(5)),
    top: Number((bounds.top / info.height).toFixed(5)),
    width: Number((foregroundWidth / info.width).toFixed(5)),
    height: Number((foregroundHeight / info.height).toFixed(5)),
  };
  const preserveVector = Boolean(preparedVector && !removedContainer);
  const resolvedOutputPath = outputPath.replace(/\.[^.]+$/, preserveVector ? ".svg" : ".png");
  const output = preserveVector
    ? buildIsolatedVectorLogo(preparedVector, normalizedCrop, { source: provider })
    : await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({
        left: extractedLeft,
        top: extractedTop,
        width: extractedRight - extractedLeft,
        height: extractedBottom - extractedTop,
      })
      .resize({
        width: 512,
        height: 512,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer();
  const temporaryPath = `${resolvedOutputPath}.process`;
  await writeFile(temporaryPath, output);
  await rename(temporaryPath, resolvedOutputPath);

  return {
    processedPath: resolvedOutputPath,
    bytes: output.length,
    assetFormat: preserveVector ? "svg" : "png",
    cropMode: crop.mode,
    crop: normalizedCrop,
    orbColour: sourceBrandColour?.hex ?? hexColour(colour),
    orbColourSeed: sourceBrandColour?.hex ?? hexColour(colour),
    orbColourSource: sourceBrandColour?.source ?? (useRemovedBackgroundColour ? "removed-background" : dominant.source),
    logoTreatment,
    logoColourMode,
    logoScale,
    ...(logoTreatment === "original" ? { logoColour: hexColour(colour) } : {}),
    ...(preserveVector ? {
      vectorPreserved: true,
      vectorBackgroundElementsRemoved: preparedVector.backgroundElementsRemoved,
    } : preparedVector ? {
      vectorPreserved: false,
      vectorFallbackReason: "container-removal-required-raster-mask",
    } : {}),
    ...(removedContainer || forcedContainerRemoval ? {
      containerRemoved: true,
      containerColour: hexColour(removedBackground ?? background),
    } : {}),
  };
}

function parseReferenceStyles(source) {
  const styles = new Map();
  for (const line of source.split("\n")) {
    const symbol = /symbol: "([^"]+)"/.exec(line)?.[1];
    const logoTreatment = /logoTreatment: "([^"]+)"/.exec(line)?.[1];
    if (!symbol || !logoTreatment) continue;
    styles.set(symbol, {
      logoTreatment,
      logoScale: Number(/logoScale: ([0-9.]+)/.exec(line)?.[1] ?? 0.58),
      logoOffsetY: Number(/logoOffsetY: (-?[0-9.]+)/.exec(line)?.[1] ?? 0),
    });
  }
  return styles;
}

const catalogRoot = path.join(root, "public/logos/catalog");
const sourceRoot = path.join(catalogRoot, "source");
await mkdir(catalogRoot, { recursive: true });
await mkdir(sourceRoot, { recursive: true });
const manifestPath = path.join(catalogRoot, limit ? `manifest-sample-${limit}.json` : "manifest.json");
const existingManifestPath = fromManifest ? path.join(catalogRoot, "manifest.json") : manifestPath;
const previousManifest = await fileExists(existingManifestPath)
  ? JSON.parse(await readFile(existingManifestPath, "utf8"))
  : undefined;
if (fromManifest && !previousManifest) {
  throw new Error(`Cannot use --from-manifest because ${existingManifestPath} does not exist.`);
}

const manifestRows = previousManifest?.entries.map((entry) => ({
    exchange: entry.exchange,
    symbol: entry.symbol,
    name: entry.company,
    sector: entry.sector ?? "",
    source: entry.listingSource ?? "import",
    program_status: entry.programStatus ?? "reference_only",
    supporters: entry.supporters == null ? "" : String(entry.supporters),
    won_at: entry.wonAt ?? "",
    publicly_on_hudi: String(Boolean(entry.publiclyOnHudi)),
  })) ?? [];
const overlayRows = fromManifest && csvPath
  ? parseCsv(await readFile(path.resolve(csvPath), "utf8"))
  : [];
const csvRows = fromManifest
  ? mergeListingRows(manifestRows, overlayRows)
  : parseCsv(await readFile(path.resolve(csvPath), "utf8"));
const rows = limit ? csvRows.slice(0, limit) : csvRows;
const requiredColumns = ["exchange", "symbol", "name", "sector", "source", "program_status", "supporters", "won_at", "publicly_on_hudi"];
if (!rows.length || requiredColumns.some((column) => !(column in rows[0]))) {
  throw new Error(`CSV must contain: ${requiredColumns.join(", ")}`);
}
if (overlayRows.some((row) => requiredColumns.some((column) => !(column in row)))) {
  throw new Error(`Overlay CSV must contain: ${requiredColumns.join(", ")}`);
}
const ids = new Set();
for (const row of rows) {
  const id = `${row.exchange}:${row.symbol}`;
  if (ids.has(id)) throw new Error(`Duplicate listing ${id}`);
  ids.add(id);
  if (!exchangeSuffixes[row.exchange]) throw new Error(`Unsupported exchange ${row.exchange}`);
}

const referenceManifest = JSON.parse(await readFile(path.join(root, "public/logos/manifest.json"), "utf8"));
const referenceStyles = parseReferenceStyles(await readFile(path.join(root, "app/listings.ts"), "utf8"));
const previousEntries = new Map((previousManifest?.entries ?? []).map((entry) => [entry.id, entry]));
const simpleIconBrandColours = findSimpleIconsBrandColourCandidates(rows);
const manualLogoCandidates = new Map();
for (const [id, override] of manualLogoOverrides) {
  if (!ids.has(id)) continue;
  const bytes = await readFile(path.join(root, override.assetPath));
  manualLogoCandidates.set(id, {
    ...override,
    id,
    bytes,
    hash: createHash("sha256").update(bytes).digest("hex"),
    sourceFormat: path.extname(override.assetPath).slice(1).toLowerCase() || "png",
  });
}
const simpleIconCandidates = new Map();
if (materializeOpenSources && !noOpenDownloads) {
  const proposedSimpleIcons = findSimpleIconsLogoCandidates(rows);
  let comparedSimpleIcons = 0;
  for (const [id, candidate] of proposedSimpleIcons) {
    const current = previousEntries.get(id);
    if (!current?.logo?.path) continue;
    const currentPath = path.join(root, "public", current.logo.path.replace(/^\//, ""));
    try {
      const score = logoSimilarity(
        await logoSignature(currentPath),
        await logoSignature(candidate.bytes),
      );
      comparedSimpleIcons += 1;
      if (score >= 0.8) simpleIconCandidates.set(id, { ...candidate, visualSimilarity: score });
    } catch {
      // An unreadable current asset cannot provide independent identity consensus.
    }
  }
  console.log(`Accepted ${simpleIconCandidates.size}/${comparedSimpleIcons} Simple Icons candidates with visual consensus.`);
}
const serpApiCandidates = new Map();
if (serpApiDecisionsArgument) {
  if (!fromManifest) throw new Error("Reviewed SerpAPI candidates can only be applied with --from-manifest.");
  const decisionsPath = path.resolve(root, serpApiDecisionsArgument.split("=").slice(1).join("="));
  const decisions = JSON.parse(await readFile(decisionsPath, "utf8"));
  const reportPath = path.resolve(root, decisions.candidateReport ?? "artifacts/serpapi-logo-candidates.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (report.manifestGeneratedAt !== previousManifest.generatedAt) {
    console.warn("The staged search report predates the manifest; only still-unresolved matching listing IDs will be applied.");
  }
  const searches = Object.values(report.searches ?? {});
  for (const selection of decisions.selections ?? []) {
    const search = searches.find((item) => item.company === selection.company);
    if (!search) throw new Error(`No staged search found for approved company: ${selection.company}`);
    const candidate = search.candidates?.[selection.candidate - 1];
    if (!candidate) throw new Error(`${selection.company}: approved candidate ${selection.candidate} is unavailable`);
    for (const id of search.listingIds) {
      const current = previousEntries.get(id);
      if (!current || (current.logo && !selection.refresh) || current.company !== search.company) continue;
      serpApiCandidates.set(id, {
        ...candidate,
        company: search.company,
        preserveFullMark: Boolean(selection.preserveFullMark),
        reuseCachedSource: Boolean(selection.reuseCachedSource),
      });
    }
  }
  console.log(`Loaded ${serpApiCandidates.size} reviewed Google Images matches from ${path.relative(root, decisionsPath)}.`);
}

const suspiciousSourceIds = new Set();
const ambiguousNameSourceIds = new Set();
const lowResolutionSourceIds = new Set();
const lowResolutionMeasurements = new Map();
if (revalidate) {
  const validationRows = rows.filter((row) => {
    const provider = previousEntries.get(`${row.exchange}:${row.symbol}`)?.logo?.provider;
    return provider && provider !== "mvp-reference" && provider !== "catalog-alias";
  });
  for (const row of validationRows) {
    const id = `${row.exchange}:${row.symbol}`;
    if (previousEntries.get(id)?.logo?.lookup === "name") ambiguousNameSourceIds.add(id);
  }
  let nextValidationIndex = 0;
  async function validationWorker() {
    while (nextValidationIndex < validationRows.length) {
      const row = validationRows[nextValidationIndex];
      nextValidationIndex += 1;
      const id = `${row.exchange}:${row.symbol}`;
      const previousLogo = previousEntries.get(id)?.logo;
      const sourcePath = previousAssetPath(
        previousEntries.get(id),
        "sourcePath",
        path.join(sourceRoot, row.exchange.toLowerCase(), `${safeStem(row.symbol)}.png`),
      );
      if (await fileExists(sourcePath)) {
        if (await looksLikePhotograph(sourcePath)) suspiciousSourceIds.add(id);
        let measurement;
        try {
          const floor = previousLogo?.provider === "wikimedia-commons" && previousLogo.lookup === "wikidata-ticker"
            ? EXACT_TICKER_LOGO_RESOLUTION_FLOOR
            : undefined;
          measurement = await measureLogoResolution(sourcePath, previousLogo?.crop, floor);
        } catch (error) {
          measurement = {
            passes: false,
            width: 0,
            height: 0,
            sharpness: null,
            reasons: ["unreadable"],
            error: error.message,
          };
        }
        if (!measurement.passes) {
          lowResolutionSourceIds.add(id);
          lowResolutionMeasurements.set(id, measurement);
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(24, validationRows.length) }, validationWorker));
  console.log(`Flagged ${suspiciousSourceIds.size} photographic Logo.dev sources for exact-source replacement.`);
  console.log(`Flagged ${lowResolutionSourceIds.size} sources below the logo resolution floor.`);
  console.log(`Flagged ${ambiguousNameSourceIds.size} Logo.dev name matches for exchange-qualified confirmation.`);
}

const fallbackRows = [];
if (!skipWikimedia || !effectiveSkipTradingView) {
  for (const row of rows) {
    const id = `${row.exchange}:${row.symbol}`;
    const previous = previousEntries.get(id);
    const sourcePath = previousAssetPath(
      previous,
      "sourcePath",
      path.join(sourceRoot, row.exchange.toLowerCase(), `${safeStem(row.symbol)}.png`),
    );
    if (materializeOpenSources) {
      if (!referenceAliases[id] && previous?.logo?.provider !== "catalog-alias") fallbackRows.push(row);
    } else if (!await fileExists(sourcePath)
      || (previous && !previous.logo)
      || (manualLogoCandidates.has(id)
        && previous?.logo?.manualAssetHash !== manualLogoCandidates.get(id).hash)
      || suspiciousSourceIds.has(id)
      || lowResolutionSourceIds.has(id)
      || ambiguousNameSourceIds.has(id)
      || preferTradingViewAll
      || (preferTradingView && reprocessIds.has(id))
      || (refreshTradingView && previous?.logo?.provider === "tradingview")) {
      fallbackRows.push(row);
    }
  }
}
const tradingViewCandidates = effectiveSkipTradingView || !fallbackRows.length
  ? new Map()
  : await findTradingViewLogoCandidates(fallbackRows, {
    onBatch: ({ candidates, completed: batchCompleted, total }) => {
      console.log(`TradingView ${batchCompleted}/${total} · ${candidates} exact logo matches`);
    },
  });
let wikimediaCandidates = new Map();
if (!skipWikimedia && fallbackRows.length) {
  const cachePath = path.join(root, "artifacts/wikimedia-logo-candidates.json");
  const rowSignature = createHash("sha256")
    .update(fallbackRows.map((row) => `${row.exchange}:${row.symbol}`).join("\n"))
    .digest("hex");
  const catalogRowSignature = createHash("sha256")
    .update(rows.map((row) => `${row.exchange}:${row.symbol}`).join("\n"))
    .digest("hex");
  if (materializeOpenSources && await fileExists(cachePath)) {
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8"));
      const cacheAge = Date.now() - Date.parse(cached.fetchedAt);
      const cachedIdsRemainInCatalog = (cached.candidates ?? [])
        .every(([id]) => ids.has(id));
      const cacheMatches = cached.rowSignature === rowSignature
        || cached.catalogRowSignature === catalogRowSignature
        || (noOpenDownloads && cachedIdsRemainInCatalog);
      if (cacheMatches && cacheAge >= 0 && cacheAge < 86_400_000) {
        wikimediaCandidates = new Map(cached.candidates);
        console.log(`Loaded ${wikimediaCandidates.size} Wikimedia candidates from the resumable 24-hour cache.`);
      }
    } catch {
      // A malformed or incomplete cache is ignored and safely rebuilt.
    }
  }
  if (!wikimediaCandidates.size) {
    wikimediaCandidates = await findWikimediaLogoCandidates(fallbackRows, {
      includeLicenseMetadata: materializeOpenSources,
      onBatch: ({ candidates, completed: batchCompleted, total }) => {
        console.log(`Wikidata ${batchCompleted}/${total} · ${candidates} exact logo matches`);
      },
      onMetadataBatch: ({ completed: batchCompleted, total }) => {
        if (batchCompleted % 200 === 0 || batchCompleted === total) {
          console.log(`Wikimedia licences ${batchCompleted}/${total}`);
        }
      },
    });
    if (materializeOpenSources) {
      await mkdir(path.dirname(cachePath), { recursive: true });
      const temporaryCachePath = `${cachePath}.write`;
      await writeFile(temporaryCachePath, `${JSON.stringify({
        fetchedAt: new Date().toISOString(),
        rowSignature,
        catalogRowSignature,
        candidates: [...wikimediaCandidates],
      })}\n`, "utf8");
      await rename(temporaryCachePath, cachePath);
    }
  }
}

let completed = 0;
const summary = { total: rows.length, reference: 0, ticker: 0, name: 0, manualReview: 0, tradingView: 0, wikimedia: 0, simpleIcons: 0, serpapi: 0, cached: 0, missing: 0, failed: 0, autoEmblem: 0, containerRemoved: 0, resolutionFlagged: 0, resolutionReplaced: 0, resolutionReview: 0 };
summary.resolutionFlagged = lowResolutionSourceIds.size;

function resolvedOrbColour(id, treatment, previous, pngAdjustment) {
  const reviewedBackground = manualLogoCandidates.get(id)?.brandBackground;
  if (reviewedBackground) {
    return {
      orbColour: reviewedBackground.colour,
      orbColourSeed: reviewedBackground.colour,
      orbColourSource: "removed-background",
      orbColourSourceRef: reviewedBackground.sourceRef,
      orbColourSourceUrl: reviewedBackground.sourceUrl,
    };
  }
  if (pngAdjustment?.orbColour) {
    return {
      orbColour: pngAdjustment.orbColour,
      orbColourSeed: pngAdjustment.orbColour,
      orbColourSource: "png-source-review",
    };
  }
  const brand = simpleIconBrandColours.get(id);
  if (brand) {
    const useBrandBackground = treatment.logoTreatment === "light";
    return {
      orbColour: useBrandBackground ? brand.colour : treatment.orbColour,
      orbColourSeed: brand.colour,
      orbColourSource: "simple-icons-brand",
      orbColourSourceRef: brand.slug,
      orbColourSourceUrl: brand.sourceUrl,
      ...(!useBrandBackground ? { orbColourAdjustment: "preserved-derived-for-mark-contrast" } : {}),
    };
  }
  if (previous?.logo?.orbColourSource === "manual-override") {
    return {
      orbColour: previous.logo.orbColour,
      orbColourSeed: previous.logo.orbColourSeed ?? previous.logo.orbColour,
      orbColourSource: previous.logo.orbColourSource,
      ...(previous.logo.orbColourSourceRef ? { orbColourSourceRef: previous.logo.orbColourSourceRef } : {}),
      ...(previous.logo.orbColourSourceUrl ? { orbColourSourceUrl: previous.logo.orbColourSourceUrl } : {}),
    };
  }
  return {
    orbColour: treatment.orbColour,
    orbColourSeed: treatment.orbColourSeed ?? treatment.orbColour,
    orbColourSource: treatment.orbColourSource,
  };
}

async function importRow(row) {
  const id = `${row.exchange}:${row.symbol}`;
  const common = {
    id,
    exchange: row.exchange,
    symbol: row.symbol,
    company: row.name,
    sector: row.sector,
    listingSource: row.source,
    programStatus: row.program_status,
    supporters: row.supporters ? Number(row.supporters) : null,
    wonAt: row.won_at || null,
    publiclyOnHudi: row.publicly_on_hudi.toLowerCase() === "true",
  };
  const referenceSymbol = referenceAliases[id];
  if (referenceSymbol) {
    const asset = referenceManifest[referenceSymbol];
    const style = referenceStyles.get(referenceSymbol);
    if (!asset || !style) throw new Error(`${id}: missing MVP reference ${referenceSymbol}`);
    const derived = await deriveBrandColourFromLogo(localPublicPath(asset.path));
    const colour = resolvedOrbColour(id, {
      logoTreatment: style.logoTreatment,
      orbColour: derived.hex,
      orbColourSeed: derived.hex,
      orbColourSource: derived.source,
    });
    summary.reference += 1;
    completed += 1;
    return {
      ...common,
      logo: {
        path: asset.path,
        sourcePath: asset.sourcePath,
        provider: "mvp-reference",
        referenceSymbol,
        cropMode: asset.crop ? "curated-emblem" : "curated-mark",
        ...colour,
        logoTreatment: style.logoTreatment,
        logoScale: style.logoScale,
        logoOffsetY: style.logoOffsetY,
      },
    };
  }

  const exchangeDirectory = row.exchange.toLowerCase();
  const filenameStem = safeStem(row.symbol);
  const sourceDirectory = path.join(sourceRoot, exchangeDirectory);
  const outputDirectory = path.join(catalogRoot, exchangeDirectory);
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  const previous = previousEntries.get(id);
  let sourcePath = previousAssetPath(previous, "sourcePath", path.join(sourceDirectory, `${filenameStem}.png`));
  let outputPath = previousAssetPath(previous, "path", path.join(outputDirectory, `${filenameStem}.png`));
  const forceReprocess = (reprocess && (!reprocessIds || reprocessIds.has(id)))
    || (reprocessAutoEmblems && previous?.logo?.cropMode === "auto-emblem")
    || (reprocessNeutralBackgrounds
      && previous?.logo?.orbColourSource === "neutral-fallback"
      && previous.logo.vectorBackgroundElementsRemoved > 0);
  if (fromManifest && previous?.logo?.provider === "catalog-alias" && !serpApiCandidates.has(id)) {
    summary.cached += 1;
    completed += 1;
    return { ...previous, ...common };
  }
  const manualCandidate = manualLogoCandidates.get(id);
  const tradingViewCandidate = tradingViewCandidates.get(id);
  const wikimediaCandidate = wikimediaCandidates.get(id);
  const simpleIconCandidate = simpleIconCandidates.get(id);
  const serpApiCandidate = serpApiCandidates.get(id);
  const suspiciousSource = suspiciousSourceIds.has(id);
  const lowResolutionSource = lowResolutionSourceIds.has(id);
  const ambiguousNameSource = ambiguousNameSourceIds.has(id);
  const hasExactCandidate = Boolean(manualCandidate || serpApiCandidate || tradingViewCandidate || wikimediaCandidate || simpleIconCandidate);
  const replaceWithManual = Boolean(manualCandidate && previous?.logo?.manualAssetHash !== manualCandidate.hash);
  const replaceAmbiguousNameSource = ambiguousNameSource && hasExactCandidate;
  const currentUsesExactTradingView = previous?.logo?.provider === "tradingview"
    && previous.logo.lookup === "exchange-ticker";
  const replaceWithTradingView = !manualCandidate
    && Boolean(tradingViewCandidate)
    && (preferTradingViewAll
      || (preferTradingView && reprocessIds.has(id))
      || !currentUsesExactTradingView);
  const selectedOpenProvider = wikimediaCandidate
    ? "wikimedia-commons"
    : simpleIconCandidate
      ? "simple-icons"
      : null;
  const sameOpenSource = selectedOpenProvider === "wikimedia-commons"
    ? previous?.logo?.provider === selectedOpenProvider
      && previous.logo.wikidataEntity === wikimediaCandidate.wikidataEntity
      && previous.logo.sourceUrl === wikimediaCandidate.sourceUrl
      && Boolean(previous.logo.sourceLicense)
    : selectedOpenProvider === "simple-icons"
      ? previous?.logo?.provider === selectedOpenProvider
        && previous.logo.simpleIconsSlug === simpleIconCandidate.slug
        && previous.logo.sourceCollectionLicense === "CC0-1.0"
      : false;
  const replaceWithOpenSource = Boolean(materializeOpenSources && selectedOpenProvider && !sameOpenSource);
  const allowOpenSourceReplacement = !noOpenDownloads || previous?.logoStatus === "low-resolution";
  const refreshTradingViewSource = refreshTradingView && previous?.logo?.provider === "tradingview";
  const refreshLogoDevSource = refreshLogoDevSvg
    && previous?.logo?.provider === "logo.dev"
    && previous.logo.assetFormat !== "svg"
    && (!reprocessIds || reprocessIds.has(id));
  if (fromManifest
    && previous?.logo
    && !forceReprocess
    && !replaceWithManual
    && !serpApiCandidate
    && !suspiciousSource
    && !lowResolutionSource
    && !replaceAmbiguousNameSource
    && !replaceWithTradingView
    && !(replaceWithOpenSource && allowOpenSourceReplacement)
    && !refreshTradingViewSource
    && !refreshLogoDevSource
    && await fileExists(sourcePath)) {
    summary.cached += 1;
    completed += 1;
    return { ...previous, ...common };
  }
  if (fromManifest && previous && !previous.logo && !hasExactCandidate) {
    if (previous.logoStatus === "low-resolution") summary.resolutionReview += 1;
    else if (previous.logoStatus === "failed") summary.failed += 1;
    else summary.missing += 1;
    completed += 1;
    return {
      ...common,
      logo: null,
      logoStatus: previous.logoStatus,
      ...(previous.logoError ? { logoError: previous.logoError } : {}),
    };
  }

  let download;
  try {
    const replaceSource = Boolean(
      replaceWithManual
      || serpApiCandidate
      || (previous && !previous.logo && hasExactCandidate)
      || (suspiciousSource && hasExactCandidate)
      || (lowResolutionSource && hasExactCandidate)
      || replaceAmbiguousNameSource
      || replaceWithTradingView
      || (replaceWithOpenSource && allowOpenSourceReplacement)
      || (refreshTradingViewSource && tradingViewCandidate)
      || refreshLogoDevSource
    );
    if (suspiciousSource && !hasExactCandidate) {
      summary.missing += 1;
      completed += 1;
      return {
        ...common,
        logo: null,
        logoStatus: "source-review",
        logoError: "Logo.dev returned a photographic source and no exchange-qualified replacement was available.",
      };
    }
    if (lowResolutionSource && !hasExactCandidate) {
      summary.resolutionReview += 1;
      completed += 1;
      return {
        ...common,
        logo: null,
        logoStatus: "low-resolution",
        logoError: `${resolutionFailureMessage(lowResolutionMeasurements.get(id))} No exchange-qualified replacement was available.`,
      };
    }
    const hasCachedReviewedSource = Boolean(serpApiCandidate?.reuseCachedSource && await fileExists(sourcePath));
    const reuseMaterializedWikimediaSource = Boolean(
      materializeOpenSources
      && previous?.logoStatus === "low-resolution"
      && wikimediaCandidate
      && await fileExists(sourcePath),
    );
    if (noOpenDownloads && !reuseMaterializedWikimediaSource) {
      if (previous?.logo) summary.cached += 1;
      else if (previous?.logoStatus === "low-resolution") summary.resolutionReview += 1;
      else if (previous?.logoStatus === "failed") summary.failed += 1;
      else summary.missing += 1;
      completed += 1;
      return previous ? { ...previous, ...common } : { ...common, logo: null, logoStatus: "missing" };
    }
    if ((!await fileExists(sourcePath) || replaceSource) && !hasCachedReviewedSource && !reuseMaterializedWikimediaSource) {
      try {
        download = await downloadLogo(row, {
          manual: manualCandidate,
          serpApi: serpApiCandidate,
          tradingView: tradingViewCandidate,
          wikimedia: wikimediaCandidate,
          simpleIcons: simpleIconCandidate,
        }, Boolean((!previous && hasExactCandidate) || replaceWithManual || (previous && !previous.logo) || suspiciousSource || lowResolutionSource || replaceAmbiguousNameSource || replaceWithTradingView || (replaceWithOpenSource && allowOpenSourceReplacement) || refreshTradingViewSource));
      } catch (error) {
        if (previous?.logo && await fileExists(sourcePath) && await fileExists(outputPath)) {
          console.warn(`${id}: retained previous local asset after replacement failed: ${error.message}`);
          summary.cached += 1;
          completed += 1;
          return { ...previous, ...common };
        }
        throw error;
      }
      if (!download) {
        summary.missing += 1;
        completed += 1;
        return { ...common, logo: null, logoStatus: "missing" };
      }
      const extension = isSvgBytes(download.bytes) ? "svg" : "png";
      sourcePath = path.join(sourceDirectory, `${filenameStem}.${extension}`);
      outputPath = path.join(outputDirectory, `${filenameStem}.${extension}`);
      const temporaryPath = `${sourcePath}.download`;
      await writeFile(temporaryPath, download.bytes);
      await rename(temporaryPath, sourcePath);
    } else if (reuseMaterializedWikimediaSource) {
      download = {
        provider: "wikimedia-commons",
        lookup: "wikidata-ticker",
        query: wikimediaCandidate.company,
        sourceUrl: wikimediaCandidate.sourceUrl,
        wikidataEntity: wikimediaCandidate.wikidataEntity,
        commonsPageUrl: wikimediaCandidate.commonsPageUrl,
        sourceLicense: wikimediaCandidate.license,
        sourceLicenseUrl: wikimediaCandidate.licenseUrl,
        attributionRequired: wikimediaCandidate.attributionRequired,
        sourceFormat: sourceFormatFromUrl(wikimediaCandidate.sourceUrl),
        cached: true,
      };
    } else if (hasCachedReviewedSource) {
      download = {
        provider: "serpapi-google-images",
        lookup: "manually-reviewed-company-image",
        query: serpApiCandidate.company,
        sourceUrl: serpApiCandidate.imageUrl,
        sourcePageUrl: serpApiCandidate.pageUrl,
        sourceTitle: serpApiCandidate.title,
        cached: true,
      };
    } else {
      const previousCandidate = previous?.logo ?? previous?.logoCandidate;
      download = {
        provider: previousCandidate?.provider ?? "logo.dev",
        lookup: previousCandidate?.lookup ?? "cached",
        query: previousCandidate?.query ?? null,
        sourceUrl: previousCandidate?.sourceUrl,
        sourcePageUrl: previousCandidate?.sourcePageUrl,
        sourceTitle: previousCandidate?.sourceTitle,
        tradingViewLogoid: previousCandidate?.tradingViewLogoid,
        wikidataEntity: previousCandidate?.wikidataEntity,
        commonsPageUrl: previousCandidate?.commonsPageUrl,
        sourceLicense: previousCandidate?.sourceLicense,
        sourceLicenseUrl: previousCandidate?.sourceLicenseUrl,
        attributionRequired: previousCandidate?.attributionRequired,
        simpleIconsSlug: previousCandidate?.simpleIconsSlug,
        sourceCollection: previousCandidate?.sourceCollection,
        sourceCollectionLicense: previousCandidate?.sourceCollectionLicense,
        sourceCollectionLicenseUrl: previousCandidate?.sourceCollectionLicenseUrl,
        sourceTrademarkNotice: previousCandidate?.sourceTrademarkNotice,
        sourceFormat: previousCandidate?.sourceFormat,
        manualAssetHash: previousCandidate?.manualAssetHash,
        cached: true,
      };
    }
    const cachedSourceBytes = await readFile(sourcePath);
    if (isSvgBytes(cachedSourceBytes)) {
      const vectorSourcePath = path.join(sourceDirectory, `${filenameStem}.svg`);
      if (sourcePath !== vectorSourcePath) {
        const temporaryVectorPath = `${vectorSourcePath}.migrate`;
        await writeFile(temporaryVectorPath, cachedSourceBytes);
        await rename(temporaryVectorPath, vectorSourcePath);
        sourcePath = vectorSourcePath;
      }
      outputPath = path.join(outputDirectory, `${filenameStem}.svg`);
    } else {
      outputPath = path.join(outputDirectory, `${filenameStem}.png`);
    }
    const sourceSha256 = createHash("sha256").update(cachedSourceBytes).digest("hex");
    const pngAdjustment = isSvgBytes(cachedSourceBytes) ? undefined : pngLogoAdjustments.get(sourceSha256);
    const treatment = await processLogo(sourcePath, outputPath, {
      provider: download.provider,
      preserveFullMark: manualCandidate?.preserveFullMark ?? Boolean(serpApiCandidate?.preserveFullMark),
      stripCanvasEdgeLines: !isSvgBytes(cachedSourceBytes),
      ...logoProcessingOverrides[id],
      ...pngAdjustment?.processing,
      ...manualCandidate?.processing,
    });
    outputPath = treatment.processedPath;
    delete treatment.processedPath;
    if (lowResolutionSource) summary.resolutionReplaced += 1;
    const usingManualReview = download.provider === "manual-review";
    const summaryKey = download.cached
      ? "cached"
      : download.provider === "manual-review" ? "manualReview"
      : download.provider === "serpapi-google-images" ? "serpapi"
      : download.provider === "tradingview" ? "tradingView"
        : download.provider === "wikimedia-commons" ? "wikimedia"
          : download.provider === "simple-icons" ? "simpleIcons"
            : download.lookup === "name" ? "name" : "ticker";
    summary[summaryKey] += 1;
    if (treatment.cropMode === "auto-emblem") summary.autoEmblem += 1;
    if (treatment.containerRemoved) summary.containerRemoved += 1;
    const colour = resolvedOrbColour(id, treatment, previous, pngAdjustment);
    completed += 1;
    if (completed % 100 === 0 || completed === rows.length) {
      console.log(`${completed}/${rows.length} · reference ${summary.reference} · ticker ${summary.ticker} · name ${summary.name} · missing ${summary.missing} · failed ${summary.failed}`);
    }
    return {
      ...common,
      logo: {
        path: publicPath(outputPath),
        sourcePath: publicPath(sourcePath),
        provider: download.provider,
        lookup: download.lookup,
        query: download.query,
        ...(download.sourceUrl ? { sourceUrl: download.sourceUrl } : {}),
        ...(download.sourcePageUrl ? { sourcePageUrl: download.sourcePageUrl } : {}),
        ...(download.sourceTitle ? { sourceTitle: download.sourceTitle } : {}),
        ...(download.tradingViewLogoid ? { tradingViewLogoid: download.tradingViewLogoid } : {}),
        ...(download.wikidataEntity ? { wikidataEntity: download.wikidataEntity } : {}),
        ...(download.commonsPageUrl ? { commonsPageUrl: download.commonsPageUrl } : {}),
        ...(download.sourceLicense ? { sourceLicense: download.sourceLicense } : {}),
        ...(download.sourceLicenseUrl ? { sourceLicenseUrl: download.sourceLicenseUrl } : {}),
        ...(download.attributionRequired != null ? { attributionRequired: download.attributionRequired } : {}),
        ...(download.simpleIconsSlug ? { simpleIconsSlug: download.simpleIconsSlug } : {}),
        ...(download.sourceCollection ? { sourceCollection: download.sourceCollection } : {}),
        ...(download.sourceCollectionLicense ? { sourceCollectionLicense: download.sourceCollectionLicense } : {}),
        ...(download.sourceCollectionLicenseUrl ? { sourceCollectionLicenseUrl: download.sourceCollectionLicenseUrl } : {}),
        ...(download.sourceTrademarkNotice ? { sourceTrademarkNotice: true } : {}),
        ...(download.sourceFormat ? { sourceFormat: download.sourceFormat } : {}),
        ...(download.manualAssetHash ? { manualAssetHash: download.manualAssetHash } : {}),
        ...((usingManualReview || suspiciousSource || lowResolutionSource || replaceAmbiguousNameSource || replaceWithTradingView || (replaceWithOpenSource && allowOpenSourceReplacement) || previous?.logo?.validationStatus) ? {
          validationStatus: usingManualReview
            ? "replaced-user-reviewed"
            : suspiciousSource
            ? "replaced-photographic-source"
            : lowResolutionSource
              ? "replaced-low-resolution-source"
              : replaceAmbiguousNameSource
                ? "replaced-ambiguous-name-source"
                : replaceWithTradingView
                  ? "replaced-provider-disagreement"
                  : replaceWithOpenSource && allowOpenSourceReplacement
                    ? "materialized-open-source"
                    : previous.logo.validationStatus,
          replacedProvider: usingManualReview
            ? previous?.logo?.provider === "manual-review"
              ? previous.logo.replacedProvider
              : previous?.logo?.provider ?? "logo.dev"
            : suspiciousSource || lowResolutionSource || replaceAmbiguousNameSource || replaceWithTradingView || (replaceWithOpenSource && allowOpenSourceReplacement)
            ? previous?.logo?.provider ?? "logo.dev"
            : previous.logo.replacedProvider,
        } : {}),
        ...treatment,
        ...colour,
        ...(pngAdjustment ? {
          adjustmentSource: "png-source-review",
          adjustmentSourceHash: sourceSha256,
        } : {}),
        ...(typeof previous?.logo?.logoOffsetY === "number" ? { logoOffsetY: previous.logo.logoOffsetY } : {}),
        ...(((forceReprocess && !refreshPresentation) || (replaceWithOpenSource && allowOpenSourceReplacement)) && previous?.logo ? {
          logoTreatment: previous.logo.logoTreatment,
          logoScale: previous.logo.logoScale,
        } : {}),
        ...pngAdjustment?.presentation,
      },
    };
  } catch (error) {
    summary.failed += 1;
    completed += 1;
    console.error(`${id}: ${error.message}`);
    return { ...common, logo: null, logoStatus: "failed", logoError: error.message };
  }
}

const entries = new Array(rows.length);
let nextIndex = 0;
async function worker() {
  while (nextIndex < rows.length) {
    const index = nextIndex;
    nextIndex += 1;
    entries[index] = await importRow(rows[index]);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceFile: fromManifest ? previousManifest.sourceFile : path.basename(csvPath),
  ...(fromManifest && (previousManifest.sourceOverlays?.length || csvPath) ? {
    sourceOverlays: [...new Set([
      ...(previousManifest.sourceOverlays ?? []),
      ...(csvPath ? [path.relative(root, path.resolve(csvPath)).split(path.sep).join("/")] : []),
    ])],
  } : {}),
  rowCount: entries.length,
  summary,
  entries,
};
const temporaryManifestPath = `${manifestPath}.write`;
await writeFile(temporaryManifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
await rename(temporaryManifestPath, manifestPath);
console.log(`Catalog written to ${manifestPath}`);
console.log(JSON.stringify(summary));
