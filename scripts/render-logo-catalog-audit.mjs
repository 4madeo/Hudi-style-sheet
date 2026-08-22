import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const mode = process.argv.find((argument) => argument.startsWith("--mode="))?.split("=")[1] ?? "first";
const count = Math.max(1, Number(process.argv.find((argument) => argument.startsWith("--count="))?.split("=")[1] ?? 100));
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length);
const idsArgument = process.argv.find((argument) => argument.startsWith("--ids="))?.slice("--ids=".length);
const requestedIds = idsArgument?.split(",").map((id) => id.trim()).filter(Boolean);

if (!manifestArgument) {
  throw new Error("Usage: npm run audit:catalog -- public/logos/catalog/manifest.json [--mode=stratified] [--count=120]");
}

const manifestPath = path.resolve(root, manifestArgument);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = manifest.entries;

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function selectEntries() {
  if (requestedIds?.length) {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    return requestedIds.map((id) => byId.get(id)).filter(Boolean);
  }
  if (mode === "serpapi") return entries.filter((entry) => entry.logo?.provider === "serpapi-google-images").slice(0, count);
  if (mode === "tv-overcrops") {
    return entries.filter((entry) => entry.logo?.provider === "tradingview" && entry.logo.cropMode === "auto-emblem").slice(0, count);
  }
  if (mode === "tv-missed-emblems") {
    return entries.filter((entry) => {
      const crop = entry.logo?.crop;
      return entry.logo?.provider === "tradingview"
        && entry.logo.cropMode === "full-mark"
        && crop?.height
        && crop.width / crop.height >= 2.5;
    }).slice(0, count);
  }
  if (mode === "tv-background-sample") {
    return entries.filter((entry) => {
      const crop = entry.logo?.crop;
      if (entry.logo?.provider !== "tradingview" || !crop?.height) return false;
      const aspect = crop.width / crop.height;
      return aspect >= 0.74 && aspect <= 1.35;
    }).sort((left, right) => hash(left.id) - hash(right.id)).slice(0, count);
  }
  if (mode === "colour-fallbacks") {
    return entries.filter((entry) => entry.logo && (
      entry.logo.orbColourSource === "neutral-fallback"
      || (!entry.logo.orbColourSource && entry.logo.orbColour?.toLowerCase() === "#394150")
    )).slice(0, count);
  }
  if (mode === "emblems") return entries.filter((entry) => entry.logo?.cropMode === "auto-emblem").slice(0, count);
  if (mode === "containers") return entries.filter((entry) => entry.logo?.containerRemoved).slice(0, count);
  if (mode === "containers-stratified") {
    const candidates = entries.filter((entry) => entry.logo?.containerRemoved);
    const exchanges = [...new Set(candidates.map((entry) => entry.exchange))];
    const perExchange = Math.max(1, Math.ceil(count / exchanges.length));
    return exchanges.flatMap((exchange) => candidates
      .filter((entry) => entry.exchange === exchange)
      .sort((left, right) => hash(left.id) - hash(right.id))
      .slice(0, perExchange)).slice(0, count);
  }
  if (mode === "missing") return entries.filter((entry) => !entry.logo).slice(0, count);
  if (mode === "logo-dev") {
    return entries
      .filter((entry) => entry.logo?.provider === "logo.dev")
      .sort((left, right) => hash(left.id) - hash(right.id))
      .slice(0, count);
  }
  if (mode === "stratified") {
    const exchanges = [...new Set(entries.map((entry) => entry.exchange))];
    const perExchange = Math.max(1, Math.ceil(count / exchanges.length));
    return exchanges.flatMap((exchange) => entries
      .filter((entry) => entry.exchange === exchange && entry.logo)
      .sort((left, right) => hash(left.id) - hash(right.id))
      .slice(0, perExchange)).slice(0, count);
  }
  return entries.slice(0, count);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const selected = selectEntries();
const detailed = mode.startsWith("tv-") || mode === "colour-fallbacks";
const columns = detailed ? 3 : 8;
const tileWidth = detailed ? 420 : 170;
const tileHeight = 190;
const rows = Math.max(1, Math.ceil(selected.length / columns));
const width = columns * tileWidth;
const height = rows * tileHeight;
const output = outputArgument
  ? path.resolve(outputArgument)
  : path.join(root, "artifacts", `catalog-audit-${mode}.png`);
await mkdir(path.dirname(output), { recursive: true });

const composites = [];
for (let index = 0; index < selected.length; index += 1) {
  const entry = selected[index];
  const x = (index % columns) * tileWidth;
  const y = Math.floor(index / columns) * tileHeight;
  const colour = entry.logo?.orbColour ?? "#C9CDD4";
  const mark = entry.logo?.containerRemoved
    ? " · inner"
    : entry.logo?.cropMode === "auto-emblem" ? " · emblem" : "";
  const label = `${entry.exchange}:${entry.symbol}${mark}`;
  const company = entry.company.length > 22 ? `${entry.company.slice(0, 21)}…` : entry.company;
  const detailedPanels = detailed ? `
      <defs><pattern id="checker" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff"/><path d="M0 0h6v6H0zm6 6h6v6H6z" fill="#dde1e6"/></pattern></defs>
      <rect x="10" y="10" width="112" height="112" rx="8" fill="url(#checker)"/>
      <rect x="154" y="10" width="112" height="112" rx="8" fill="url(#checker)"/>
      <text x="66" y="137" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#59616c">raw source</text>
      <text x="210" y="137" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#59616c">isolated mark</text>` : "";
  const tile = Buffer.from(`
    <svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="orb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".62"/>
          <stop offset=".34" stop-color="${colour}" stop-opacity=".98"/>
          <stop offset="1" stop-color="${colour}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="#f4f5f7"/>
      ${detailedPanels}
      <circle cx="${detailed ? 354 : 85}" cy="72" r="62" fill="url(#orb)" stroke="#ffffff" stroke-opacity=".75" stroke-width="2"/>
      <circle cx="${detailed ? 354 : 85}" cy="72" r="59" fill="none" stroke="#000000" stroke-opacity=".16" stroke-width="2"/>
      ${entry.logo ? "" : `<path d="M${detailed ? 327 : 58} 45l54 54m0-54L${detailed ? 327 : 58} 99" stroke="#8a919c" stroke-width="7"/>`}
      <text x="${detailed ? 210 : 85}" y="155" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#15171a">${escapeXml(label)}</text>
      <text x="${detailed ? 210 : 85}" y="172" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#59616c">${escapeXml(company)}${detailed && entry.logo?.orbColourSource ? ` · ${escapeXml(entry.logo.orbColourSource)}` : ""}</text>
    </svg>`);
  composites.push({ input: tile, left: x, top: y });

  if (entry.logo) {
    const logoPath = path.join(root, "public", entry.logo.path.replace(/^\//, ""));
    const target = Math.round(124 * (entry.logo.logoScale ?? 0.56));
    if (detailed && entry.logo.sourcePath) {
      const sourcePath = path.join(root, "public", entry.logo.sourcePath.replace(/^\//, ""));
      const [raw, isolated] = await Promise.all([
        sharp(sourcePath, { density: 384 }).ensureAlpha().resize({ width: 96, height: 96, fit: "contain" }).png().toBuffer(),
        sharp(logoPath, { density: 384 }).ensureAlpha().resize({ width: 96, height: 96, fit: "contain" }).png().toBuffer(),
      ]);
      composites.push({ input: raw, left: x + 18, top: y + 18 });
      composites.push({ input: isolated, left: x + 162, top: y + 18 });
    }
    const resized = sharp(logoPath).ensureAlpha().resize({ width: target, height: target, fit: "contain" });
    let buffer;
    if (entry.logo.logoTreatment === "light" || entry.logo.logoTreatment === "dark") {
      const alpha = await resized.clone().extractChannel("alpha").toBuffer();
      const value = entry.logo.logoTreatment === "light" ? 255 : 0;
      buffer = await sharp({
        create: { width: target, height: target, channels: 3, background: { r: value, g: value, b: value } },
      }).joinChannel(alpha).png().toBuffer();
    } else if (entry.logo.logoTreatment === "knockout") {
      const alpha = await resized.clone().flatten({ background: "#fff" }).greyscale().threshold(220).negate().extractChannel(0).toBuffer();
      buffer = await sharp({
        create: { width: target, height: target, channels: 3, background: { r: 255, g: 255, b: 255 } },
      }).joinChannel(alpha).png().toBuffer();
    } else if (["lift", "tint", "deepen"].includes(entry.logo.logoTreatment)) {
      if (entry.logo.logoTreatment === "lift" || entry.logo.logoTreatment === "tint") {
        const lifted = await resized.clone().raw().toBuffer({ resolveWithObject: true });
        const slope = entry.logo.logoTreatment === "tint" ? 0.4 : 0.16;
        const intercept = entry.logo.logoTreatment === "tint" ? 0.55 : 0.8;
        for (let offset = 0; offset < lifted.data.length; offset += lifted.info.channels) {
          lifted.data[offset] = Math.min(255, Math.round(lifted.data[offset] * slope + 255 * intercept));
          lifted.data[offset + 1] = Math.min(255, Math.round(lifted.data[offset + 1] * slope + 255 * intercept));
          lifted.data[offset + 2] = Math.min(255, Math.round(lifted.data[offset + 2] * slope + 255 * intercept));
        }
        buffer = await sharp(lifted.data, { raw: lifted.info }).png().toBuffer();
      } else {
        buffer = await resized.modulate({ brightness: 0.48, saturation: 1.1 }).png().toBuffer();
      }
    } else {
      buffer = await resized.png().toBuffer();
    }
    const orbCentre = detailed ? 354 : 85;
    composites.push({ input: buffer, left: x + orbCentre - Math.round(target / 2), top: y + 72 - Math.round(target / 2) });
  }
}

await sharp({
  create: { width, height, channels: 4, background: "#f4f5f7" },
}).composite(composites).png().toFile(output);
console.log(`Rendered ${selected.length} catalog entries to ${output}`);
