import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveBrandColourFromLogo } from "./brand-colour.mjs";
import { verifiedLogoFamilies } from "./catalog-logo-families.mjs";
import { findSimpleIconsBrandColourCandidates } from "./simple-icons-logo-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const manifestPath = path.resolve(root, manifestArgument ?? "public/logos/catalog/manifest.json");
const write = process.argv.includes("--write");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const rows = manifest.entries.map((entry) => ({
  exchange: entry.exchange,
  symbol: entry.symbol,
  name: entry.company,
}));
const brandColours = findSimpleIconsBrandColourCandidates(rows);
let changed = 0;

manifest.entries = await Promise.all(manifest.entries.map(async (entry) => {
  if (!entry.logo) return entry;
  let colourFields;
  const brand = brandColours.get(entry.id);
  if (brand) {
    let derived;
    if (entry.logo.logoTreatment !== "light") {
      derived = await deriveBrandColourFromLogo(path.join(root, "public", entry.logo.path.replace(/^\/+/, "")));
    }
    const useBrandBackground = entry.logo.logoTreatment === "light";
    colourFields = {
      orbColour: useBrandBackground ? brand.colour : derived.hex,
      orbColourSeed: brand.colour,
      orbColourSource: "simple-icons-brand",
      orbColourSourceRef: brand.slug,
      orbColourSourceUrl: brand.sourceUrl,
      ...(!useBrandBackground ? { orbColourAdjustment: "logo-derived-for-mark-contrast" } : {}),
    };
  } else if (entry.logo.provider === "mvp-reference") {
    const derived = await deriveBrandColourFromLogo(path.join(root, "public", entry.logo.path.replace(/^\/+/, "")));
    colourFields = {
      orbColour: derived.hex,
      orbColourSeed: derived.hex,
      orbColourSource: derived.source,
    };
  } else if (entry.logo.orbColourSource === "neutral-fallback") {
    const derived = await deriveBrandColourFromLogo(path.join(root, "public", entry.logo.path.replace(/^\/+/, "")));
    colourFields = derived.source === "logo-derived"
      ? {
          orbColour: derived.hex,
          orbColourSeed: derived.hex,
          orbColourSource: derived.source,
          logoTreatment: "original",
        }
      : {
          orbColourSeed: entry.logo.orbColourSeed ?? entry.logo.orbColour,
          orbColourSource: "neutral-fallback",
        };
  } else {
    const fallback = entry.logo.orbColour?.toLowerCase() === "#394150";
    colourFields = {
      orbColourSeed: entry.logo.orbColourSeed ?? entry.logo.orbColour,
      orbColourSource: entry.logo.orbColourSource === "curated-reference"
        ? (fallback ? "neutral-fallback" : "logo-derived")
        : entry.logo.orbColourSource ?? (fallback ? "neutral-fallback" : "logo-derived"),
    };
  }
  const logo = { ...entry.logo, ...colourFields };
  if (JSON.stringify(logo) !== JSON.stringify(entry.logo)) changed += 1;
  return { ...entry, logo };
}));

const byId = new Map(manifest.entries.map((entry) => [entry.id, entry]));
for (const family of verifiedLogoFamilies) {
  const anchor = family.members
    .map((id) => byId.get(id))
    .find((entry) => entry?.logo && entry.logo.orbColourSource !== "neutral-fallback");
  if (!anchor) continue;
  for (const id of family.members) {
    const entry = byId.get(id);
    if (!entry?.logo || entry.logo.orbColourSource !== "neutral-fallback") continue;
    entry.logo = {
      ...entry.logo,
      orbColour: anchor.logo.orbColour,
      orbColourSeed: anchor.logo.orbColourSeed ?? anchor.logo.orbColour,
      orbColourSource: "verified-family",
      orbColourSourceRef: anchor.id,
      orbColourSourceUrl: family.source,
      orbColourFamily: family.id,
    };
    changed += 1;
  }
}

const orbColourSources = {};
for (const entry of manifest.entries) {
  if (!entry.logo) continue;
  const source = entry.logo.orbColourSource ?? "unrecorded";
  orbColourSources[source] = (orbColourSources[source] ?? 0) + 1;
}
manifest.summary = { ...manifest.summary, orbColourSources };

if (write) {
  const temporaryPath = `${manifestPath}.colours`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest)}\n`, "utf8");
  await rename(temporaryPath, manifestPath);
}

console.log(JSON.stringify({
  manifest: path.relative(root, manifestPath),
  mode: write ? "write" : "dry-run",
  changed,
  exactSimpleIconsBrandColours: brandColours.size,
  orbColourSources,
}, null, 2));
