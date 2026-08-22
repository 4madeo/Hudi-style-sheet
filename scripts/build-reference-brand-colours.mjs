import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveBrandColourFromLogo } from "./brand-colour.mjs";
import { findSimpleIconsBrandColourCandidates } from "./simple-icons-logo-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const listingsSource = await readFile(path.join(root, "app/listings.ts"), "utf8");
const logoManifest = JSON.parse(await readFile(path.join(root, "public/logos/manifest.json"), "utf8"));
const rows = [...listingsSource.matchAll(/\{\s*symbol:\s*"([^"]+)"\s*,\s*company:\s*"([^"]+)"\s*,\s*exchange:\s*"([^"]+)"[^}]*?logoTreatment:\s*"([^"]+)"/g)]
  .map((match) => ({ symbol: match[1], name: match[2], exchange: match[3], logoTreatment: match[4] }));
if (!rows.length) throw new Error("No reference listings were parsed from app/listings.ts");

const brandColours = findSimpleIconsBrandColourCandidates(rows);
const output = {};
for (const row of rows) {
  const asset = logoManifest[row.symbol];
  if (!asset?.path) throw new Error(`${row.symbol}: missing local reference logo`);
  const derived = await deriveBrandColourFromLogo(path.join(root, "public", asset.path.replace(/^\/+/, "")));
  const brand = brandColours.get(`${row.exchange}:${row.symbol}`);
  const useBrandBackground = Boolean(brand && row.logoTreatment === "light");
  output[row.symbol] = {
    orbColour: useBrandBackground ? brand.colour : derived.hex,
    orbColourSeed: brand?.colour ?? derived.hex,
    orbColourSource: brand ? "simple-icons-brand" : derived.source,
    ...(brand ? {
      orbColourSourceRef: brand.slug,
      orbColourSourceUrl: brand.sourceUrl,
    } : {}),
    ...(brand && !useBrandBackground ? { orbColourAdjustment: "logo-derived-for-mark-contrast" } : {}),
  };
}

const outputPath = path.join(root, "public/logos/brand-colours.json");
const temporaryPath = `${outputPath}.write`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);
const counts = Object.values(output).reduce((summary, entry) => {
  summary[entry.orbColourSource] = (summary[entry.orbColourSource] ?? 0) + 1;
  return summary;
}, {});
console.log(`Reference brand colours written to ${path.relative(root, outputPath)}: ${JSON.stringify(counts)}`);
