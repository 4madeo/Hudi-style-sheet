# Hudi Sharecard Integration Guide

This document explains where the trading app should connect real trade data, share/export endpoints, and in-app chat rendering.

## Architecture

Current prototype:

```text
Trading data input
  -> app.js readState()
  -> PNL and graph logic
  -> buildCardSvg()
  -> Live SVG preview
  -> PNG/SVG/chat payload export
```

Production target:

```text
Trading backend
  -> sharecard API endpoint
  -> normalized trade payload
  -> Hudi sharecard renderer
  -> PNG for socials
  -> interactive 3D payload for Hudi chat
```

## Existing Frontend Hooks

The browser exposes:

```js
window.hudiSharecard
```

### Inject a trade

```js
window.hudiSharecard.setTradeData({
  token: "HITK",
  hudi: "@hudi",
  pnl: -11.4,
  side: "long",
  leverage: 20,
  note: "Loss logged. Next trade gets cleaner."
});
```

Current note: entry and exit are simulated from `token`, `pnl`, `side`, and `leverage` until real trade data is wired. The simulation lives in `app.js`:

- `simulateTradePrices()`
- `syncSimulatedPrices()`
- `readState()`

When real backend prices are ready, connect `entry` and `exit` in this area or replace the simulation with backend-provided trade prices.

### Read current state

```js
const state = window.hudiSharecard.getTradeState();
const graph = window.hudiSharecard.getGraphState();
```

### Create an interactive chat card payload

```js
const payload = await window.hudiSharecard.getChatSharePayload();
```

Use this for Hudi in-app chat. It returns:

- `type`: `"hudi-sharecard"`
- `version`
- `renderMode`: `"interactive-3d-svg"`
- `shareText`
- `state`
- `graphState`
- `svg`
- `interaction`

### Render an interactive card in chat

```js
window.hudiSharecard.renderChatSharecard(chatMessageElement, payload);
```

This renders the SVG and re-attaches the 3D hover/touch behavior. This is the preferred in-app chat path because it keeps the holographic card interactive instead of flattening it to a PNG.

## Export Paths

### Social PNG

Use the existing PNG pipeline for socials:

```text
cardBlob("image/png")
```

It embeds fonts and renders at `3x` resolution. A `1200 x 800` card exports as `3600 x 2400`.

### SVG

Use:

```text
buildExportSvg(state)
```

It embeds the local fonts into the SVG. This prevents font fallback when a saved/exported card is opened somewhere else.

## Where Backend Endpoints Should Connect

Recommended flow for production:

1. Trading app calls backend after a trade closes.
2. Backend normalizes trade into the API contract from `API_CONTRACT.md`.
3. Frontend receives the normalized payload and calls `setTradeData()`.
4. User previews the card.
5. For social sharing, frontend calls the PNG endpoint or local PNG export.
6. For Hudi chat, frontend sends the interactive payload returned by `getChatSharePayload()`.

## Files To Touch For Backend Wiring

- `app.js`
  - `setTradeData()`: ingest backend trade payload.
  - `readState()`: normalize form/API state.
  - `simulateTradePrices()` / `syncSimulatedPrices()`: replace or bypass when real entry/exit arrives.
  - `getSharecardChartState()`: graph route is derived from PNL, side, leverage, entry, and exit.
  - `cardBlob()` / `buildExportSvg()`: export pipeline.
  - `getChatSharePayload()` / `renderChatSharecard()`: in-app chat integration.

- `index.html`
  - Export/share controls.
  - Hidden customizer controls still exist for internal tuning.

- `styles.css`
  - 3D hover behavior.
  - Holographic layers.

## Implementation Notes

- Character/orb/text layers should not receive the holographic effect.
- Background and graph are treated as the holographic card layer.
- PNG export should remain flat/high-res for external social platforms.
- Hudi in-app chat can support the interactive 3D version because it controls the renderer.
- If the backend renders PNG server-side later, it must load the same fonts from `assets/fonts/`.
- The demo intentionally does not persist builder changes across reloads. Add persistence in the trading app layer later, once real trade/sharecard records exist.
