# HUDI company-logo orbs

A Next.js reference app and reusable React module for HUDI’s company-logo orb system. Each company has a unique, brand-derived orb palette with a verified local logo optically positioned inside the orb’s safe zone. Ticker text, exchange numbers, and market-state colours are not part of the V2 orb identity.

The generator, 37-company MVP gallery, blotter, market header, SVG/PNG exporter, and local Figma plugin share the hand-curated reference data and orb geometry. A separate searchable catalog contains every row from the HUDI community listings staging export; the MVP files remain the quality reference and are never overwritten by the bulk importer.

## Full catalog export

Export the complete community catalog as standalone SVG and PNG files at the
generator, ticker-page, and blotter scales, then create and test a ZIP64
archive:

```bash
npm run export:catalog -- --release orb-catalog-2026-08-20
```

The exporter uses a bounded worker pool, writes every asset atomically, and
stores resumable output under `artifacts/orb-exports/`. Re-running the same
release resumes entries whose six files already exist. Use a new release name
after changing the source manifest or renderer; the exporter rejects a resume
when those fingerprints differ.

Tune the company-level concurrency or run a small export without packaging:

```bash
npm run export:catalog -- --release orb-sample --limit 100 --concurrency 4 --no-zip
```

Export the dark-mode ring treatment, or take a repeatable random sample before
running the complete release:

```bash
npm run export:catalog -- --release orb-dark-sample --theme dark --sample 30 --seed dark-review
```

The archive uses the system `zip` command's ZIP64 support because the full
catalog contains more than 65,535 files. It is integrity-tested with `unzip`
after creation. Missing company artwork is exported as the same deterministic
fallback identity used by the catalog UI, so every manifest row has all six
assets.

## Crypto catalog

Refresh the current CoinMarketCap ranks 1–100, exclude every entry carrying
CoinMarketCap's `stablecoin` tag, and download the exact base-currency SVG from
TradingView:

```bash
npm run import:crypto
```

The command writes a separate ranked manifest to
`public/logos/crypto/manifest.json`, preserves the raw TradingView SVGs under
`public/logos/crypto/source/`, and writes background-free vector marks beside
the manifest. The app exposes these as the `crypto` view without changing the
community-equity catalog. Use `-- --refresh-assets` to redownload already
cached TradingView SVGs.

## Logo assets

The curated Logo.dev responses are stored in `public/logos/` and recorded in
`public/logos/manifest.json`. The app and Figma plugin use these local files, so
normal development, builds, and exports do not require a Logo.dev key or a
network request.

Vector sources remain vector through the catalog pipeline. A fetched SVG is
stored locally with its real `.svg` extension, background/container cleanup and
emblem cropping produce an isolated square SVG, and the app renders that SVG
inside the orb. Raster sources continue to produce normalized 512px PNGs. A
vector source falls back to PNG only when cleanup requires a pixel mask that
cannot be represented safely as a vector crop; the manifest records that
fallback and its reason.

Orb colour is resolved independently from logo geometry. The manifest records
`orbColourSource` and the unadjusted `orbColourSeed`: an exact Simple Icons
brand-colour match takes priority, followed by a dominant chromatic colour from
the current isolated mark, a verified family colour, and finally the neutral
fallback. Reference-gallery colours are regenerated from the same sources
before development, production, and Figma builds; no legacy hand-assigned
colour tokens are used. `orbColourAdjustment` records the contrast correction
used when an original-colour mark needs separation from its orb.

Preview or atomically apply colour provenance to an existing local manifest
without downloading or reprocessing any artwork:

```bash
npm run enrich:orb-colours
npm run enrich:orb-colours -- --write
```

Materialize every automatically verifiable free-source match and keep the
entire catalog available offline with one command:

```bash
npm run materialize:open-logos
```

This sends the public exchange and ticker identifiers from the existing
manifest to Wikidata, downloads exact exchange+ticker P154 matches from
Wikimedia Commons, and records each file's licence and attribution metadata.
It also accepts a Simple Icons company-name match only when its rendered shape
independently agrees with the current local logo at a strict similarity
threshold. Wikimedia takes priority. The command does not contact TradingView
or Logo.dev, does not require a key, and has no manual decision step.

When neither reusable source resolves a listing, the existing local asset is
left untouched; a listing with no company asset uses the deterministic local
HUDI fallback. This makes builds and exports fully offline, but does not
relicense older retained vendor assets. The run writes an offline-completeness
summary to `artifacts/logo-materialization-summary.json` and reusable-source
provenance to `artifacts/logo-source-provenance.csv`.

Refresh all 37 assets with a Logo.dev publishable key:

```bash
LOGO_DEV_PUBLISHABLE_KEY=pk_your_publishable_key npm run download:logos
```

Import the complete community listings catalog:

```bash
LOGO_DEV_PUBLISHABLE_KEY=pk_your_publishable_key npm run import:catalog -- /absolute/path/to/community-listings-stocks-staging.csv
npm run finalize:catalog
```

The generated manifest is the canonical catalog after the initial import. Add
or update a maintained set of listings by overlaying a repository CSV onto the
current manifest, then finalize it:

```bash
npm run import:catalog -- --from-manifest data/catalog-priority-listings.csv
npm run finalize:catalog
```

An overlay replaces matching exchange-qualified rows and appends new rows, so
the full source export does not need to be kept outside this repository for
routine additions. Keep exchange symbols zero-padded and use `false` for
`publicly_on_hudi` unless the listing is actually live in HUDI.

The importer qualifies tickers for HKEX, KRX, NASDAQ, NYSE, SSE, SZSE, and TSE. Its normal source order is an exchange-qualified Logo.dev ticker, an exact TradingView exchange+ticker match, an exact Wikidata exchange+ticker match whose P154 image is hosted on Wikimedia Commons, and only then a Logo.dev company-name lookup. It requests `fallback=404`, so Logo.dev letter monograms never enter the orb system. Existing unresolved or suspect sources prefer the exact providers during revalidation. Pass `--skip-tradingview` or `--skip-wikimedia` to disable either exact fallback.

NYSE preferred-share symbols are also queried using TradingView's slash form
(for example, catalog `SPE-PC` maps to `NYSE:SPE/PC`).

Revalidate an existing catalog without the original CSV or a Logo.dev key:

```bash
npm run import:catalog -- --from-manifest --revalidate
npm run finalize:catalog
```

`--revalidate` detects opaque, photo-like Logo.dev responses and raster sources below the catalog's resolution floor. A raster must be at least 256px on its long edge and 64px on its short edge, pass an effective-resolution edge check, and avoid interpolation-heavy alpha where most visible pixels are soft transparency. The aspect-aware short edge keeps sharp wide wordmarks from being rejected while still blocking tiny or smeared sources. Suspect sources are replaced only when an exchange-qualified source is available; otherwise they are removed from the rendered catalog for review. `--refresh-tradingview` redownloads and renormalizes existing TradingView assets, and its compact SVGs are rendered at high density before the 512px output is written. The manifest records replacements with `validationStatus` and `replacedProvider` rather than silently changing provenance.

Run the same resolution-floor audit without changing the catalog:

```bash
npm run audit:logo-resolution
```

Cross-check every rendered catalog logo against TradingView's exact
exchange+ticker result:

```bash
npm run audit:logo-sources
```

This writes a complete JSON report and a smaller CSV review queue under
`artifacts/`. The visual score is deliberately advisory: alternate official
lockups, share-class marks, and temporary campaign artwork can all differ even
when both providers identify the same issuer. A live Logo.dev refresh still
requires `LOGO_DEV_PUBLISHABLE_KEY`; without it, the audit compares the local
Logo.dev snapshot already recorded in the catalog manifest.

After reviewing a specific disagreement, replace only the approved listing
with TradingView's exchange-qualified asset:

```bash
npm run import:catalog -- --from-manifest --reprocess --reprocess-ids=HKEX:0012 --prefer-tradingview --skip-wikimedia
npm run finalize:catalog
```

`--prefer-tradingview` requires an explicit ID list, so an audit cannot
accidentally replace the whole catalog.

For an explicitly approved full-catalog TradingView migration, use
`--prefer-tradingview-all`. This scans every exchange-qualified listing,
downloads matching SVG sources locally, and leaves reviewed/manual sources and
the MVP reference set in place.

User-approved image references live under `public/logos/manual-review/` and
are mapped to exchange-qualified listings in
`scripts/manual-logo-overrides.mjs`. The importer hashes these source files,
records them as `manual-review`, and reapplies an override only when the
approved file changes or the listing has not yet received it. This keeps a
later catalog refresh from silently restoring the rejected provider asset.

PNG crop decisions are keyed by source SHA-256 in
`data/png-logo-adjustments.json`, so one approved adjustment covers duplicate
tickers and share classes without changing the preserved source. Build the
next deduplicated before/current review batch with:

```bash
npm run review:png-logos -- --count=80 --offset=0
```

The command writes JSON, CSV, and a contact sheet to `artifacts/png-logo-review.*`.
Only reviewed decisions are applied by the importer; the report's crop
suggestions remain advisory. Raster normalization also removes one-to-three
pixel edge bands only when they span at least 94% of a source side; reviewed
gradient panels can retain a light lettermark through `lightPixelThreshold`.

The audit writes JSON and CSV reports beside the catalog manifest. Entries that remain below the floor after revalidation also appear in `source-review.csv`.

Yahoo Finance is not used as a logo source. Its current company-profile data does not provide a dependable logo field, and its unofficial endpoints are too aggressively rate-limited for a 20k-entry catalog. Existing MVP matches point to the curated files in `public/logos/`; all other source responses are preserved under `public/logos/catalog/source/` and their normalized 512px transparent assets are written by exchange under `public/logos/catalog/`.

Catalog imports retain complete wordmarks by default; emblem-only crops require an explicit curated/reference decision. Flat panels, app-style tiles, and rounded rectangular containers are removed when a distinct inset mark or wordmark remains. A useful removed panel colour becomes the orb colour when the isolated mark is neutral, while the mark’s original colours are preserved. Multicolour marks remain original so their internal shapes do not collapse into dots or blocks. Other orbs use the exact brand seed; a monochrome mark that falls below 3:1 contrast is inverted, with red and blue orbs always using white and genuinely light colours retaining black as a fallback. The manifest records container removal, colour provenance, colour mode, crop mode, logo treatment, provider, lookup method, source URL, aliases, and unresolved rows. The finalizer safely reuses a resolved logo for unresolved rows with the same normalized company name on the same exchange. Missing-logo cards and every row in `source-review.csv` include a one-click Google Images query with the company, exchange, and ticker for assisted source review. Google’s public Images HTML rate-limits automated catalog queries, so results are never accepted or downloaded automatically; use a licensed Google SERP API and human review before promoting a search result into the catalog.

Re-run normalization without downloading new sources, then render a stratified review of the container removals:

```bash
npm run import:catalog -- --from-manifest --skip-tradingview --skip-wikimedia --reprocess
npm run finalize:catalog
npm run audit:catalog -- public/logos/catalog/manifest.json --mode=containers-stratified --count=96
```

Use `--reprocess-ids=HKEX:0308,HKEX:0483` with `--reprocess` to limit regeneration to specific exchange-qualified IDs.

Stage ranked Google Images candidates for every unresolved company with SerpAPI:

```bash
read -s SERPAPI_API_KEY
export SERPAPI_API_KEY
npm run search:logo-candidates -- --limit=250
unset SERPAPI_API_KEY
```

The search script groups share classes by normalized company name, caches completed searches to avoid spending quota twice, and writes sanitized JSON/CSV reports under `artifacts/`. It never stores the API key or raw SerpAPI responses, and candidates remain review-only until their identity and usage rights are checked.

Build the thumbnail review sheets without spending more search quota, record explicit selections in `artifacts/serpapi-logo-decisions.json`, then import only those reviewed matches:

```bash
node scripts/build-logo-candidate-review.mjs
npm run import:catalog -- --from-manifest --skip-tradingview --skip-wikimedia --serpapi-decisions=artifacts/serpapi-logo-decisions.json
npm run finalize:catalog
npm run audit:catalog -- public/logos/catalog/manifest.json --mode=serpapi --count=100
```

The importer rechecks every selected listing against the current manifest, records both the image and result-page provenance, and ignores a stale selection when that listing has already been resolved. A decision can set `preserveFullMark` when the automatic emblem crop would remove meaningful parts of a reviewed wordmark, and `refresh` when an already imported selection needs to be reprocessed.

Repeated rendered marks are quarantined unless the company names establish a clear family or the listings belong to an explicitly verified family in `scripts/catalog-logo-families.mjs`. Quarantined rows retain their source metadata as `logoCandidate` for later revalidation but never render that candidate. This keeps bad provider collisions out while allowing legitimate shared group identities. Unresolved catalog rows render a deterministic HUDI company monogram in a stable colour and remain linked to assisted source review.

Render a visual QA sheet from any generated catalog manifest:

```bash
npm run audit:catalog -- public/logos/catalog/manifest.json --mode=stratified --count=140
npm run audit:logo-backgrounds
```

TradingView review modes render the raw local source, isolated asset, and final
orb side by side. They prioritize likely destructive crops, missed emblems,
background cleanup, and neutral colour fallbacks without downloading anything:

```bash
npm run audit:catalog -- public/logos/catalog/manifest.json --mode=tv-overcrops --count=200
npm run audit:catalog -- public/logos/catalog/manifest.json --mode=tv-missed-emblems --count=200
npm run audit:catalog -- public/logos/catalog/manifest.json --mode=tv-background-sample --count=100
npm run audit:catalog -- public/logos/catalog/manifest.json --mode=colour-fallbacks --count=200
```

The background-removal audit checks every asset marked as having an outer
container removed. It fails when the retained mark is empty, weak antialiasing,
or collapsed to a line, catching the outline-only failure mode before release.

The downloader requests SVG first, validates the response, and falls back to a
high-resolution PNG when SVG is unavailable. It keeps the response under
`public/logos/source/`, removes any opaque edge background, crops the mark, and
writes the transparent renderer-ready PNG beside the manifest. It never writes
the key to source. Only use a publishable `pk_…` key; never expose a Logo.dev
secret key. Keep the visible Logo.dev attribution required by the applicable
plan. Logo.dev documents SVG delivery and self-hosting as Enterprise features;
confirm the account license before shipping this local asset snapshot in a
production build.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Validation commands:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run build:figma
```

## Front-end integration

```tsx
import { LogoOrb, deriveOrbPalette } from "@/components/orb";

export function NvidiaOrb() {
  return (
    <LogoOrb
      company="Nvidia"
      logoUrl="/logos/nvda.png"
      logoTreatment="light"
      logoScale={0.58}
      logoOffsetY={0.02}
      palette={deriveOrbPalette("#76B900")}
      size={48}
    />
  );
}
```

See [the orb integration reference](components/orb/README.md) for the component contract and sizing rules. The legacy `TickerOrb` export remains temporarily available to downstream code, but this app no longer uses it.

## Figma plugin

Build the local plugin. The build embeds the curated logo assets into its UI,
so it works without Logo.dev network access:

```bash
npm run build:figma
```

Then import `figma-plugin/manifest.json` as a development plugin in Figma.
