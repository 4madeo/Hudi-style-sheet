# Hudi Card Builder

Prototype web tool for generating animated Hudi PNL sharecards.

The current build is a static HTML/CSS/JS prototype. It renders Hudi trade cards, simulated candle charts, 3D holographic hover states, high-resolution PNG export, SVG export, and an in-app chat payload hook for interactive cards.

## Run Locally

```bash
npm run start
```

Then open:

```text
http://127.0.0.1:4176/
```

Validation:

```bash
npm run check
```

## Current Features

- Result templates for slight profit, big profit, huge profit, slight loss, big loss, and huge loss.
- Default format: `1200 x 800 with orb`.
- Holographic card treatments by trade size.
- PNL-driven candle chart generation using side, PNL, leverage, entry, and exit.
- Export-safe embedded fonts for PNG/SVG output.
- `3x` PNG export for social sharing.
- In-app chat payload API for future interactive 3D sharecards.
- Customizer UI is hidden because the current card comps are locked.
- Demo controls are intentionally non-persistent: reloads reset the builder to the default `1200 x 800 with orb` sharecard.

## Key Files

- `index.html`: UI shell and share/export controls.
- `styles.css`: Hudi visual language, 3D hover, holographic treatment, responsive layout.
- `app.js`: trade state, graph generation, SVG rendering, export, and chat payload APIs.
- `assets/`: fonts, Hudi character art, and vendored Lottie runtime.
- `docs/INTEGRATION.md`: where backend and chat endpoints should connect.
- `docs/API_CONTRACT.md`: suggested endpoint contracts for the trading app.

## Integration Summary

The frontend integration surface is exposed on:

```js
window.hudiSharecard
```

Important methods:

- `setTradeData(data)`: inject trade data into the current card.
- `getTradeState()`: read the current normalized card state.
- `getGraphState()`: read the generated chart state.
- `getChatSharePayload(options)`: create a serializable interactive-card payload.
- `renderChatSharecard(container, payload)`: render a chat payload as a 3D interactive card.

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for the full connection plan.
