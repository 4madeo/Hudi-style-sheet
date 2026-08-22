import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyseLogoColourMode } from "./brand-colour.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "public/logos/catalog/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = manifest.entries.filter((entry) => entry.logo);
let next = 0;
let changed = 0;

async function worker() {
  while (next < entries.length) {
    const entry = entries[next++];
    const logoPath = path.join(root, "public", entry.logo.path.replace(/^\//, ""));
    const mode = await analyseLogoColourMode(await readFile(logoPath));
    if (entry.logo.logoColourMode !== mode) {
      entry.logo.logoColourMode = mode;
      changed += 1;
    }
  }
}

await Promise.all(Array.from({ length: 24 }, worker));
const temporaryPath = `${manifestPath}.colour-modes`;
await writeFile(temporaryPath, `${JSON.stringify(manifest)}\n`, "utf8");
await rename(temporaryPath, manifestPath);
console.log(JSON.stringify({ changed, multicolour: entries.filter((entry) => entry.logo.logoColourMode === "multicolour").length, tonal: entries.filter((entry) => entry.logo.logoColourMode === "tonal").length, monochrome: entries.filter((entry) => entry.logo.logoColourMode === "monochrome").length }));
