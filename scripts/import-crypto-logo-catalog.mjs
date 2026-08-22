import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { analyseLogoColourMode, deriveBrandColourFromLogo } from "./brand-colour.mjs";
import {
  downloadTradingViewCryptoLogo,
  fetchCoinMarketCapTop100,
  findTradingViewCryptoLogos,
  isCoinMarketCapStablecoin,
} from "./crypto-catalog-source.mjs";
import { buildIsolatedVectorLogo, prepareVectorLogo } from "./svg-logo-processing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cryptoRoot = path.join(root, "public", "logos", "crypto");
const sourceRoot = path.join(cryptoRoot, "source");
const manifestPath = path.join(cryptoRoot, "manifest.json");
const refreshAssets = process.argv.includes("--refresh-assets");
const concurrencyArgument = process.argv.find((argument) => argument.startsWith("--concurrency="));
const concurrency = Math.max(1, Math.min(16, Number(concurrencyArgument?.split("=")[1] ?? 8)));
const cryptoPresentationOverrides = new Map([
  [35491, { logoTreatment: "original", orbColour: "#9f7af8" }],
  [2634, {
    logoTreatment: "original",
    orbColour: "#7394c2",
    orbColourSeed: "#254c82",
    orbColourAdjustment: "logo-contrast",
    whiteSilhouetteUnderlay: true,
  }],
]);

function safeStem(coin) {
  const symbol = coin.symbol.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "coin";
  return `${symbol}-${coin.cmcId}`;
}

function publicPath(filename) {
  return `/${path.relative(path.join(root, "public"), filename).split(path.sep).join("/")}`;
}

function parseColour(value) {
  const short = /^#([0-9a-f]{3})$/i.exec(String(value ?? "").trim());
  const full = /^#([0-9a-f]{6})$/i.exec(String(value ?? "").trim());
  const hex = full?.[1] ?? (short ? [...short[1]].map((digit) => digit.repeat(2)).join("") : undefined);
  if (!hex) return undefined;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    hex: `#${hex.toLocaleLowerCase()}`,
  };
}

function relativeLuminance({ r, g, b }) {
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function usefulPanelColour(values) {
  return values.map(parseColour).find((colour) => {
    if (!colour) return false;
    const spread = Math.max(colour.r, colour.g, colour.b) - Math.min(colour.r, colour.g, colour.b);
    const luminance = relativeLuminance(colour);
    return luminance > 0.001 && luminance < 0.88 && (spread >= 20 || luminance < 0.16);
  });
}

function hasLightAndChromaticArtwork(bytes) {
  const colours = [...bytes.toString("utf8").matchAll(/(?:fill|stroke|stop-color)\s*=\s*["'](#[0-9a-f]{3,8})["']/gi)]
    .map((match) => parseColour(match[1]))
    .filter(Boolean);
  const hasLight = colours.some((colour) => colour.r >= 235 && colour.g >= 235 && colour.b >= 235);
  const hasChromatic = colours.some((colour) => (
    Math.max(colour.r, colour.g, colour.b) - Math.min(colour.r, colour.g, colour.b) >= 20
  ));
  return hasLight && hasChromatic;
}

async function vectorBounds(bytes) {
  const { data, info } = await sharp(bytes, { density: 576 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = 0;
  let bottom = 0;
  let pixels = 0;
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    if (data[pixel * info.channels + 3] <= 24) continue;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
    pixels += 1;
  }
  if (!pixels) throw new Error("no foreground found after removing the TradingView tile");
  return {
    left: Number((left / info.width).toFixed(5)),
    top: Number((top / info.height).toFixed(5)),
    width: Number(((right - left) / info.width).toFixed(5)),
    height: Number(((bottom - top) / info.height).toFixed(5)),
  };
}

function addWhiteSilhouetteUnderlay(prepared) {
  const firstPathData = /<path\b[^>]*\bd\s*=\s*(["'])(.*?)\1/i.exec(prepared.inner)?.[2];
  const silhouette = firstPathData?.match(/^([\s\S]*?[zZ])/)?.[1];
  if (!silhouette) throw new Error("cannot isolate the outer silhouette for the contrast underlay");
  prepared.inner = `<path data-hudi-underlay="internal-contrast" d=${JSON.stringify(silhouette)} fill="#fff"/>${prepared.inner}`;
}

async function processTradingViewSvg(sourceBytes, override = {}) {
  const prepared = prepareVectorLogo(sourceBytes, { stripCanvasBackground: true });
  if (!prepared) throw new Error("source is not a valid SVG");
  const crop = await vectorBounds(prepared.analysisBytes);
  if (override.whiteSilhouetteUnderlay) addWhiteSilhouetteUnderlay(prepared);
  const output = buildIsolatedVectorLogo(prepared, crop, { source: "tradingview" });
  const panelColour = usefulPanelColour(prepared.removedBackgroundColours);
  const derived = await deriveBrandColourFromLogo(prepared.analysisBytes);
  const colourMode = await analyseLogoColourMode(prepared.analysisBytes);
  const preserveInternalContrast = hasLightAndChromaticArtwork(prepared.analysisBytes);
  const orbColour = override.orbColour ?? panelColour?.hex ?? derived.hex;
  return {
    output,
    presentation: {
      bytes: output.length,
      assetFormat: "svg",
      cropMode: "full-mark",
      crop,
      orbColour,
      orbColourSeed: override.orbColourSeed ?? orbColour,
      orbColourSource: override.orbColour ? "manual-override" : panelColour ? "removed-background" : derived.source,
      ...(override.orbColourAdjustment ? { orbColourAdjustment: override.orbColourAdjustment } : {}),
      logoTreatment: override.logoTreatment ?? (panelColour || colourMode === "multicolour" || preserveInternalContrast ? "original" : "light"),
      logoScale: 0.56,
      logoColourMode: colourMode,
      vectorPreserved: true,
      vectorBackgroundElementsRemoved: prepared.backgroundElementsRemoved,
      ...(panelColour ? { containerRemoved: true, containerColour: panelColour.hex } : {}),
    },
  };
}

await mkdir(sourceRoot, { recursive: true });
let previousManifest;
try { previousManifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch { /* First materialization. */ }
const previousEntries = new Map((previousManifest?.entries ?? []).map((entry) => [entry.cmcId, entry]));
const snapshot = await fetchCoinMarketCapTop100();
const stablecoins = snapshot.ranked.filter(isCoinMarketCapStablecoin);
const coins = snapshot.ranked.filter((coin) => !isCoinMarketCapStablecoin(coin));
console.log(`CoinMarketCap top 100 · ${coins.length} coins · ${stablecoins.length} stablecoins excluded`);

const candidates = await findTradingViewCryptoLogos(coins, {
  onBatch: ({ completed, matches, total }) => console.log(`TradingView ${completed}/${total} · ${matches} exact crypto logo matches`),
});

const entries = new Array(coins.length);
let nextIndex = 0;
async function worker() {
  while (nextIndex < coins.length) {
    const index = nextIndex;
    nextIndex += 1;
    const coin = coins[index];
    const candidate = candidates.get(coin.cmcId);
    const common = {
      id: `CRYPTO:${coin.cmcId}`,
      exchange: "CRYPTO",
      symbol: coin.symbol,
      company: coin.name,
      sector: "Cryptocurrency",
      cmcId: coin.cmcId,
      cmcRank: coin.cmcRank,
      cmcSlug: coin.slug,
      listingSource: "coinmarketcap-top-100",
      programStatus: "reference_only",
      supporters: null,
      wonAt: null,
      publiclyOnHudi: false,
    };
    if (!candidate) {
      entries[index] = { ...common, logo: null, logoStatus: "missing", logoError: "No exact TradingView base-currency logo match." };
      continue;
    }
    try {
      const stem = safeStem(coin);
      const sourcePath = path.join(sourceRoot, `${stem}.svg`);
      const outputPath = path.join(cryptoRoot, `${stem}.svg`);
      let sourceBytes;
      let sourceAlreadyAtCurrentPath = false;
      if (!refreshAssets) {
        try {
          sourceBytes = await readFile(sourcePath);
          sourceAlreadyAtCurrentPath = true;
        } catch {
          const previousSourcePath = previousEntries.get(coin.cmcId)?.logo?.sourcePath;
          if (previousSourcePath) {
            try { sourceBytes = await readFile(path.join(root, "public", previousSourcePath)); } catch { /* Download below. */ }
          }
        }
      }
      if (!sourceBytes) {
        sourceBytes = await downloadTradingViewCryptoLogo(candidate);
      }
      if (!sourceAlreadyAtCurrentPath) {
        const temporarySourcePath = `${sourcePath}.download`;
        await writeFile(temporarySourcePath, sourceBytes);
        await rename(temporarySourcePath, sourcePath);
      }
      const { output, presentation } = await processTradingViewSvg(
        sourceBytes,
        cryptoPresentationOverrides.get(coin.cmcId),
      );
      const temporaryOutputPath = `${outputPath}.process`;
      await writeFile(temporaryOutputPath, output);
      await rename(temporaryOutputPath, outputPath);
      entries[index] = {
        ...common,
        logo: {
          path: publicPath(outputPath),
          sourcePath: publicPath(sourcePath),
          provider: "tradingview",
          lookup: "base-currency",
          query: candidate.query,
          sourceUrl: candidate.sourceUrl,
          sourceFormat: "svg",
          tradingViewLogoid: candidate.logoid,
          tradingViewName: candidate.name,
          ...presentation,
        },
      };
    } catch (error) {
      console.error(`${coin.cmcRank} ${coin.symbol}: ${error.message}`);
      entries[index] = { ...common, logo: null, logoStatus: "failed", logoError: error.message };
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, coins.length) }, worker));

const resolved = entries.filter((entry) => entry.logo).length;
const missing = entries.filter((entry) => entry.logoStatus === "missing").length;
const failed = entries.filter((entry) => entry.logoStatus === "failed").length;
const manifest = {
  generatedAt: new Date().toISOString(),
  sourceFile: snapshot.sourceUrl,
  sourceSnapshotAt: snapshot.fetchedAt,
  sourceScope: "CoinMarketCap ranks 1-100, excluding entries tagged stablecoin",
  top100Count: snapshot.ranked.length,
  stablecoinCount: stablecoins.length,
  excludedStablecoins: stablecoins.map(({ cmcId, cmcRank, name, slug, symbol }) => ({ cmcId, cmcRank, name, slug, symbol })),
  rowCount: entries.length,
  summary: { reference: 0, ticker: resolved, name: 0, missing, failed, sourceReview: missing + failed },
  entries,
};
const temporaryManifestPath = `${manifestPath}.write`;
await writeFile(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await rename(temporaryManifestPath, manifestPath);

const currentAssetPaths = new Set(entries.flatMap((entry) => entry.logo ? [entry.logo.path, entry.logo.sourcePath] : []));
for (const obsoletePublicPath of (previousManifest?.entries ?? []).flatMap((entry) => (
  entry.logo ? [entry.logo.path, entry.logo.sourcePath] : []
))) {
  if (!obsoletePublicPath || currentAssetPaths.has(obsoletePublicPath)) continue;
  const obsoletePath = path.resolve(root, "public", obsoletePublicPath.replace(/^\/+/, ""));
  if (obsoletePath !== cryptoRoot && !obsoletePath.startsWith(`${cryptoRoot}${path.sep}`)) continue;
  try { await unlink(obsoletePath); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const currentAssetFiles = new Set([...currentAssetPaths].map((value) => (
  path.resolve(root, "public", value.replace(/^\/+/, ""))
)));
for (const directory of [cryptoRoot, sourceRoot]) {
  for (const directoryEntry of await readdir(directory, { withFileTypes: true })) {
    if (!directoryEntry.isFile() || !directoryEntry.name.endsWith(".svg")) continue;
    const assetPath = path.join(directory, directoryEntry.name);
    if (!currentAssetFiles.has(assetPath)) await unlink(assetPath);
  }
}
console.log(`Crypto catalog written to ${manifestPath}`);
console.log(JSON.stringify({ total: entries.length, resolved, missing, failed, stablecoinsExcluded: stablecoins.length }));
