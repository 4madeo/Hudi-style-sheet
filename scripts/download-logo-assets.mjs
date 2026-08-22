import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const token = process.env.LOGO_DEV_PUBLISHABLE_KEY;

// Orb assets favour a recognizable standalone mark over a full wordmark.
// These normalized crops preserve the complete downloaded artwork in source/.
const assetOverrides = {
  ADVANTEST: {
    crop: { left: 0, top: 0.39, width: 0.138, height: 0.16 },
    backgroundTolerance: 20,
  },
  DOOSANENERB: {
    crop: { left: 0.1, top: 0.34, width: 0.8, height: 0.33 },
  },
  FUJIKURA: {
    crop: { left: 0.09, top: 0.37, width: 0.19, height: 0.23 },
    backgroundTolerance: 24,
  },
  HDHYUNDAIELEC: {
    crop: { left: 0.01, top: 0.37, width: 0.56, height: 0.26 },
    backgroundTolerance: 24,
  },
  HDKSOE: {
    crop: { left: 0, top: 0.42, width: 0.34, height: 0.18 },
    backgroundTolerance: 24,
  },
  SOFTBANK: {
    crop: { left: 0.08, top: 0.38, width: 0.2, height: 0.17 },
    backgroundTolerance: 16,
  },
  SPACEX: {
    crop: { left: 0.665, top: 0.425, width: 0.255, height: 0.16 },
  },
};

const curatedSources = {
  IBIDEN: path.join(root, "public/logos/curated/ibiden.png"),
  NVDA: path.join(root, "public/logos/curated/nvda.svg"),
};

if (!token?.startsWith("pk_")) {
  throw new Error("Set LOGO_DEV_PUBLISHABLE_KEY to a Logo.dev publishable key.");
}

const listingSource = await readFile(path.join(root, "app/listings.ts"), "utf8");
const listings = Array.from(listingSource.matchAll(/symbol: "([^"]+)"[^\n]+logoDomain: "([^"]+)"/g))
  .map(([, symbol, domain]) => ({ symbol, domain }));

if (listings.length !== 37) {
  throw new Error(`Expected 37 logo listings, found ${listings.length}.`);
}

const outputDirectory = path.join(root, "public/logos");
const sourceDirectory = path.join(outputDirectory, "source");
await mkdir(outputDirectory, { recursive: true });
await mkdir(sourceDirectory, { recursive: true });

function fileStem(symbol) {
  return symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isSvg(bytes) {
  return bytes.subarray(0, 512).toString("utf8").replace(/^\uFEFF/, "").trimStart().startsWith("<svg");
}

function isPng(bytes) {
  return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

async function fetchLogo(domain, format) {
  const params = new URLSearchParams({
    token,
    format,
    size: "800",
    fallback: "404",
  });
  if (format === "png") params.set("retina", "true");
  const response = await fetch(`https://img.logo.dev/${encodeURIComponent(domain)}?${params}`, {
    headers: { Accept: format === "svg" ? "image/svg+xml" : "image/png" },
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (format === "svg" && !isSvg(bytes)) throw new Error("response was not SVG");
  if (format === "png" && !isPng(bytes)) throw new Error("response was not PNG");
  return bytes;
}

async function downloadListing(listing) {
  const curatedSource = curatedSources[listing.symbol];
  let format;
  let bytes;

  if (curatedSource) {
    format = path.extname(curatedSource).slice(1).toLowerCase();
    if (format !== "png" && format !== "svg") {
      throw new Error(`${listing.symbol}: unsupported curated source format ${format}`);
    }
    bytes = await readFile(curatedSource);
  } else {
    format = "svg";
    try {
      bytes = await fetchLogo(listing.domain, format);
    } catch (svgError) {
      format = "png";
      try {
        bytes = await fetchLogo(listing.domain, format);
      } catch (pngError) {
        throw new Error(`${listing.symbol}: SVG ${svgError.message}; PNG ${pngError.message}`);
      }
    }
  }

  const filename = `${fileStem(listing.symbol)}.${format}`;
  const target = path.join(sourceDirectory, filename);
  const temporary = `${target}.download`;
  await writeFile(temporary, bytes);
  await rename(temporary, target);
  return {
    symbol: listing.symbol,
    domain: listing.domain,
    format,
    path: `/logos/${fileStem(listing.symbol)}.png`,
    sourcePath: `/logos/source/${filename}`,
    sourceBytes: bytes.length,
    ...assetOverrides[listing.symbol],
  };
}

const assets = [];
const failures = [];
for (const listing of listings) {
  try {
    const asset = await downloadListing(listing);
    assets.push(asset);
    console.log(`${asset.symbol}: ${asset.format.toUpperCase()} (${asset.sourceBytes} bytes)`);
  } catch (error) {
    failures.push(error.message);
    console.error(error.message);
  }
}

const manifest = Object.fromEntries(assets.map((asset) => [asset.symbol, asset]));
await writeFile(
  path.join(outputDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Downloaded ${assets.length}/${listings.length} logo assets.`);
if (failures.length) {
  throw new Error(`Missing ${failures.length} logos:\n${failures.join("\n")}`);
}

await import("./process-logo-assets.mjs");
