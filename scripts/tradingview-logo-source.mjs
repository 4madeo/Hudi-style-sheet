const scannerMarkets = {
  HKEX: "hongkong",
  KRX: "korea",
  NASDAQ: "america",
  NYSE: "america",
  SSE: "china",
  SZSE: "china",
  TSE: "japan",
};

const userAgent = "HUDIOrbCatalog/0.1 (exchange-qualified logo resolver)";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function tradingViewSymbol(row) {
  const symbol = row.exchange === "HKEX"
    ? row.symbol.replace(/^0+(?=\d)/, "")
    : row.symbol;
  return `${row.exchange}:${symbol}`;
}

function tradingViewSymbols(row) {
  const primary = tradingViewSymbol(row);
  if (row.exchange !== "NYSE") return [primary];
  const symbols = [primary, `AMEX:${row.symbol}`];
  const preferredShare = /^(.*)-P([A-Z])$/.exec(row.symbol);
  if (preferredShare) {
    const tradingViewPreferred = `${preferredShare[1]}/P${preferredShare[2]}`;
    symbols.push(`NYSE:${tradingViewPreferred}`, `AMEX:${tradingViewPreferred}`);
  }
  return symbols;
}

async function fetchBatch(market, rows) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`https://scanner.tradingview.com/${market}/scan`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": userAgent,
        },
        body: JSON.stringify({
          symbols: {
            tickers: rows.flatMap(tradingViewSymbols),
            query: { types: [] },
          },
          columns: ["name", "description", "logoid", "website"],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay([750, 2_000, 5_000, 10_000][attempt]);
    }
  }
  throw lastError ?? new Error("TradingView scanner request failed");
}

export async function findTradingViewLogoCandidates(rows, options = {}) {
  const batchSize = Math.max(20, Math.min(500, options.batchSize ?? 300));
  const candidates = new Map();
  const requested = new Map(rows.flatMap((row) => tradingViewSymbols(row).map((symbol) => [symbol, row])));
  const grouped = Object.groupBy(rows, (row) => scannerMarkets[row.exchange]);
  let completed = 0;

  for (const [market, marketRows] of Object.entries(grouped)) {
    if (!market || market === "undefined") continue;
    for (let offset = 0; offset < marketRows.length; offset += batchSize) {
      const batch = marketRows.slice(offset, offset + batchSize);
      const result = await fetchBatch(market, batch);
      for (const item of result.data ?? []) {
        const row = requested.get(item.s);
        const [symbol, company, logoid, website] = item.d ?? [];
        if (!row || !logoid) continue;
        const id = `${row.exchange}:${row.symbol}`;
        candidates.set(id, {
          company,
          downloadUrl: `https://s3-symbol-logo.tradingview.com/${encodeURIComponent(logoid)}--big.svg`,
          logoid,
          query: item.s,
          sourceUrl: `https://www.tradingview.com/symbols/${item.s.replace(":", "-")}/`,
          symbol,
          website: website || null,
        });
      }
      completed += batch.length;
      options.onBatch?.({ candidates: candidates.size, completed, total: rows.length });
    }
  }

  return candidates;
}

export async function downloadTradingViewLogo(candidate) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(candidate.downloadUrl, {
        headers: { Accept: "image/svg+xml,image/*", "User-Agent": userAgent },
        signal: AbortSignal.timeout(25_000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (bytes.length < 64 || !response.headers.get("content-type")?.startsWith("image/")) {
        throw new Error(`expected image, received ${response.headers.get("content-type") ?? "unknown"}`);
      }
      return {
        bytes,
        provider: "tradingview",
        lookup: "exchange-ticker",
        query: candidate.query,
        sourceFormat: "svg",
        sourceUrl: candidate.sourceUrl,
        tradingViewLogoid: candidate.logoid,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay([500, 1_500, 4_000, 8_000][attempt]);
    }
  }
  throw lastError ?? new Error("TradingView logo request failed");
}
