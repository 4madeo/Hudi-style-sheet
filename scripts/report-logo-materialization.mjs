import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "public/logos/catalog/manifest.json");
const artifactRoot = path.join(root, "artifacts");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function fileExists(filename) {
  return access(filename).then(() => true, () => false);
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const providerCounts = {};
const licenceCounts = {};
const missingAssetFiles = [];
const provenanceRows = [];
let localAssets = 0;
let hudiFallbacks = 0;

for (const entry of manifest.entries) {
  if (!entry.logo) {
    hudiFallbacks += 1;
    continue;
  }

  localAssets += 1;
  const provider = entry.logo.provider ?? "unknown";
  const licence = entry.logo.sourceLicense
    ?? entry.logo.sourceCollectionLicense
    ?? "not-recorded";
  providerCounts[provider] = (providerCounts[provider] ?? 0) + 1;
  licenceCounts[licence] = (licenceCounts[licence] ?? 0) + 1;

  for (const key of ["path", "sourcePath"]) {
    const publicFile = entry.logo[key];
    if (!publicFile) {
      missingAssetFiles.push({ id: entry.id, key, path: null });
      continue;
    }
    const filename = path.join(root, "public", publicFile.replace(/^\//, ""));
    if (!await fileExists(filename)) missingAssetFiles.push({ id: entry.id, key, path: publicFile });
  }

  if (["wikimedia-commons", "simple-icons"].includes(provider)) {
    provenanceRows.push({
      id: entry.id,
      company: entry.company,
      provider,
      licence,
      licenceUrl: entry.logo.sourceLicenseUrl ?? entry.logo.sourceCollectionLicenseUrl ?? "",
      attributionRequired: entry.logo.attributionRequired ?? "",
      sourcePage: entry.logo.commonsPageUrl ?? entry.logo.sourceUrl ?? "",
      localPath: entry.logo.path,
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  manifestGeneratedAt: manifest.generatedAt,
  listings: manifest.entries.length,
  localAssets,
  hudiFallbacks,
  fullyOffline: missingAssetFiles.length === 0,
  missingAssetFiles,
  providerCounts: Object.fromEntries(Object.entries(providerCounts).sort()),
  licenceCounts: Object.fromEntries(Object.entries(licenceCounts).sort()),
  reusableSourceRecords: provenanceRows.length,
  notes: [
    "Listings without a company asset render the deterministic local HUDI fallback and require no network request.",
    "Simple Icons is distributed under CC0, but company marks may still be protected by trademark law.",
    "Wikimedia licence and attribution fields are recorded per source file; downstream exports must retain any required attribution.",
    "Existing local vendor assets are retained when no exact reusable-source candidate is available; this report does not relicense them.",
  ],
};

await mkdir(artifactRoot, { recursive: true });
await writeFile(
  path.join(artifactRoot, "logo-materialization-summary.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

const headers = ["id", "company", "provider", "licence", "licenceUrl", "attributionRequired", "sourcePage", "localPath"];
const csv = [
  headers.join(","),
  ...provenanceRows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
].join("\n");
await writeFile(path.join(artifactRoot, "logo-source-provenance.csv"), `${csv}\n`, "utf8");

console.log(JSON.stringify(report, null, 2));
if (missingAssetFiles.length) process.exitCode = 1;
