import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRelease = `logo-orbs-${new Date().toISOString().slice(0, 10)}`;

function usage() {
  return `Usage: npm run export:post-composer -- [options]

Create a versioned Post Composer handoff containing the approved adjusted logo
assets and complete logo-orb rendering recipes. Assets are base64-packed into
256 content-addressed shards so the hosted Worker can publish the full catalog
without thousands of individual upload commands.

Options:
  --release NAME       Immutable release name (default: ${defaultRelease})
  --output PATH        Output parent (default: artifacts/post-composer-catalog)
  --manifest PATH      Source catalog (default: public/logos/catalog/manifest.json)
  --crypto-manifest PATH
                       Crypto catalog merged into the same collection
                       (default: public/logos/crypto/manifest.json)
  --no-crypto          Export the company catalog without crypto entries
  --limit NUMBER       Export the first NUMBER logo entries for testing
  --help               Show this help
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
    release: defaultRelease,
    output: path.join(root, "artifacts/post-composer-catalog"),
    manifest: path.join(root, "public/logos/catalog/manifest.json"),
    cryptoManifest: path.join(root, "public/logos/crypto/manifest.json"),
    includeCrypto: true,
    limit: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { ...options, help: true };
    if (argument === "--no-crypto") {
      options.includeCrypto = false;
      continue;
    }
    const matched = ["--release", "--output", "--manifest", "--crypto-manifest", "--limit"]
      .find((name) => argument === name || argument.startsWith(`${name}=`));
    if (!matched) throw new TypeError(`Unknown option: ${argument}`);
    const { value, consumed } = optionValue(argv, index, matched);
    index += consumed;
    if (matched === "--release") options.release = value;
    if (matched === "--output") options.output = path.resolve(root, value);
    if (matched === "--manifest") options.manifest = path.resolve(root, value);
    if (matched === "--crypto-manifest") options.cryptoManifest = path.resolve(root, value);
    if (matched === "--limit") options.limit = Number(value);
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(options.release)) {
    throw new TypeError("--release may contain only letters, numbers, dots, underscores, and hyphens.");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new TypeError("--limit must be a positive integer.");
  }
  return options;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normaliseSearch(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const companySuffixes = new Set([
  "ag", "class", "co", "company", "corp", "corporation", "group", "holding",
  "holdings", "inc", "international", "limited", "ltd", "ordinary", "plc",
  "shares", "the",
]);

function withoutCompanySuffixes(value) {
  return normaliseSearch(value)
    .split(" ")
    .filter((word) => word && !companySuffixes.has(word))
    .join(" ");
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "image/png";
}

async function atomicWrite(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporary, contents);
  await rename(temporary, filePath);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const manifestBytes = await readFile(options.manifest);
  const source = JSON.parse(manifestBytes);
  if (!Array.isArray(source.entries)) throw new TypeError("Catalog manifest has no entries array.");
  const cryptoManifestBytes = options.includeCrypto
    ? await readFile(options.cryptoManifest)
    : undefined;
  const cryptoSource = cryptoManifestBytes ? JSON.parse(cryptoManifestBytes) : undefined;
  if (cryptoSource && !Array.isArray(cryptoSource.entries)) {
    throw new TypeError("Crypto catalog manifest has no entries array.");
  }
  const sourceEntries = [
    ...source.entries.filter((entry) => entry.logo?.path),
    ...(cryptoSource?.entries ?? []).filter((entry) => entry.logo?.path),
  ];
  const idCounts = new Map();
  for (const entry of sourceEntries) {
    idCounts.set(entry.id, (idCounts.get(entry.id) ?? 0) + 1);
  }
  const duplicateIds = [...idCounts]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  if (duplicateIds.length) {
    throw new Error(`Duplicate listing IDs across source catalogs: ${duplicateIds.slice(0, 10).join(", ")}`);
  }
  const selectedEntries = options.limit === null
    ? sourceEntries
    : sourceEntries.slice(0, options.limit);
  if (!selectedEntries.length) throw new Error("No adjusted logo entries matched the export.");

  const releaseDirectory = path.join(options.output, options.release);
  try {
    const details = await stat(releaseDirectory);
    if (details.isDirectory()) {
      throw new Error(`Immutable release already exists: ${releaseDirectory}. Use a new release name.`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(path.join(releaseDirectory, "shards"), { recursive: true });

  const rendererFiles = [
    "components/orb/color.ts",
    "components/orb/palette.ts",
    "components/orb/presentation.ts",
    "components/orb/svg.ts",
    "components/orb/tokens.ts",
    "components/orb/types.ts",
  ];
  const rendererHash = createHash("sha256");
  for (const relativePath of rendererFiles) {
    rendererHash.update(relativePath);
    rendererHash.update(await readFile(path.join(root, relativePath)));
  }

  const bundled = await build({
    stdin: {
      contents: 'export { deriveOrbPalette } from "./components/orb/palette.ts";',
      loader: "ts",
      resolveDir: root,
      sourcefile: "post-composer-palette-entry.ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    write: false,
    logLevel: "silent",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`;
  const { deriveOrbPalette } = await import(moduleUrl);

  const assets = new Map();
  const entries = [];
  for (const entry of selectedEntries) {
    const assetPath = path.join(root, "public", entry.logo.path.replace(/^\/+/, ""));
    const bytes = await readFile(assetPath);
    const assetHash = sha256(bytes);
    if (!assets.has(assetHash)) {
      assets.set(assetHash, {
        mimeType: mimeType(assetPath),
        bytes: bytes.byteLength,
        data: bytes.toString("base64"),
      });
    }
    const searchKeys = new Set([
      entry.id,
      entry.symbol,
      entry.company,
      withoutCompanySuffixes(entry.company),
      entry.logo.referenceSymbol,
      entry.cmcSlug,
    ].map(normaliseSearch).filter(Boolean));
    entries.push({
      id: entry.id,
      exchange: entry.exchange,
      symbol: entry.symbol,
      company: entry.company,
      searchKeys: [...searchKeys],
      publiclyOnHudi: entry.publiclyOnHudi === true,
      programStatus: entry.programStatus ?? null,
      logoStatus: entry.logoStatus ?? "resolved",
      fallback: false,
      asset: {
        hash: assetHash,
        shard: assetHash.slice(0, 2),
        mimeType: assets.get(assetHash).mimeType,
        bytes: assets.get(assetHash).bytes,
      },
      material: deriveOrbPalette(entry.logo.orbColour ?? "#394150"),
      logo: {
        treatment: entry.logo.logoTreatment ?? "original",
        scale: entry.logo.logoScale ?? 0.56,
        offsetX: 0,
        offsetY: entry.logo.logoOffsetY ?? 0,
      },
    });
  }

  const shards = new Map();
  for (const [hash, asset] of assets) {
    const shardKey = hash.slice(0, 2);
    const shard = shards.get(shardKey) ?? {};
    shard[hash] = asset;
    shards.set(shardKey, shard);
  }
  await Promise.all([...shards].map(([shard, shardAssets]) => atomicWrite(
    path.join(releaseDirectory, "shards", `${shard}.json`),
    JSON.stringify({ version: 1, assets: shardAssets }),
  )));

  const completedAt = new Date().toISOString();
  const manifest = {
    version: 1,
    status: "assets-complete",
    release: options.release,
    rendererVersion: `logo-orb-v2-${rendererHash.digest("hex").slice(0, 12)}`,
    sourceManifest: path.relative(root, options.manifest),
    sourceManifestSha256: sha256(manifestBytes),
    sourceManifests: [
      {
        kind: "company",
        path: path.relative(root, options.manifest),
        sha256: sha256(manifestBytes),
        resolvedEntries: source.entries.filter((entry) => entry.logo?.path).length,
      },
      ...(cryptoManifestBytes ? [{
        kind: "crypto",
        path: path.relative(root, options.cryptoManifest),
        sha256: sha256(cryptoManifestBytes),
        resolvedEntries: cryptoSource.entries.filter((entry) => entry.logo?.path).length,
      }] : []),
    ],
    catalogGeneratedAt: source.generatedAt ?? null,
    catalogFinalizedAt: source.finalizedAt ?? null,
    cryptoGeneratedAt: cryptoSource?.generatedAt ?? null,
    completedAt,
    entryCount: entries.length,
    uniqueAssetCount: assets.size,
    shardCount: shards.size,
    rawAssetBytes: [...assets.values()].reduce((total, asset) => total + asset.bytes, 0),
    entries,
  };
  await atomicWrite(
    path.join(releaseDirectory, "manifest.json"),
    `${JSON.stringify(manifest)}\n`,
  );
  await atomicWrite(
    path.join(releaseDirectory, "release.json"),
    `${JSON.stringify({
      version: 1,
      release: options.release,
      manifest: `releases/${options.release}/manifest.json`,
      manifestSha256: sha256(JSON.stringify(manifest)),
      completedAt,
    }, null, 2)}\n`,
  );

  console.log(
    `Created ${options.release}: ${entries.length.toLocaleString()} listings, `
    + `${assets.size.toLocaleString()} adjusted assets, ${shards.size} shards, `
    + `${(manifest.rawAssetBytes / 1_000_000).toFixed(1)} MB raw.`,
  );
  console.log(releaseDirectory);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
