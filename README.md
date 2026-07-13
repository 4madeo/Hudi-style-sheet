# Hudi orbs

A Next.js reference app and reusable React orb module based on the ticker-orb system from
[4madeo/Hudi-style-sheet](https://github.com/4madeo/Hudi-style-sheet).

The generator, ticker gallery and blotter all render the same stateless `TickerOrb` component. Palette generation, market colour rules, contrast, light/dark material order and orb geometry live in `components/orb`; persistence and editing remain app concerns.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The repository uses the standard Next.js production and Vercel flow:

```bash
npm run build
npm start
```

## Front-end integration

Import from the public barrel. The component loads its scoped orb CSS and does not read local storage or mutate the document theme.

```tsx
import { TickerOrb } from "@/components/orb";

export function AssetIcon() {
  return (
    <TickerOrb
      ticker="NTDO"
      number="7974"
      colour="#ff00cc"
      size={48}
      theme="inherit"
    />
  );
}
```

`theme="inherit"` responds to a surrounding `data-theme="dark"`. An explicit `theme="light"` or `theme="dark"` lets the orb work inside any other theme system without changing global state.

For dataset-driven orbs, use a stable ticker or database ID as `stableKey`. This means adding or reordering rows does not recolour existing assets.

```tsx
import { TickerOrb, createMarketOrbDefinition } from "@/components/orb";

const rows = [
  { id: "JP:7974", ticker: "NTDO", exchangeTicker: "7974", market: "JP" as const },
  { id: "KR:005930", ticker: "SMSG", exchangeTicker: "005930", market: "KR" as const },
];

export function OrbList() {
  return rows.map((row) => {
    const orb = createMarketOrbDefinition({
      ticker: row.ticker,
      number: row.exchangeTicker.slice(-4),
      market: row.market,
      stableKey: row.id,
    });

    return <TickerOrb key={row.id} {...orb} size={32} />;
  });
}
```

Applications can override all four colour tokens when art direction requires it. A supplied `palette` takes precedence over `colour`.

```tsx
<TickerOrb
  ticker="NTDO"
  number="3325"
  palette={{
    colour: "#ff00cc",
    base: "#ff00cc",
    sheen: "#ff8bdd",
    shadow: "#d00082",
  }}
  theme="dark"
  glow
/>
```

See [the orb integration reference](components/orb/README.md) for the complete API, token surface, theme contract and font setup.
