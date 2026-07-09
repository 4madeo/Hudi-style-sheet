# Suggested API Contract

These endpoint contracts are suggested for the trading app implementation. The current prototype is frontend-only, so these are integration targets rather than active server routes.

## Trade Sharecard Payload

```ts
type SharecardTradeInput = {
  tradeId: string;
  userId: string;
  hudiHandle: string;
  token: string;
  marketName?: string;
  side: "long" | "short";
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  pnlPercent: number;
  pnlUsd?: number;
  openedAt?: string;
  closedAt?: string;
  note?: string;
};
```

## Recommended Endpoints

### Create a sharecard

```http
POST /api/sharecards
Content-Type: application/json
```

Request:

```json
{
  "tradeId": "trade_123",
  "userId": "user_456",
  "hudiHandle": "@hudi",
  "token": "HITK",
  "side": "long",
  "leverage": 20,
  "entryPrice": 48750,
  "exitPrice": 48472.13,
  "pnlPercent": -11.4,
  "note": "Loss logged. Next trade gets cleaner."
}
```

Response:

```json
{
  "sharecardId": "sharecard_789",
  "renderMode": "interactive-3d-svg",
  "pngUrl": "/api/sharecards/sharecard_789.png",
  "svgUrl": "/api/sharecards/sharecard_789.svg",
  "chatPayloadUrl": "/api/sharecards/sharecard_789/chat-payload"
}
```

### Get an interactive chat payload

```http
GET /api/sharecards/:sharecardId/chat-payload
```

Response should match the output of:

```js
await window.hudiSharecard.getChatSharePayload({ portable: true });
```

### Get PNG

```http
GET /api/sharecards/:sharecardId.png
```

Expected output:

- PNG
- 3x raster size by default (`3600 x 2400` for a `1200 x 800` card)
- Fonts embedded or server-side loaded from `assets/fonts/`

### Get SVG

```http
GET /api/sharecards/:sharecardId.svg
```

Expected output:

- SVG
- Embedded `@font-face` rules
- Data-URL Hudi assets for portability

## Frontend Mapping

Backend field to current frontend field:

```text
token        -> form token
hudiHandle   -> form hudi
pnlPercent   -> form pnlOverride
side         -> form side
leverage     -> form leverage
entryPrice   -> form entry
exitPrice    -> form exit
note         -> form note
```

Current prototype simulates entry/exit from PNL, side, leverage, and token. When backend prices are connected, update `setTradeData()` and the `syncSimulatedPrices()` flow so real prices override simulation.

## Scenario Selection

Recommended backend scenario mapping:

```text
pnl >= 100%      -> huge-profit
pnl >= 25%       -> big-profit
pnl > 0%         -> slight-profit
pnl <= -50%      -> huge-loss
pnl <= -10%      -> big-loss
pnl < 0%         -> slight-loss
```

These thresholds are design defaults and can be tuned later.

## Chat Rendering

For Hudi chat, do not flatten to PNG if the client supports rich cards.

Preferred:

```js
const payload = await fetch("/api/sharecards/sharecard_789/chat-payload").then((res) => res.json());
window.hudiSharecard.renderChatSharecard(messageNode, payload);
```

Fallback:

```html
<img src="/api/sharecards/sharecard_789.png" alt="Hudi trade sharecard" />
```
