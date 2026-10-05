import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  inspectLocalRelease,
  parseArguments,
  planPublish,
  run,
} from "./publish-post-composer-catalog.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function createRelease(parent, releaseName = "test-release-v1", formatVersion = 2) {
  const releaseDirectory = path.join(parent, releaseName);
  await mkdir(path.join(releaseDirectory, "shards"), { recursive: true });
  const shards = {
    "00.json": JSON.stringify({ version: 1, assets: { "00-test": { data: "AA==" } } }),
    "01.json": JSON.stringify({ version: 1, assets: { "01-test": { data: "AQ==" } } }),
  };
  for (const [name, contents] of Object.entries(shards)) {
    await writeFile(path.join(releaseDirectory, "shards", name), contents);
  }
  const assetShards = Object.fromEntries(Object.entries(shards).map(([name, contents]) => [
    name.slice(0, 2),
    sha256(JSON.stringify(JSON.parse(contents))),
  ]));
  const manifest = {
    version: formatVersion,
    status: "assets-complete",
    release: releaseName,
    shardCount: Object.keys(shards).length,
    ...(formatVersion === 2 ? { assetShards } : {}),
    entries: [],
  };
  const manifestText = `${JSON.stringify(manifest)}\n`;
  await writeFile(path.join(releaseDirectory, "manifest.json"), manifestText);
  const release = {
    version: 1,
    release: releaseName,
    manifest: `releases/${releaseName}/manifest.json`,
    manifestSha256: sha256(JSON.stringify(manifest)),
    completedAt: "2026-08-24T00:00:00.000Z",
  };
  await writeFile(path.join(releaseDirectory, "release.json"), `${JSON.stringify(release, null, 2)}\n`);
  return releaseDirectory;
}

class FakeRemote {
  constructor({ corruptPutKey = null } = {}) {
    this.values = new Map();
    this.puts = [];
    this.bulkPuts = 0;
    this.corruptPutKey = corruptPutKey;
  }

  async list(prefix) {
    return new Set([...this.values.keys()].filter((key) => key.startsWith(prefix)));
  }

  async get(key) {
    if (!this.values.has(key)) throw new Error(`Missing fake key: ${key}`);
    return this.values.get(key);
  }

  async put(key, filePath) {
    this.puts.push(key);
    const value = await readFile(filePath, "utf8");
    this.values.set(key, key === this.corruptPutKey ? `${value} ` + "not-json" : value);
  }

  async putMany(files) {
    this.bulkPuts += 1;
    for (const file of files) {
      if (file.key === this.corruptPutKey) throw new Error(`Bulk upload failed for ${file.key}`);
      await this.put(file.key, file.path);
    }
  }
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "orb-publisher-test-"));
const releaseDirectory = await createRelease(temporaryRoot);
const local = await inspectLocalRelease(releaseDirectory, "test-release-v1");

assert.throws(
  () => parseArguments([
    "--release", "test-release-v1",
    "--namespace-id", "a".repeat(32),
    "--max-writes", "301",
  ]),
  /hard ceiling of 300/,
);

const emptyRemote = new FakeRemote();
const initialPlan = await planPublish(local, emptyRemote, {
  activate: true,
  channelKey: "channels/current.json",
});
assert.equal(initialPlan.missingFiles.length, 3);
assert.equal(initialPlan.writeCount, 4);

const historyPath = path.join(temporaryRoot, "history.json");
const baseOptions = {
  release: "test-release-v1",
  releaseDirectory,
  namespaceId: "a".repeat(32),
  channelKey: "channels/current.json",
  wrangler: null,
  historyPath,
  remainingWrites: 4,
  maxWrites: 300,
  apply: true,
  activate: true,
  help: false,
};
await run(baseOptions, emptyRemote);
assert.equal(emptyRemote.bulkPuts, 1, "release shards should use one bulk upload");
assert.deepEqual(emptyRemote.puts, [
  `asset-shards/${local.files[0].hash}.json`,
  `asset-shards/${local.files[1].hash}.json`,
  "releases/test-release-v1/manifest.json",
  "channels/current.json",
]);

const putCount = emptyRemote.puts.length;
const retryPlan = await run({ ...baseOptions, remainingWrites: 0 }, emptyRemote);
assert.equal(retryPlan.writeCount, 0);
assert.equal(emptyRemote.puts.length, putCount, "an identical retry must write nothing");

const secondReleaseDirectory = await createRelease(temporaryRoot, "test-release-v2");
const secondLocal = await inspectLocalRelease(secondReleaseDirectory, "test-release-v2");
const incrementalPlan = await planPublish(secondLocal, emptyRemote, {
  activate: true,
  channelKey: "channels/current.json",
});
assert.deepEqual(
  incrementalPlan.missingFiles.map((file) => file.key),
  ["releases/test-release-v2/manifest.json"],
  "A later release must reuse identical global asset shards.",
);
assert.equal(incrementalPlan.writeCount, 2, "Only the new manifest and channel pointer should be written.");

emptyRemote.values.set("releases/test-release-v1/manifest.json", JSON.stringify({ changed: true }));
await assert.rejects(
  planPublish(local, emptyRemote, { activate: false, channelKey: "channels/current.json" }),
  /Refusing to overwrite immutable key/,
);

const corruptRemote = new FakeRemote({
  corruptPutKey: `asset-shards/${local.files[1].hash}.json`,
});
await assert.rejects(
  run({
    ...baseOptions,
    historyPath: path.join(temporaryRoot, "corrupt-history.json"),
  }, corruptRemote),
  /Bulk upload failed/,
);
assert.equal(
  corruptRemote.values.has("channels/current.json"),
  false,
  "the channel must remain untouched when release verification fails",
);

console.log("Post Composer publisher safeguards passed.");
