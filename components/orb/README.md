# Logo orb module

`LogoOrb` is a stateless company-logo renderer. It owns orb geometry, material effects, the central mark safe zone, and logo contrast treatment. Logo fetching, caching, company metadata, editing, and persistence belong to the host application.

## Public API

Import public values from `components/orb/index.ts`:

| Export | Purpose |
| --- | --- |
| `LogoOrb` | React company-logo orb renderer |
| `createLogoDevUrl(domain, options)` | Creates a Logo.dev URL from a verified company domain |
| `deriveOrbPalette(colour)` | Expands one brand colour into the orb material palette |
| `createLogoOrbSvg(...)` | Creates an SVG export with a geometrically centred or optically corrected logo image |

`LogoOrb` accepts `company`, optional `logoUrl`, optional `fallbackKey`, `colour` or `palette`, `logoTreatment`, `logoScale`, `logoOffsetY`, `size`, `compact`, `theme`, `glow`, `className`, `style`, `ariaLabel`, and `decorative`.

When `logoUrl` is absent or fails to load, the orb renders a compact company monogram. It uses the first letters of up to two meaningful company-name words, ignores common legal suffixes, and falls back to the first two graphemes of a single-word or non-Latin name. The mark remains a clearly system-generated HUDI default rather than a fabricated company logo.

`logoTreatment` is `original`, `light`, `dark`, `lift`, `deepen`, or `knockout`. Use `original` for marks whose internal brand colours must survive, `light` or `dark` for one-colour inversions, `lift` or `deepen` to preserve a tonal mark while increasing its contrast, and `knockout` to turn brand-colour geometry white while making the source's white areas transparent.

Two-tone vectors containing both a brand colour and white detail use `knockout`; their orb uses the extracted brand colour and shows the source geometry as a white-on-brand cutout.

The catalog retains the extracted brand colour as its source seed. The rendered palette adds a small saturation and lightness lift and reduces shadow density so orb colours remain vivid without changing their brand hue.

Black logo inversion is reserved for bright orb colours with strong measured contrast. Mid-tone and dark orbs prefer white, while tonal and multicolour marks are tinted toward white or deepened without discarding their internal colour structure.

`logoScale` is the mark’s diameter as a proportion of the orb. The component clamps it to the 0.36–0.72 range; the curated listing set normally stays around 0.54–0.62. This keeps every mark inside the central safe zone and clear of the highlight and rim.

`logoOffsetY` is an optional optical correction expressed as a proportion of the orb diameter and clamped to −0.12–0.12. Positive values move a visually top-heavy mark down; negative values move it up. Keep it at the default `0` unless the logo’s visual weight makes geometric centring look wrong. The same value is honored by the React renderer and standalone SVG exports.

```tsx
<LogoOrb
  company="Microsoft"
  logoUrl="/logos/msft.png"
  logoTreatment="original"
  logoScale={0.54}
  logoOffsetY={0.02}
  palette={deriveOrbPalette("#0078D4")}
  size={136}
/>
```

## Logo.dev contract

`createLogoDevUrl` defaults to `format=svg`, `size=512`, and `fallback=404`. Pass only a publishable API key. A 404 fallback is intentional: it keeps third-party generated monograms out of the catalog so the renderer can apply HUDI’s consistent company-monogram treatment itself.

The Orb System reference app uses the validated local snapshot in
`public/logos/`; `createLogoDevUrl` remains available for consumers that choose
runtime delivery or for previewing a custom domain in the editor.

Orb assets should use the most recognizable standalone brand mark available in
the supplied artwork. When a full lockup contains both a mark and a wordmark,
prefer the mark; retain the full lockup only when it is itself the clearest
small-size identifier. The local asset manifest may include a normalized `crop`
rectangle for this art direction. The processing script uses that region to
produce an orb-specific asset while preserving the complete downloaded artwork
in `public/logos/source/`.

After cropping, normalize by the rendered foreground rather than by the source
canvas. Standalone marks should occupy approximately 52% of the orb diameter.
Wide or stacked lockups may extend to roughly 56–60% when needed for legibility,
provided they remain clear of the highlight and rim.

For compressed raster sources, an asset-specific `backgroundTolerance` may be
used to remove matte noise without changing the preserved source artwork.

Use a verified domain whenever possible. Company-name and ticker lookups are useful fallbacks, but a domain is more deterministic for global listings and similarly named brands.

## Compatibility

`TickerOrb` and the legacy ticker palette helpers remain exported for a short migration window. New product surfaces should use `LogoOrb`; the V2 system does not display ticker text, exchange numbers, or market-state colours inside the orb.
