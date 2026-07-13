# Orb integration reference

The module is intentionally stateless. It accepts ticker data and visual tokens, then renders one orb. Fetching, caching, editing, modal state and persistence belong to the host front end.

## Public surface

Everything intended for consumers is exported from `components/orb/index.ts`:

| Export | Purpose |
| --- | --- |
| `TickerOrb` | React orb renderer |
| `deriveOrbPalette(colour)` | Derives base, sheen and shadow from `#RGB` or `#RRGGBB` |
| `createOrbDefinition(input)` | Normalises plain ticker data into component-ready data |
| `createMarketOrbDefinition(input)` | Generates a stable market-aware palette for a dataset row |
| `colourForMarket(market, stableKey)` | Selects a deterministic market seed |
| `ORB_TOKENS` | Palette, contrast and ink rules |
| `ORB_MARKET_COLOURS` | Warm HK, cool KR and yellow/gold JP colour spaces |
| `ORB_CSS_VARIABLES` | Supported CSS custom-property names |

`TickerOrb` accepts `ticker`, `number`, `colour`, `palette`, `size`, `compact`, `theme`, `glow`, `className`, `style`, `ariaLabel` and `decorative`. `number` can be a string or number; a string is recommended when leading zeroes matter.

## Theme contract

The default `theme="inherit"` looks for `data-theme="dark"` on any ancestor. Dark mode reverses the two equal-width material rings and enables the colour-matched glow. Light mode keeps the dark ring outside and the bright ring inside.

```tsx
<div data-theme={mode}>
  <TickerOrb ticker="BABA" number="9988" colour="#ff2a00" size={40} />
</div>
```

Use an explicit prop if the application uses class-based themes or renders an orb opposite to the surrounding mode:

```tsx
<TickerOrb ticker="BABA" number="9988" colour="#ff2a00" theme="dark" />
```

Set `glow={false}` to retain the dark material ordering without an outer glow.

## CSS tokens

The component has namespaced defaults and can be tuned per instance or at a wrapper level:

| Custom property | Default role |
| --- | --- |
| `--hudi-orb-size` | Diameter |
| `--hudi-orb-base` | Main material colour |
| `--hudi-orb-sheen` | Top gradient and inner light |
| `--hudi-orb-shadow` | Body and dark-ring shadow |
| `--hudi-orb-dark-ring` | Optional explicit dark-ring colour |
| `--hudi-orb-light-ring` | Optional explicit bright-ring colour |
| `--hudi-orb-ring-width` | Visible outer-ring thickness |
| `--hudi-orb-ring-depth` | Cumulative depth of both equal rings; normally twice the width |
| `--hudi-orb-glow-strength` | Dark-mode glow colour percentage |
| `--hudi-orb-glow-radius` | Dark-mode blur radius |
| `--hudi-orb-display-font` | Ticker font stack |
| `--hudi-orb-readout-font` | Curved number font stack |

```tsx
<TickerOrb
  ticker="SMSG"
  number="5930"
  colour="#00f0ff"
  size={24}
  style={{
    "--hudi-orb-ring-width": "0.875px",
    "--hudi-orb-ring-depth": "1.75px",
  }}
/>
```

The implementation uses `color-mix()`, SVG filters and CSS custom properties, so consumers should target modern evergreen browsers.

## Fonts

The renderer does not bundle proprietary display fonts. The host should load properly licensed font files and point the two font variables at them. The fallbacks remain functional when those fonts are unavailable.

```css
.asset-orbs {
  --hudi-orb-display-font: "Your Licensed Expanded Face", "Arial Black", sans-serif;
  --hudi-orb-readout-font: "Your Licensed OCR Face", ui-monospace, monospace;
}
```

## Adding dataset rows

Always choose colour from a stable key, never a current array index. An explicit `colour` or `palette` can still override the generated market colour.

```ts
const orb = createMarketOrbDefinition({
  ticker: row.displayTicker,
  number: row.exchangeTicker.slice(-4),
  market: row.market,
  stableKey: row.id ?? `${row.market}:${row.exchangeTicker}`,
  colour: row.orbColour,
});
```

The default market token map supports `HK`, `KR` and `JP`. A host can supply additional market colour spaces without changing the renderer:

```ts
const orb = createMarketOrbDefinition({
  ticker: row.ticker,
  number: row.number,
  market: row.market,
  stableKey: row.id,
  marketPalettes: {
    HK: ["#ff003d", "#ff5a00"],
    KR: ["#00f0ff", "#00ffb2"],
    US: ["#0057ff", "#ff00aa"],
  },
});
```
