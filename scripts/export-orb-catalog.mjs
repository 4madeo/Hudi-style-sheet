import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import opentype from "opentype.js";
import sharp from "sharp";

const { parse: parseOpenType } = opentype;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultConcurrency = Math.max(2, Math.min(8, Math.floor(availableParallelism() / 2)));
const defaultRelease = `orb-catalog-${new Date().toISOString().slice(0, 10)}`;
const scaleNames = ["generator", "ticker-page", "blotter"];
const fallbackColours = ["#3867d6", "#6657d9", "#a646d4", "#d13f78", "#d75a34", "#168c87", "#397f4a", "#47657f"];

function usage() {
  return `Usage: npm run export:catalog -- [options]

Generate every catalog orb as SVG and PNG with a bounded worker pool, then
create and validate a ZIP64 archive.

Options:
  --release NAME         Release directory and ZIP name (default: ${defaultRelease})
  --output PATH          Output parent (default: artifacts/orb-exports)
  --manifest PATH        Catalog manifest (default: public/logos/catalog/manifest.json)
  --concurrency NUMBER   Parallel company workers (default: ${defaultConcurrency})
  --theme light|dark     Export theme treatment (default: light)
  --limit NUMBER         Export only the first NUMBER entries for testing
  --sample NUMBER        Export a deterministic random sample of NUMBER entries
  --seed TEXT            Random-sample seed (default: release name and theme)
  --ids ID,ID            Export specific exchange-qualified catalog IDs
  --force                Regenerate assets for the same compatible release
  --no-zip               Generate and validate files without creating a ZIP
  --skip-zip-test        Do not run the final archive integrity test
  --help                 Show this help
`;
}

function optionValue(argv, index, label) {
  const argument = argv[index];
  const equals = argument.indexOf("=");
  if (equals !== -1) return { value: argument.slice(equals + 1), consumed: 0 };
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new TypeError(`${label} requires a value.`);
  return { value, consumed: 1 };
}

function parseArguments(argv) {
  const options = {
    manifest: path.join(root, "public/logos/catalog/manifest.json"),
    output: path.join(root, "artifacts/orb-exports"),
    release: defaultRelease,
    concurrency: defaultConcurrency,
    theme: "light",
    limit: null,
    sample: null,
    seed: null,
    ids: null,
    force: false,
    zip: true,
    testZip: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { ...options, help: true };
    if (argument === "--force") {
      options.force = true;
      continue;
    }
    if (argument === "--no-zip") {
      options.zip = false;
      continue;
    }
    if (argument === "--skip-zip-test") {
      options.testZip = false;
      continue;
    }

    const matched = [
      "--release", "--output", "--manifest", "--concurrency", "--theme",
      "--limit", "--sample", "--seed", "--ids",
    ]
      .find((name) => argument === name || argument.startsWith(`${name}=`));
    if (!matched) throw new TypeError(`Unknown option: ${argument}`);
    const { value, consumed } = optionValue(argv, index, matched);
    index += consumed;

    if (matched === "--release") options.release = value;
    if (matched === "--output") options.output = path.resolve(root, value);
    if (matched === "--manifest") options.manifest = path.resolve(root, value);
    if (matched === "--concurrency") options.concurrency = Number(value);
    if (matched === "--theme") options.theme = value;
    if (matched === "--limit") options.limit = Number(value);
    if (matched === "--sample") options.sample = Number(value);
    if (matched === "--seed") options.seed = value;
    if (matched === "--ids") options.ids = value.split(",").map((id) => id.trim()).filter(Boolean);
  }

  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 64) {
    throw new RangeError("--concurrency must be an integer from 1 to 64.");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new RangeError("--limit must be a positive integer.");
  }
  if (options.sample !== null && (!Number.isInteger(options.sample) || options.sample < 1)) {
    throw new RangeError("--sample must be a positive integer.");
  }
  if (options.theme !== "light" && options.theme !== "dark") {
    throw new TypeError("--theme must be light or dark.");
  }
  const selectionModes = [options.limit !== null, options.sample !== null, Boolean(options.ids)].filter(Boolean).length;
  if (selectionModes > 1) {
    throw new TypeError("Use only one of --limit, --sample, or --ids.");
  }
  if (options.seed && options.sample === null) {
    throw new TypeError("--seed can only be used with --sample.");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(options.release)) {
    throw new TypeError("--release may contain only letters, numbers, dots, underscores, and hyphens.");
  }
  return options;
}

function safeSegment(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function hashBytes(data) {
  return createHash("sha256").update(data).digest("hex");
}

async function hashFiles(paths) {
  const hash = createHash("sha256");
  for (const filePath of paths) {
    hash.update(path.relative(root, filePath));
    hash.update(await readFile(filePath));
  }
  return hash.digest("hex");
}

async function atomicWrite(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, data);
  await rename(temporary, filePath);
}

function fontArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function graphemes(value) {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)]
    .map((segment) => segment.segment);
}

const companySuffixes = new Set([
  "acquisition", "ag", "and", "class", "co", "company", "corp", "corporation",
  "fund", "group", "holding", "holdings", "inc", "international", "investment",
  "investments", "limited", "ltd", "ordinary", "plc", "shares", "the", "trust",
  "unit", "units", "warrant", "warrants",
]);

function companyMonogram(company, fallbackKey = company) {
  const words = (company.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => !companySuffixes.has(word.toLocaleLowerCase()));
  const meaningful = words.length ? words : (fallbackKey.match(/[\p{L}\p{N}]+/gu) ?? []);
  if (!meaningful.length) return "?";
  if (meaningful.length >= 2) {
    return meaningful.slice(0, 2).map((word) => graphemes(word)[0]).join("").toLocaleUpperCase();
  }
  return graphemes(meaningful[0]).slice(0, 2).join("").toLocaleUpperCase();
}

function monogramDataUrl(font, monogram) {
  const glyphCount = graphemes(monogram).length;
  const fontSize = glyphCount === 1 ? 70 : 58;
  const options = { kerning: true, letterSpacing: glyphCount === 1 ? 0 : -0.045 };
  const advanceWidth = font.getAdvanceWidth(monogram, fontSize, options);
  const fontXHeight = font.tables.os2?.sxHeight
    ?? font.charToGlyph("x").yMax
    ?? font.unitsPerEm * 0.5;
  const x = 50 - advanceWidth / 2;
  const y = 50 + fontXHeight / font.unitsPerEm * fontSize / 2;
  const pathData = font.getPath(monogram, x, y, fontSize, options).toPathData(3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${pathData}" fill="#000"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function stableIndex(key, length) {
  let hash = 2166136261;
  for (const character of String(key)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

function logoMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "image/png";
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "unknown";
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

async function fileSize(filePath) {
  const details = await stat(filePath);
  if (!details.isFile() || details.size === 0) throw new Error(`Asset is empty: ${filePath}`);
  return details.size;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const manifestBytes = await readFile(options.manifest);
  const manifest = JSON.parse(manifestBytes);
  if (!Array.isArray(manifest.entries)) throw new TypeError("Catalog manifest does not contain an entries array.");

  let entries = manifest.entries;
  if (options.ids) {
    const requested = new Set(options.ids);
    entries = entries.filter((entry) => requested.has(entry.id));
    const missingIds = [...requested].filter((id) => !entries.some((entry) => entry.id === id));
    if (missingIds.length) throw new Error(`Unknown catalog IDs: ${missingIds.join(", ")}`);
  } else if (options.sample !== null) {
    const seed = options.seed ?? `${options.release}:${options.theme}`;
    entries = entries
      .map((entry) => ({ entry, rank: hashBytes(`${seed}:${entry.id}`) }))
      .sort((left, right) => left.rank.localeCompare(right.rank))
      .map(({ entry }) => entry)
      .slice(0, options.sample);
    options.seed = seed;
  } else if (options.limit !== null) {
    entries = entries.slice(0, options.limit);
  }
  if (!entries.length) throw new Error("No catalog entries matched the export selection.");

  const releaseDirectory = path.join(options.output, options.release);
  const archivePath = path.join(options.output, `${options.release}.zip`);
  const statePath = path.join(releaseDirectory, "export-manifest.json");
  const rendererFiles = [
    fileURLToPath(import.meta.url),
    "components/orb/color.ts",
    "components/orb/palette.ts",
    "components/orb/presentation.ts",
    "components/orb/svg.ts",
    "components/orb/tokens.ts",
    "components/orb/types.ts",
    "public/fonts/diatype-expanded-bold.otf",
  ].map((filePath) => path.isAbsolute(filePath) ? filePath : path.join(root, filePath));
  const sourceManifestSha256 = hashBytes(manifestBytes);
  const rendererSha256 = await hashFiles(rendererFiles);
  const selectionSha256 = hashBytes(`${options.theme}\n${entries.map((entry) => entry.id).join("\n")}`);

  await mkdir(options.output, { recursive: true });
  let previousState = null;
  try {
    previousState = JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (previousState) {
    const incompatible = previousState.sourceManifestSha256 !== sourceManifestSha256
      || previousState.rendererSha256 !== rendererSha256
      || previousState.selectionSha256 !== selectionSha256;
    if (incompatible) {
      throw new Error(`Release ${options.release} was created from different catalog data or renderer code. Use a new --release name.`);
    }
  } else {
    try {
      const existing = await readdir(releaseDirectory);
      if (existing.length) throw new Error(`Release directory exists without export metadata: ${releaseDirectory}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await mkdir(releaseDirectory, { recursive: true });
  }

  const paths = new Map();
  for (const entry of entries) {
    const relativeDirectory = path.posix.join(
      safeSegment(entry.exchange).toLowerCase(),
      safeSegment(entry.symbol),
    );
    if (paths.has(relativeDirectory)) {
      throw new Error(`Export path collision between ${paths.get(relativeDirectory)} and ${entry.id}: ${relativeDirectory}`);
    }
    paths.set(relativeDirectory, entry.id);
  }

  const virtualEntry = `
    export { createLogoOrbSvg, ORB_EXPORT_SCALES } from "./components/orb/svg.ts";
    export { deriveOrbPalette } from "./components/orb/palette.ts";
    export { getOrbPresentation } from "./components/orb/presentation.ts";
  `;
  const bundled = await build({
    stdin: {
      contents: virtualEntry,
      loader: "ts",
      resolveDir: root,
      sourcefile: "orb-catalog-export-entry.ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    write: false,
    logLevel: "silent",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`;
  const { createLogoOrbSvg, deriveOrbPalette, getOrbPresentation, ORB_EXPORT_SCALES } = await import(moduleUrl);
  const displayData = await readFile(path.join(root, "public/fonts/diatype-expanded-bold.otf"));
  const displayFont = parseOpenType(fontArrayBuffer(displayData));

  const startedAt = Date.now();
  const results = new Array(entries.length);
  const failures = [];
  let cursor = 0;
  let completed = 0;
  let generated = 0;
  let resumed = 0;
  let lastReport = 0;

  const initialState = {
    version: 1,
    status: "generating",
    release: options.release,
    sourceManifest: path.relative(root, options.manifest),
    sourceManifestSha256,
    rendererSha256,
    selectionSha256,
    catalogGeneratedAt: manifest.generatedAt ?? null,
    catalogFinalizedAt: manifest.finalizedAt ?? null,
    entryCount: entries.length,
    expectedAssetCount: entries.length * scaleNames.length * 2,
    scales: Object.fromEntries(scaleNames.map((name) => [name, ORB_EXPORT_SCALES[name]])),
    formats: ["svg", "png"],
    theme: options.theme,
    sampleSeed: options.seed,
    concurrency: options.concurrency,
    startedAt: new Date(startedAt).toISOString(),
  };
  const preserveCompletedState = previousState?.status === "assets-complete" && !options.force;
  if (!preserveCompletedState) {
    await atomicWrite(statePath, `${JSON.stringify(initialState, null, 2)}\n`);
  }

  function reportProgress(force = false) {
    const now = Date.now();
    if (!force && completed !== entries.length && completed % 250 !== 0 && now - lastReport < 15_000) return;
    lastReport = now;
    const seconds = Math.max(0.001, (now - startedAt) / 1000);
    const rate = completed / seconds;
    const remaining = rate > 0 ? (entries.length - completed) / rate : Number.POSITIVE_INFINITY;
    console.log(
      `[${completed.toLocaleString()}/${entries.length.toLocaleString()}] `
      + `${(completed / entries.length * 100).toFixed(1)}% · generated ${generated.toLocaleString()} · `
      + `resumed ${resumed.toLocaleString()} · ${rate.toFixed(1)} companies/s · ETA ${formatDuration(remaining)}`,
    );
  }

  async function existingAssets(relativeDirectory) {
    const assets = {};
    try {
      for (const scaleName of scaleNames) {
        const svgRelative = path.posix.join(relativeDirectory, `${scaleName}.svg`);
        const pngRelative = path.posix.join(relativeDirectory, `${scaleName}.png`);
        assets[scaleName] = {
          svg: { path: svgRelative, bytes: await fileSize(path.join(releaseDirectory, svgRelative)) },
          png: { path: pngRelative, bytes: await fileSize(path.join(releaseDirectory, pngRelative)) },
        };
      }
      return assets;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async function exportEntry(entry) {
    const relativeDirectory = path.posix.join(
      safeSegment(entry.exchange).toLowerCase(),
      safeSegment(entry.symbol),
    );
    if (!options.force) {
      const existing = await existingAssets(relativeDirectory);
      if (existing) return { assets: existing, resumed: true, fallback: !entry.logo };
    }

    let logoHref = null;
    let palette;
    if (entry.logo) {
      const logoPath = path.join(root, "public", entry.logo.path.replace(/^\/+/, ""));
      const logoBytes = await readFile(logoPath);
      logoHref = `data:${logoMimeType(logoPath)};base64,${logoBytes.toString("base64")}`;
      palette = deriveOrbPalette(entry.logo.orbColour);
    } else {
      palette = deriveOrbPalette(fallbackColours[stableIndex(entry.id, fallbackColours.length)]);
      logoHref = monogramDataUrl(displayFont, companyMonogram(entry.company, entry.id));
    }

    const assets = {};
    for (const scaleName of scaleNames) {
      const size = ORB_EXPORT_SCALES[scaleName].size;
      const presentation = getOrbPresentation(palette, "", ORB_EXPORT_SCALES[scaleName].compact);
      const svg = createLogoOrbSvg(logoHref, palette, scaleName, {
        logoTreatment: entry.logo?.logoTreatment ?? (presentation.whiteText ? "light" : "dark"),
        logoScale: entry.logo?.logoScale ?? 0.58,
        title: `${entry.company}${entry.logo ? "" : " fallback"} ${scaleName} orb`,
        theme: options.theme,
      });
      if (!svg.includes(`width="${size}" height="${size}"`)) {
        throw new Error(`${entry.id} ${scaleName} SVG has incorrect dimensions.`);
      }
      if (/<text(?:\s|>)/i.test(svg) || /<textPath(?:\s|>)/i.test(svg)) {
        throw new Error(`${entry.id} ${scaleName} SVG contains a font-dependent text node.`);
      }
      const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
      const svgRelative = path.posix.join(relativeDirectory, `${scaleName}.svg`);
      const pngRelative = path.posix.join(relativeDirectory, `${scaleName}.png`);
      await Promise.all([
        atomicWrite(path.join(releaseDirectory, svgRelative), svg),
        atomicWrite(path.join(releaseDirectory, pngRelative), png),
      ]);
      assets[scaleName] = {
        svg: { path: svgRelative, bytes: Buffer.byteLength(svg) },
        png: { path: pngRelative, bytes: png.byteLength },
      };
    }
    return { assets, resumed: false, fallback: !entry.logo };
  }

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= entries.length) return;
      const entry = entries[index];
      try {
        const result = await exportEntry(entry);
        results[index] = {
          id: entry.id,
          exchange: entry.exchange,
          symbol: entry.symbol,
          company: entry.company,
          logoStatus: entry.logoStatus ?? (entry.logo ? "resolved" : "missing"),
          fallback: result.fallback,
          assets: result.assets,
        };
        if (result.resumed) resumed += 1;
        else generated += 1;
      } catch (error) {
        failures.push({
          id: entry.id,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        completed += 1;
        reportProgress();
      }
    }
  }

  console.log(
    `Exporting ${entries.length.toLocaleString()} companies with ${options.concurrency} workers to ${releaseDirectory}`,
  );
  await Promise.all(Array.from({ length: Math.min(options.concurrency, entries.length) }, () => worker()));
  reportProgress(true);

  if (failures.length) {
    const failurePath = path.join(releaseDirectory, "export-errors.json");
    await atomicWrite(failurePath, `${JSON.stringify({ failures }, null, 2)}\n`);
    await atomicWrite(statePath, `${JSON.stringify({
      ...initialState,
      status: "failed",
      completedAt: new Date().toISOString(),
      generated,
      resumed,
      failureCount: failures.length,
      failureReport: path.basename(failurePath),
    }, null, 2)}\n`);
    throw new Error(`${failures.length} catalog entries failed. See ${failurePath}`);
  }

  const rawAssetBytes = results.reduce((total, entry) => total + scaleNames.reduce((scaleTotal, scaleName) => (
    scaleTotal + entry.assets[scaleName].svg.bytes + entry.assets[scaleName].png.bytes
  ), 0), 0);
  const fallbackCount = results.filter((entry) => entry.fallback).length;
  const completedAt = new Date();
  const finalState = {
    ...initialState,
    status: "assets-complete",
    completedAt: completedAt.toISOString(),
    elapsedSeconds: Number(((completedAt.getTime() - startedAt) / 1000).toFixed(3)),
    generated,
    resumed,
    fallbackCount,
    assetCount: results.length * scaleNames.length * 2,
    rawAssetBytes,
    entries: results,
  };
  if (!(preserveCompletedState && generated === 0)) {
    await atomicWrite(statePath, `${JSON.stringify(finalState, null, 2)}\n`);
  }

  console.log(
    `Assets complete: ${(rawAssetBytes / 1_000_000_000).toFixed(2)} GB across ${finalState.assetCount.toLocaleString()} files `
    + `(${fallbackCount.toLocaleString()} fallback orbs).`,
  );
  if (!options.zip) {
    console.log("ZIP creation skipped by --no-zip.");
    return;
  }

  let archiveCreated = false;
  try {
    await access(archivePath);
    if (generated > 0 || options.force) {
      throw new Error(`Archive already exists and assets changed: ${archivePath}. Use a new --release name.`);
    }
    console.log(`Using existing archive: ${archivePath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const zipStartedAt = Date.now();
    const temporaryArchive = `${archivePath}.tmp-${process.pid}-${randomUUID()}.zip`;
    console.log(`Creating ZIP64 archive: ${archivePath}`);
    await runCommand("zip", [
      "-q", "-6", "-r", temporaryArchive, options.release,
      "-x", "*.tmp-*", "*/.DS_Store", ".DS_Store",
    ], {
      cwd: options.output,
    });
    if (options.testZip) {
      console.log("Testing temporary archive integrity…");
      await runCommand("unzip", ["-tq", temporaryArchive]);
    }
    await rename(temporaryArchive, archivePath);
    archiveCreated = true;
    console.log(`ZIP created and finalized in ${formatDuration((Date.now() - zipStartedAt) / 1000)}.`);
  }

  if (options.testZip && !archiveCreated) {
    const testStartedAt = Date.now();
    console.log("Testing archive integrity…");
    await runCommand("unzip", ["-tq", archivePath]);
    console.log(`Archive passed integrity testing in ${formatDuration((Date.now() - testStartedAt) / 1000)}.`);
  }
  const archiveBytes = (await stat(archivePath)).size;
  console.log(`Done: ${archivePath} (${(archiveBytes / 1_000_000_000).toFixed(2)} GB)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
