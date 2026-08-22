import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "public/logos/crypto/manifest.json"), "utf8"));

assert.equal(manifest.top100Count, 100);
assert.equal(manifest.rowCount, manifest.top100Count - manifest.stablecoinCount);
assert.equal(manifest.entries.length, manifest.rowCount);
assert.equal(new Set(manifest.entries.map((entry) => entry.cmcRank)).size, manifest.rowCount);
assert.equal(new Set(manifest.entries.map((entry) => entry.cmcId)).size, manifest.rowCount);
assert.ok(manifest.excludedStablecoins.every((entry) => !manifest.entries.some((coin) => coin.cmcId === entry.cmcId)));

for (const entry of manifest.entries.filter((coin) => coin.logo)) {
  assert.equal(entry.logo.provider, "tradingview");
  assert.equal(entry.logo.assetFormat, "svg");
  assert.equal(entry.logo.vectorPreserved, true);
  assert.match(entry.logo.path, /^\/logos\/crypto\/[^/]+\.svg$/);
  assert.match(entry.logo.sourcePath, /^\/logos\/crypto\/source\/[^/]+\.svg$/);
  await access(path.join(root, "public", entry.logo.path));
  await access(path.join(root, "public", entry.logo.sourcePath));
}

assert.equal(
  manifest.summary.ticker + manifest.summary.missing + manifest.summary.failed,
  manifest.rowCount,
);
const memeCore = manifest.entries.find((entry) => entry.cmcId === 35491);
assert.equal(memeCore?.logo?.logoTreatment, "original");
assert.equal(memeCore?.logo?.orbColour, "#9f7af8");
const xdc = manifest.entries.find((entry) => entry.cmcId === 2634);
assert.equal(xdc?.logo?.logoTreatment, "original");
assert.equal(xdc?.logo?.orbColour, "#7394c2");
assert.equal(xdc?.logo?.orbColourSeed, "#254c82");
assert.match(await readFile(path.join(root, "public", xdc.logo.path), "utf8"), /data-hudi-underlay="internal-contrast"/);
console.log(`Crypto catalog checks passed: ${manifest.summary.ticker}/${manifest.rowCount} TradingView SVGs, ${manifest.stablecoinCount} stablecoins excluded.`);
