# Local Logo Orb release workflow

## Purpose

Keep a private local copy of each immutable Logo Orb release so a future request
to add or update an orb does not depend on the hosted Worker being available.
The local copy is build-time source material for consumer repositories; it is
not a runtime service.

Downloaded and generated releases belong under:

```text
artifacts/post-composer-catalog/<release>/
```

That directory is already ignored by Git. Do not commit release payloads,
Cloudflare credentials, API tokens, namespace IDs, or local publish history.
The exporter, publisher, source manifests, and this workflow document may remain
tracked.

## Release structure

A complete local release has this shape:

```text
<release>/
├── release.json
├── manifest.json
└── shards/
    ├── 00.json
    ├── 01.json
    └── ...
```

`manifest.json` must report `version: 1` and `status: "assets-complete"`.
Entries contain stable exchange-qualified listing IDs, recipes, asset hashes,
MIME types, byte counts, and shard names. Shards contain the corresponding
base64-packed SVG or PNG bytes, keyed by SHA-256.

## Preferred path: generate locally

After adding or correcting an orb in this repository, export a new immutable
release rather than editing an existing release directory:

```sh
npm run export:post-composer -- \
  --release logo-orbs-YYYY-MM-DD-description-v1
```

The output is written to the ignored local release directory. Keep that folder
until every consumer has imported and verified the release. If the same release
was also published to Cloudflare, its bytes and hashes must remain identical to
the local copy.

## Recovery path: reconstruct from Cloudflare KV

Cloudflare uses the same logical release structure:

```text
channels/current.json
releases/<release>/manifest.json
releases/<release>/shards/<two-character-shard>.json
```

If the local copy is missing, use authenticated, read-only Wrangler commands to
retrieve `channels/current.json`, then its referenced manifest, then every unique
shard named by `manifest.entries[].asset.shard`. Save the channel payload as
`release.json` and preserve the folder structure above.

Keep `CLOUDFLARE_KV_NAMESPACE_ID` and Wrangler authentication in the local shell
or an ignored `.env.local`; never paste them into source, documentation, an iOS
project, or a pull request. Downloading must not activate a channel, publish a
release, or consume KV writes.

Before using a recovered release, verify that the release names agree, the
manifest is `assets-complete`, every referenced shard exists, every asset byte
count and MIME type matches, and every decoded asset has the recorded SHA-256.
The existing iOS importer performs the asset-level checks for its selected
subset.

## Adding or updating an orb for iOS

1. Add or correct the source logo and recipe in Orb System. Use the canonical
   listing ID and mark the entry `publiclyOnHudi` when it belongs in the shared
   HUDI selection.
2. Export a newly named immutable release into the ignored local directory.
3. In `hudi-ios`, run its checked-in importer against that release:

   ```sh
   node Hudi/Scripts/sync-logo-orbs.mjs \
     --release-dir "/path/to/orb gen/artifacts/post-composer-catalog/<release>" \
     --replace
   ```

4. Review the generated iOS catalog and asset changes, verify any new
   `MarketLogo` listing-ID mapping, build Staging, and ship the update through an
   iOS pull request and app release.

Installed apps do not synchronize from Orb System or Cloudflare. They keep the
catalog bundled in their build until the user installs a newer version.

## Boundaries

Orb System owns source identity, logo preparation, recipes, and immutable
release generation. Post Composer may publish and consume the full Worker
catalog independently. iOS consumes only a curated local snapshot and requires
no backend, credentials, first-launch synchronization, or runtime logo download.

Do not overwrite an immutable release, edit generated iOS assets by hand, or
treat the Cloudflare Worker as the sole backup of source material.
