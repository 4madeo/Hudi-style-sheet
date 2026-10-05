# HUDI orb asset handoff

This package contains the exported HUDI company-orb library. Each orb combines a company mark (or a HUDI fallback monogram) with its approved colour, lighting, rim, and logo treatment. The visual treatment is already baked into every file; recipients should use the assets as supplied rather than rebuilding the orb from its individual parts.

## How the package is organised

Assets are grouped first by exchange and then by ticker. This keeps companies with the same ticker on different exchanges separate.

```text
<release-name>/
├── export-manifest.json
├── hkex/
│   └── <TICKER>/
│       ├── generator.svg
│       ├── generator.png
│       ├── ticker-page.svg
│       ├── ticker-page.png
│       ├── blotter.svg
│       └── blotter.png
├── krx/
├── nasdaq/
├── nyse/
├── sse/
├── szse/
└── tse/
```

An asset can therefore be identified by `exchange/ticker`. For example, the standard NVIDIA SVG is `nasdaq/NVDA/ticker-page.svg`.

## Sizes and formats

| File name | Intrinsic size | Intended use |
| --- | ---: | --- |
| `generator` | 460 × 460 px | Large-format artwork, presentation layouts, and high-resolution source use |
| `ticker-page` | 136 × 136 px | Standard product and market-page presentation |
| `blotter` | 24 × 24 px | Dense tables, lists, and compact trading UI |

Every size is supplied as both SVG and PNG. Use SVG in product UI, Figma, and other vector-capable workflows. It is self-contained and has no external logo or font dependency. Use PNG where a fixed-size raster asset is required. PNGs are exported at the exact dimensions shown above.

Use the asset closest to the final display size. In particular, use the purpose-built `blotter` asset at 24 px rather than shrinking the large orb: its rim has been tuned for legibility at that size. Preserve the square aspect ratio and transparent area around the circular orb.

## Theme and appearance

The package is exported in one theme, recorded as `light` or `dark` in `export-manifest.json`. The theme changes the order and contrast of the material rings; it does not change the company identity. Use assets from a package whose theme matches the surface where they will appear.

Logo colour treatment, logo scale, optical position, orb colour, highlights, shadows, and rings are final. Do not recolour the logo or orb, crop into the circle, add a second border, remove the highlight, or place the artwork inside another circular mask.

## Fallback orbs

When a verified company mark was unavailable, the export uses a deterministic HUDI monogram so every catalog entry still has a complete asset set. A fallback is a system placeholder, not an official company logo. The corresponding entry in `export-manifest.json` has `"fallback": true`; replace or review these before any use where official brand identification is required.

## Export manifest

`export-manifest.json` is the package index and source of truth. It records the release name, theme, catalog and renderer fingerprints, export sizes, company count, fallback count, and every company’s exchange, ticker, display name, logo status, and relative asset paths. Integrations should key assets by the manifest `id` or by `exchange + symbol`, never by array position.

The export is complete only when the manifest has `"status": "assets-complete"`. Its `assetCount` should equal the number of entries multiplied by three sizes and two formats.

## Implementation example

```html
<img
  src="/orbs/nasdaq/NVDA/ticker-page.svg"
  width="136"
  height="136"
  alt="NVIDIA"
/>
```

If the surrounding interface already names the company, treat the orb as decorative with an empty `alt`. Otherwise, use the company display name from the manifest rather than exposing the ticker or filename as the accessible label.

## What is not included

The package does not contain live market data, trading state, source component code, or editable layers for the orb material. The orb colour represents company identity, not price movement or position direction. Company names, logos, and trademarks remain the property of their respective owners; this handoff does not grant usage rights beyond the approved HUDI context.

## Recipient check

Before integration, confirm that the manifest reports `assets-complete`, the package theme matches the target surface, the chosen file size matches its display context, and any entries marked as fallbacks have been accepted for that use.

## Post Composer catalog handoff

The Figma Post Composer uses a separate recipe handoff rather than these baked,
fixed-size orb exports. Generate it from the finalized company and crypto
catalogs with:

```sh
npm run export:post-composer -- --release <immutable-release-name>
```

By default the exporter merges resolved entries from
`public/logos/catalog/manifest.json` and
`public/logos/crypto/manifest.json` into one collection. Use `--no-crypto` only
for an intentionally company-only release. The output in
`artifacts/post-composer-catalog/<release>/` contains a format-v2 manifest and
up to 256 content-addressed JSON shards. Every entry carries the adjusted SVG or PNG logo
source by hash, exact byte length, logo treatment, scale, optical X/Y offsets,
four-colour material, searchable identity keys, source-manifest hashes, and
renderer fingerprint. Post Composer can therefore build an editable orb at
any supported diameter instead of scaling a baked 24, 136, or 460px orb.

Publish this handoff with the guarded Cloudflare KV publisher. Its default mode
only reads the remote namespace and prints the write plan:

```sh
npm run publish:post-composer -- \
  --release <immutable-release-name> \
  --namespace-id <kv-namespace-id>
```

Before applying, read the namespace's current remaining daily writes from the
Cloudflare dashboard. Supply that live number explicitly; add `--activate` only
when this release should become current:

```sh
npm run publish:post-composer -- \
  --release <immutable-release-name> \
  --namespace-id <kv-namespace-id> \
  --apply \
  --activate \
  --remaining-writes <current-remaining-writes>
```

The publisher checks the immutable manifest and skips a complete matching
release. Shards are stored globally under their canonical content hash and are
reused by every later release. A material-only edit therefore writes only the
new manifest and channel pointer; a new logo normally adds one changed shard.
Missing shards are uploaded in bounded Wrangler bulk batches, followed by the
manifest. It refuses to overwrite a mismatched immutable manifest, caps a run
at 300 writes, keeps a local UTC-day journal capped at 900 writes and three
distinct releases, and requires the live remaining-quota allowance for any
applying run. `channels/current.json` is written only after every expected key
is present and the manifest has been re-read and verified, then the channel is
also re-read to confirm activation. The journal lives in the ignored
`artifacts/post-composer-catalog/` directory; the live quota allowance remains
required because the journal cannot see writes from another machine or tool.

Do not use an unguarded `orbs:sync`, bulk upload, or manual per-key retry for
these releases. A retry should go through the publisher above: if the release
and channel already match, its plan contains zero writes.

The 900-write journal is intentionally below the Cloudflare Workers Free KV
limit of 1,000 writes per UTC day. It is a local guard, not an additional
Cloudflare quota.
