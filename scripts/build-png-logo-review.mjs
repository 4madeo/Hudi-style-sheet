import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const count = Math.max(1, Number(process.argv.find((value) => value.startsWith("--count="))?.split("=")[1] ?? 80));
const offset = Math.max(0, Number(process.argv.find((value) => value.startsWith("--offset="))?.split("=")[1] ?? 0));
const includeApproved = process.argv.includes("--include-approved");
const manifest = JSON.parse(await readFile(path.join(root, "public/logos/catalog/manifest.json"), "utf8"));
const decisions = JSON.parse(await readFile(path.join(root, "data/png-logo-adjustments.json"), "utf8"));
const approved = new Set(decisions.adjustments.map((item) => item.sourceSha256));
const groups = new Map();

for (const entry of manifest.entries) {
  if (entry.logo?.assetFormat !== "png" || entry.logo.provider === "tradingview" || !entry.logo.sourcePath) continue;
  const sourcePath = path.join(root, "public", entry.logo.sourcePath.replace(/^\//, ""));
  const source = await readFile(sourcePath);
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  const group = groups.get(sourceSha256) ?? { sourceSha256, sourcePath, entries: [] };
  group.entries.push(entry);
  groups.set(sourceSha256, group);
}

async function reviewRecord(group) {
  const entry = group.entries[0];
  const logoPath = path.join(root, "public", entry.logo.path.replace(/^\//, ""));
  const [{ data, info }, sourceMetadata] = await Promise.all([
    sharp(logoPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(group.sourcePath).metadata(),
  ]);
  let edgeVisible = 0;
  const edgeBand = Math.max(2, Math.round(Math.min(info.width, info.height) * 0.01));
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= 20) continue;
      if (x < edgeBand || x >= info.width - edgeBand || y < edgeBand || y >= info.height - edgeBand) edgeVisible += 1;
    }
  }
  const crop = entry.logo.crop;
  const aspect = crop?.height ? crop.width / crop.height : 1;
  const reasons = [];
  if (crop && crop.left <= 0.01 && crop.top <= 0.01 && crop.width >= 0.98 && crop.height >= 0.98) reasons.push("full-canvas");
  if (edgeVisible) reasons.push("touches-output-edge");
  if (aspect >= 2.8) reasons.push("wide-lockup");
  if (aspect <= 0.42) reasons.push("tall-lockup");
  if (!sourceMetadata.hasAlpha) reasons.push("opaque-source");
  const score = (reasons.includes("touches-output-edge") ? 8 : 0)
    + (reasons.includes("full-canvas") ? 6 : 0)
    + (reasons.includes("wide-lockup") || reasons.includes("tall-lockup") ? 2 : 0)
    + (reasons.includes("opaque-source") ? 1 : 0);
  return {
    sourceSha256: group.sourceSha256,
    approved: approved.has(group.sourceSha256),
    score,
    reasons,
    representativeId: entry.id,
    listingIds: group.entries.map((item) => item.id),
    company: entry.company,
    provider: entry.logo.provider,
    sourcePath: entry.logo.sourcePath,
    currentPath: entry.logo.path,
    currentCrop: crop,
    suggestedSourceCrop: crop && !reasons.includes("full-canvas") ? crop : null,
  };
}

const records = (await Promise.all([...groups.values()].map(reviewRecord)))
  .filter((record) => includeApproved || !record.approved)
  .sort((left, right) => right.score - left.score || left.company.localeCompare(right.company));
const selected = records.slice(offset, offset + count);
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  uniquePngSources: groups.size,
  approvedSources: approved.size,
  remainingSources: records.length,
  offset,
  count: selected.length,
  entries: selected,
};
await writeFile(path.join(artifacts, "png-logo-review.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
const csvRows = [
  ["source_sha256", "representative_id", "listing_ids", "company", "provider", "reasons", "source_path", "current_path"],
  ...selected.map((record) => [record.sourceSha256, record.representativeId, record.listingIds.join("|"), record.company, record.provider, record.reasons.join("|"), record.sourcePath, record.currentPath]),
];
await writeFile(path.join(artifacts, "png-logo-review.csv"), `${csvRows.map((row) => row.map(csv).join(",")).join("\n")}\n`, "utf8");

const columns = 4;
const tileWidth = 360;
const tileHeight = 210;
const sheet = [];
for (let index = 0; index < selected.length; index += 1) {
  const record = selected[index];
  const x = (index % columns) * tileWidth;
  const y = Math.floor(index / columns) * tileHeight;
  const [source, current] = await Promise.all([
    sharp(path.join(root, "public", record.sourcePath.replace(/^\//, ""))).ensureAlpha().resize({ width: 140, height: 140, fit: "contain" }).png().toBuffer(),
    sharp(path.join(root, "public", record.currentPath.replace(/^\//, ""))).ensureAlpha().resize({ width: 140, height: 140, fit: "contain" }).png().toBuffer(),
  ]);
  const label = `${record.representativeId} · ${record.company}`.slice(0, 48);
  const reason = record.reasons.join(" · ").slice(0, 58);
  const background = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="c" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff"/><path d="M0 0h6v6H0zm6 6h6v6H6z" fill="#e2e5e9"/></pattern></defs><rect width="100%" height="100%" fill="#f5f6f8"/><rect x="12" y="12" width="150" height="150" rx="8" fill="url(#c)"/><rect x="198" y="12" width="150" height="150" rx="8" fill="url(#c)"/><text x="87" y="178" text-anchor="middle" font-family="Arial" font-size="10" fill="#66707c">source</text><text x="273" y="178" text-anchor="middle" font-family="Arial" font-size="10" fill="#66707c">current</text><text x="180" y="194" text-anchor="middle" font-family="Arial" font-size="10" font-weight="700" fill="#171a1f">${label.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text><text x="180" y="207" text-anchor="middle" font-family="Arial" font-size="9" fill="#66707c">${reason.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text></svg>`);
  sheet.push({ input: background, left: x, top: y });
  sheet.push({ input: source, left: x + 17, top: y + 17 });
  sheet.push({ input: current, left: x + 203, top: y + 17 });
}
const rows = Math.max(1, Math.ceil(selected.length / columns));
await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 4, background: "#f5f6f8" } })
  .composite(sheet)
  .png()
  .toFile(path.join(artifacts, "png-logo-review.png"));

console.log(`Reviewed ${selected.length}/${records.length} pending unique PNG sources (${approved.size} approved).`);
