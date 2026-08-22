import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "artifacts/serpapi-logo-candidates.json");
const outputDirectory = path.join(root, "artifacts/logo-candidate-review");
const rowsPerSheet = 24;
const candidatesPerRow = 3;
const width = 1600;
const rowHeight = 190;
const headerHeight = 76;

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncate(value, length) {
  const text = String(value ?? "").replaceAll(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

async function fetchImage(candidate) {
  const urls = [candidate.thumbnailUrl, candidate.imageUrl].filter(Boolean);
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 logo-candidate-review/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      return await sharp(bytes, { density: 200 })
        .flatten({ background: "#ffffff" })
        .resize(210, 126, { fit: "contain", background: "#ffffff" })
        .png()
        .toBuffer();
    } catch {
      // The label and source still appear when an image host blocks hotlinking.
    }
  }
  return undefined;
}

const report = JSON.parse(await readFile(inputPath, "utf8"));
const searches = Object.values(report.searches).sort((left, right) => {
  const statusOrder = { missing: 0, failed: 1, "low-resolution": 2, "duplicate-review": 3 };
  const leftStatus = Math.min(...left.statuses.map((status) => statusOrder[status] ?? 9));
  const rightStatus = Math.min(...right.statuses.map((status) => statusOrder[status] ?? 9));
  return leftStatus - rightStatus || left.company.localeCompare(right.company);
});

await mkdir(outputDirectory, { recursive: true });
const index = [];

for (let offset = 0; offset < searches.length; offset += rowsPerSheet) {
  const page = searches.slice(offset, offset + rowsPerSheet);
  const height = headerHeight + page.length * rowHeight;
  const background = await sharp({
    create: { width, height, channels: 4, background: "#f4f6f8" },
  }).png().toBuffer();
  const composites = [];
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += '<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#17202a}.h{font-size:26px;font-weight:700}.company{font-size:19px;font-weight:700}.meta{font-size:13px;fill:#52606d}.rank{font-size:13px;font-weight:700}.source{font-size:12px;fill:#364152}.none{font-size:16px;fill:#8a1c1c}</style>';
  svg += `<text x="28" y="38" class="h">Logo candidate review ${offset + 1}–${offset + page.length} of ${searches.length}</text>`;
  svg += `<text x="28" y="60" class="meta">Each cell shows Google Images rank after heuristic sorting, score, and source. Visual match is evidence, not automatic approval.</text>`;

  for (let row = 0; row < page.length; row += 1) {
    const search = page[row];
    const top = headerHeight + row * rowHeight;
    const shade = row % 2 === 0 ? "#ffffff" : "#f9fafb";
    svg += `<rect x="14" y="${top + 4}" width="1572" height="182" rx="9" fill="${shade}" stroke="#d8dee5"/>`;
    svg += `<text x="28" y="${top + 34}" class="company">${escapeXml(truncate(search.company, 32))}</text>`;
    svg += `<text x="28" y="${top + 58}" class="meta">${escapeXml(search.statuses.join(", "))}</text>`;
    svg += `<text x="28" y="${top + 78}" class="meta">${escapeXml(truncate(search.listingIds.join(" "), 38))}</text>`;
    if (!search.candidates.length) {
      svg += `<text x="390" y="${top + 96}" class="none">No image results</text>`;
      continue;
    }
    const candidates = search.candidates.slice(0, candidatesPerRow);
    const images = await Promise.all(candidates.map(fetchImage));
    candidates.forEach((candidate, rank) => {
      const left = 370 + rank * 402;
      svg += `<rect x="${left}" y="${top + 16}" width="382" height="154" rx="7" fill="#fff" stroke="#c7cfd8"/>`;
      svg += `<text x="${left + 12}" y="${top + 37}" class="rank">#${rank + 1} · score ${candidate.score}</text>`;
      svg += `<text x="${left + 228}" y="${top + 38}" class="source">${escapeXml(truncate(candidate.source, 23))}</text>`;
      svg += `<text x="${left + 228}" y="${top + 61}" class="source">${escapeXml(truncate(candidate.title, 23))}</text>`;
      svg += `<text x="${left + 228}" y="${top + 82}" class="meta">${candidate.width}×${candidate.height}</text>`;
      if (images[rank]) composites.push({ input: images[rank], left: left + 9, top: top + 43 });
      else svg += `<text x="${left + 48}" y="${top + 108}" class="none">blocked</text>`;
    });
  }
  svg += "</svg>";

  const filename = `candidates-${String(offset / rowsPerSheet + 1).padStart(2, "0")}.png`;
  const outputPath = path.join(outputDirectory, filename);
  await sharp(background)
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...composites])
    .png()
    .toFile(outputPath);
  index.push({ filename, first: offset + 1, last: offset + page.length });
  console.log(`${filename}: ${offset + 1}–${offset + page.length}`);
}

await writeFile(path.join(outputDirectory, "index.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: report.generatedAt,
  sheets: index,
}, null, 2)}\n`, "utf8");
