import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(root, "artifacts/post-composer-catalog");
const defaultHistoryPath = path.join(artifactRoot, ".publish-history.json");
const defaultChannelKey = "channels/current.json";
const hardWriteLimit = 300;
const dailyWriteLimit = 900;
const dailyReleaseLimit = 3;
const bulkPayloadLimit = 20 * 1024 * 1024;

function usage() {
  return `Usage: npm run publish:post-composer -- --release NAME [options]

Plan an idempotent Cloudflare KV release publish. The command is read-only unless
--apply is present. Activation is a separate --activate choice and happens only
after every immutable release key has been verified.

Required:
  --release NAME          Local release under artifacts/post-composer-catalog
  --namespace-id ID       Cloudflare KV namespace (or CLOUDFLARE_KV_NAMESPACE_ID)

Write controls:
  --apply                 Perform the planned writes (default: plan only)
  --activate              Point channels/current.json at the verified release
  --remaining-writes N    Current remaining KV writes from Cloudflare; required
                          with --apply whenever the plan contains writes
  --max-writes N          Per-run ceiling, at most ${hardWriteLimit} (default: ${hardWriteLimit})

Other options:
  --release-dir PATH      Use an explicit release directory
  --channel-key KEY       Activation key (default: ${defaultChannelKey})
  --wrangler PATH         Wrangler executable (default: local binary or PATH)
  --history PATH          Local UTC-day safety journal
  --help                  Show this help

The publisher also refuses a fourth distinct release or more than
${dailyWriteLimit} recorded writes in one UTC day. Format-v2 releases reuse
immutable global asset shards by content hash, so an unchanged shard costs no
write in later releases. Existing release manifests are hash-checked and never
overwritten.
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

export function parseArguments(argv, environment = process.env) {
  const options = {
    release: null,
    releaseDirectory: null,
    namespaceId: environment.CLOUDFLARE_KV_NAMESPACE_ID ?? null,
    channelKey: defaultChannelKey,
    wrangler: null,
    historyPath: defaultHistoryPath,
    remainingWrites: null,
    maxWrites: hardWriteLimit,
    apply: false,
    activate: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (argument === "--activate") {
      options.activate = true;
      continue;
    }
    const matched = [
      "--release", "--release-dir", "--namespace-id", "--channel-key",
      "--wrangler", "--history", "--remaining-writes", "--max-writes",
    ].find((name) => argument === name || argument.startsWith(`${name}=`));
    if (!matched) throw new TypeError(`Unknown option: ${argument}`);
    const { value, consumed } = optionValue(argv, index, matched);
    index += consumed;
    if (matched === "--release") options.release = value;
    if (matched === "--release-dir") options.releaseDirectory = path.resolve(root, value);
    if (matched === "--namespace-id") options.namespaceId = value;
    if (matched === "--channel-key") options.channelKey = value;
    if (matched === "--wrangler") options.wrangler = path.resolve(root, value);
    if (matched === "--history") options.historyPath = path.resolve(root, value);
    if (matched === "--remaining-writes") options.remainingWrites = Number(value);
    if (matched === "--max-writes") options.maxWrites = Number(value);
  }

  if (options.help) return options;
  if (!options.release && !options.releaseDirectory) {
    throw new TypeError("--release or --release-dir is required.");
  }
  if (options.release && !/^[a-z0-9][a-z0-9._-]*$/i.test(options.release)) {
    throw new TypeError("--release may contain only letters, numbers, dots, underscores, and hyphens.");
  }
  if (!options.namespaceId) {
    throw new TypeError("--namespace-id or CLOUDFLARE_KV_NAMESPACE_ID is required.");
  }
  if (!/^[a-f0-9]{32}$/i.test(options.namespaceId)) {
    throw new TypeError("--namespace-id must be a 32-character hexadecimal KV namespace ID.");
  }
  for (const [label, value] of [
    ["--remaining-writes", options.remainingWrites],
    ["--max-writes", options.maxWrites],
  ]) {
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      throw new TypeError(`${label} must be a non-negative integer.`);
    }
  }
  if (options.maxWrites > hardWriteLimit) {
    throw new TypeError(`--max-writes cannot exceed the hard ceiling of ${hardWriteLimit}.`);
  }
  return options;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function canonicalJson(value, label) {
  return JSON.stringify(parseJson(value, label));
}

function canonicalHash(value, label) {
  return sha256(canonicalJson(value, label));
}

async function existingExecutable(options) {
  if (options.wrangler) return options.wrangler;
  const local = path.join(root, "node_modules/.bin/wrangler");
  try {
    await access(local);
    return local;
  } catch {
    return "wrangler";
  }
}

export async function inspectLocalRelease(releaseDirectory, requestedRelease = null) {
  const releasePath = path.join(releaseDirectory, "release.json");
  const manifestPath = path.join(releaseDirectory, "manifest.json");
  const [releaseText, manifestText, shardNames] = await Promise.all([
    readFile(releasePath, "utf8"),
    readFile(manifestPath, "utf8"),
    readdir(path.join(releaseDirectory, "shards")),
  ]);
  const release = parseJson(releaseText, releasePath);
  const manifest = parseJson(manifestText, manifestPath);
  const releaseName = requestedRelease ?? release.release;

  if (!releaseName || release.release !== releaseName || manifest.release !== releaseName) {
    throw new Error("The requested release, release.json, and manifest.json release names must match.");
  }
  if (manifest.status !== "assets-complete") {
    throw new Error(`Release ${releaseName} is not assets-complete.`);
  }
  const manifestKey = `releases/${releaseName}/manifest.json`;
  if (release.manifest !== manifestKey) {
    throw new Error(`release.json must point to ${manifestKey}.`);
  }
  const actualManifestHash = canonicalHash(manifestText, manifestPath);
  if (release.manifestSha256 !== actualManifestHash) {
    throw new Error("release.json manifestSha256 does not match manifest.json.");
  }

  const shardFiles = shardNames
    .filter((name) => /^[a-f0-9]{2}\.json$/i.test(name))
    .sort();
  if (shardFiles.length !== manifest.shardCount) {
    throw new Error(`Manifest expects ${manifest.shardCount} shards but found ${shardFiles.length}.`);
  }

  const incremental = manifest.version === 2;
  const assetShards = manifest.assetShards;
  if (incremental && (
    !assetShards ||
    typeof assetShards !== "object" ||
    Array.isArray(assetShards) ||
    Object.keys(assetShards).length !== shardFiles.length
  )) {
    throw new Error("Format-v2 manifest must map every shard prefix to an immutable bundle hash.");
  }

  const files = [];
  for (const fileName of shardFiles) {
    const filePath = path.join(releaseDirectory, "shards", fileName);
    const text = await readFile(filePath, "utf8");
    parseJson(text, filePath);
    const hash = canonicalHash(text, filePath);
    const shard = fileName.slice(0, 2).toLowerCase();
    const bundle = incremental ? assetShards[shard] : null;
    if (incremental && (!/^[a-f0-9]{64}$/i.test(bundle ?? "") || bundle !== hash)) {
      throw new Error(`Format-v2 shard ${fileName} does not match manifest.assetShards.${shard}.`);
    }
    files.push({
      key: incremental
        ? `asset-shards/${bundle}.json`
        : `releases/${releaseName}/shards/${fileName}`,
      path: filePath,
      hash,
      kind: "asset-shard",
    });
  }
  files.push({
    key: manifestKey,
    path: manifestPath,
    hash: actualManifestHash,
    kind: "release-manifest",
  });

  return {
    releaseName,
    releaseDirectory,
    releasePath,
    releaseText,
    releaseHash: canonicalHash(releaseText, releasePath),
    manifestKey,
    incremental,
    files,
  };
}

function jsonFromWranglerOutput(output, label) {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstArray = trimmed.indexOf("[");
    const lastArray = trimmed.lastIndexOf("]");
    if (firstArray !== -1 && lastArray > firstArray) {
      return parseJson(trimmed.slice(firstArray, lastArray + 1), label);
    }
    throw new Error(`Could not parse Wrangler JSON output for ${label}.`);
  }
}

export class WranglerKv {
  constructor({ executable, namespaceId }) {
    this.executable = executable;
    this.namespaceId = namespaceId;
  }

  async run(argumentsList) {
    try {
      const { stdout } = await execFileAsync(this.executable, argumentsList, {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 128 * 1024 * 1024,
      });
      return stdout;
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(
          `Wrangler was not found at ${this.executable}. Install it locally or pass --wrangler PATH.`,
        );
      }
      const details = String(error?.stderr ?? error?.stdout ?? error?.message ?? error).trim();
      throw new Error(`Wrangler failed: ${details}`);
    }
  }

  async list(prefix) {
    const output = await this.run([
      "kv", "key", "list",
      "--namespace-id", this.namespaceId,
      "--prefix", prefix,
      "--remote",
    ]);
    const result = jsonFromWranglerOutput(output, `prefix ${prefix}`);
    if (!Array.isArray(result)) throw new Error("Wrangler key list did not return an array.");
    return new Set(result.map((entry) => entry.name));
  }

  async get(key) {
    return this.run([
      "kv", "key", "get", key,
      "--namespace-id", this.namespaceId,
      "--remote",
      "--text",
    ]);
  }

  async put(key, filePath) {
    await this.run([
      "kv", "key", "put", key,
      "--path", filePath,
      "--namespace-id", this.namespaceId,
      "--remote",
    ]);
  }

  async putMany(files) {
    if (!files.length) return;
    const chunks = [];
    let chunk = [];
    let chunkBytes = 2;
    for (const file of files) {
      const value = await readFile(file.path, "utf8");
      const entry = { key: file.key, value };
      const entryBytes = Buffer.byteLength(JSON.stringify(entry)) + 1;
      if (chunk.length && chunkBytes + entryBytes > bulkPayloadLimit) {
        chunks.push(chunk);
        chunk = [];
        chunkBytes = 2;
      }
      chunk.push(entry);
      chunkBytes += entryBytes;
    }
    if (chunk.length) chunks.push(chunk);

    await mkdir(artifactRoot, { recursive: true });
    for (let index = 0; index < chunks.length; index += 1) {
      const payloadPath = path.join(
        artifactRoot,
        `.bulk-${process.pid}-${Date.now()}-${index}.json`,
      );
      try {
        await writeFile(payloadPath, JSON.stringify(chunks[index]));
        await this.run([
          "kv", "bulk", "put", payloadPath,
          "--namespace-id", this.namespaceId,
          "--remote",
        ]);
      } finally {
        await rm(payloadPath, { force: true });
      }
    }
  }
}

export async function planPublish(local, remote, { activate, channelKey }) {
  const remoteReleaseKeys = await remote.list(`releases/${local.releaseName}/`);
  const releaseFiles = local.files.filter((file) => file.kind === "release-manifest");
  const assetFiles = local.files.filter((file) => file.kind === "asset-shard");
  const remoteAssetKeys = local.incremental
    ? await remote.list("asset-shards/")
    : remoteReleaseKeys;
  const expectedKeys = new Set(releaseFiles.map((file) => file.key));
  if (!local.incremental) {
    for (const file of assetFiles) expectedKeys.add(file.key);
  }
  const unexpectedKeys = [...remoteReleaseKeys].filter((key) => !expectedKeys.has(key));
  if (unexpectedKeys.length) {
    throw new Error(
      `Immutable release ${local.releaseName} has unexpected remote keys: ${unexpectedKeys.slice(0, 5).join(", ")}`,
    );
  }

  const missingFiles = [];
  const remoteHas = (file) => file.kind === "asset-shard"
    ? remoteAssetKeys.has(file.key)
    : remoteReleaseKeys.has(file.key);
  if (remoteReleaseKeys.has(local.manifestKey)) {
    const remoteManifest = await remote.get(local.manifestKey);
    const remoteHash = canonicalHash(remoteManifest, `remote ${local.manifestKey}`);
    const manifest = local.files.find((file) => file.key === local.manifestKey);
    if (!manifest || remoteHash !== manifest.hash) {
      throw new Error(`Refusing to overwrite immutable key with different content: ${local.manifestKey}`);
    }
    missingFiles.push(...local.files.filter((file) => !remoteHas(file)));
  } else {
    for (const file of local.files) {
      if (!remoteHas(file)) {
        missingFiles.push(file);
        continue;
      }
      // Format-v2 asset keys include their canonical JSON hash. Their presence
      // is therefore enough to reuse them without spending a KV read per shard.
      if (local.incremental && file.kind === "asset-shard") continue;
      const remoteText = await remote.get(file.key);
      const remoteHash = canonicalHash(remoteText, `remote ${file.key}`);
      if (remoteHash !== file.hash) {
        throw new Error(`Refusing to overwrite immutable key with different content: ${file.key}`);
      }
    }
  }

  const channelKeys = await remote.list(channelKey);
  let channelMatches = false;
  if (channelKeys.has(channelKey)) {
    const remoteChannel = await remote.get(channelKey);
    channelMatches = canonicalHash(remoteChannel, `remote ${channelKey}`) === local.releaseHash;
  }
  const channelWrite = activate && !channelMatches;
  return {
    missingFiles,
    existingFiles: local.files.length - missingFiles.length,
    channelMatches,
    channelWrite,
    writeCount: missingFiles.length + Number(channelWrite),
  };
}

async function readHistory(historyPath) {
  try {
    const history = parseJson(await readFile(historyPath, "utf8"), historyPath);
    return history?.version === 1 && Array.isArray(history.writes)
      ? history
      : { version: 1, writes: [] };
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, writes: [] };
    throw error;
  }
}

async function recordWrite(historyPath, history, release, key) {
  history.writes.push({ at: new Date().toISOString(), release, key });
  await mkdir(path.dirname(historyPath), { recursive: true });
  const temporary = `${historyPath}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(history, null, 2)}\n`);
  await rename(temporary, historyPath);
}

async function recordWrites(historyPath, history, release, keys) {
  if (!keys.length) return;
  const at = new Date().toISOString();
  history.writes.push(...keys.map((key) => ({ at, release, key })));
  await mkdir(path.dirname(historyPath), { recursive: true });
  const temporary = `${historyPath}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(history, null, 2)}\n`);
  await rename(temporary, historyPath);
}

function todayHistory(history) {
  const utcDay = new Date().toISOString().slice(0, 10);
  const writes = history.writes.filter((entry) => String(entry.at).startsWith(utcDay));
  const releases = new Set(
    writes
      .filter((entry) => entry.key.startsWith("releases/"))
      .map((entry) => entry.release),
  );
  return { utcDay, writes, releases };
}

function enforceBudgets(options, plan, history, releaseName) {
  if (plan.writeCount > options.maxWrites) {
    throw new Error(
      `Plan needs ${plan.writeCount} writes, exceeding the per-run limit of ${options.maxWrites}.`,
    );
  }
  const today = todayHistory(history);
  if (today.writes.length + plan.writeCount > dailyWriteLimit) {
    throw new Error(
      `Plan would exceed the local UTC-day safety cap of ${dailyWriteLimit} writes (${today.writes.length} already recorded).`,
    );
  }
  const addsRelease = plan.missingFiles.length > 0 && !today.releases.has(releaseName);
  if (addsRelease && today.releases.size >= dailyReleaseLimit) {
    throw new Error(`Refusing a fourth distinct release on ${today.utcDay} UTC.`);
  }
  if (options.apply && plan.writeCount > 0 && options.remainingWrites === null) {
    throw new Error("--remaining-writes is required for an applying run that contains writes.");
  }
  if (options.remainingWrites !== null && plan.writeCount > options.remainingWrites) {
    throw new Error(
      `Plan needs ${plan.writeCount} writes but Cloudflare has only ${options.remainingWrites} remaining.`,
    );
  }
}

async function verifyRelease(local, remote) {
  const remoteKeys = await remote.list(`releases/${local.releaseName}/`);
  const remoteAssetKeys = local.incremental
    ? await remote.list("asset-shards/")
    : remoteKeys;
  for (const file of local.files) {
    const keys = file.kind === "asset-shard" ? remoteAssetKeys : remoteKeys;
    if (!keys.has(file.key)) throw new Error(`Verification failed; missing ${file.key}.`);
  }
  const manifest = local.files.find((file) => file.key === local.manifestKey);
  const remoteManifest = await remote.get(local.manifestKey);
  if (!manifest || canonicalHash(remoteManifest, `remote ${local.manifestKey}`) !== manifest.hash) {
    throw new Error(`Verification failed; hash mismatch for ${local.manifestKey}.`);
  }
}

function printPlan(local, plan, options, history) {
  const today = todayHistory(history);
  console.log(`Release: ${local.releaseName}`);
  console.log(`Remote release keys already matching: ${plan.existingFiles}/${local.files.length}`);
  console.log(`Release writes needed: ${plan.missingFiles.length}`);
  console.log(`Channel: ${plan.channelMatches ? "already active" : options.activate ? "activation requested" : "unchanged"}`);
  console.log(`Total planned writes: ${plan.writeCount}/${options.maxWrites}`);
  console.log(`Writes recorded by this publisher on ${today.utcDay} UTC: ${today.writes.length}/${dailyWriteLimit}`);
  if (!options.apply) console.log("Plan only; Cloudflare was not changed.");
}

export async function run(options, injectedRemote = null) {
  const releaseDirectory = options.releaseDirectory
    ?? path.join(artifactRoot, options.release);
  const local = await inspectLocalRelease(releaseDirectory, options.release);
  const remote = injectedRemote ?? new WranglerKv({
    executable: await existingExecutable(options),
    namespaceId: options.namespaceId,
  });
  const history = await readHistory(options.historyPath);
  const plan = await planPublish(local, remote, options);
  enforceBudgets(options, plan, history, local.releaseName);
  printPlan(local, plan, options, history);

  if (!options.apply || plan.writeCount === 0) return plan;

  const manifest = plan.missingFiles.find((file) => file.kind === "release-manifest");
  const shards = plan.missingFiles.filter((file) => file.kind === "asset-shard");
  if (shards.length) {
    if (typeof remote.putMany === "function") await remote.putMany(shards);
    else {
      for (const file of shards) await remote.put(file.key, file.path);
    }
    await recordWrites(
      options.historyPath,
      history,
      local.releaseName,
      shards.map((file) => file.key),
    );
  }
  if (manifest) {
    await remote.put(manifest.key, manifest.path);
    await recordWrite(options.historyPath, history, local.releaseName, manifest.key);
  }

  await verifyRelease(local, remote);
  console.log(`Verified ${local.files.length} immutable release keys.`);

  if (plan.channelWrite) {
    await remote.put(options.channelKey, local.releasePath);
    await recordWrite(options.historyPath, history, local.releaseName, options.channelKey);
    const remoteChannel = await remote.get(options.channelKey);
    if (canonicalHash(remoteChannel, `remote ${options.channelKey}`) !== local.releaseHash) {
      throw new Error(`Activation verification failed for ${options.channelKey}.`);
    }
    console.log(`Activated ${local.releaseName} at ${options.channelKey}.`);
  } else {
    console.log("Release verified; channel was not changed.");
  }
  return plan;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  await run(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
