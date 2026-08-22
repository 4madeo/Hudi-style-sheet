const coinMarketCapListingUrl = "https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=1&limit=100&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all&audited=false";
const userAgent = "HUDIOrbCatalog/0.1 (ranked crypto logo resolver)";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { Accept: "application/json", "User-Agent": userAgent, ...options.headers },
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
  throw lastError ?? new Error("JSON request failed");
}

export function isCoinMarketCapStablecoin(coin) {
  return Array.isArray(coin.tags) && coin.tags.includes("stablecoin");
}

export function parseCoinMarketCapTop100(payload) {
  const rows = payload?.data?.cryptoCurrencyList;
  if (!Array.isArray(rows) || rows.length !== 100) {
    throw new Error(`CoinMarketCap returned ${Array.isArray(rows) ? rows.length : 0} listings; expected exactly 100.`);
  }
  const ranked = rows.map((coin) => ({
    cmcId: Number(coin.id),
    cmcRank: Number(coin.cmcRank),
    name: String(coin.name ?? "").trim(),
    slug: String(coin.slug ?? "").trim(),
    symbol: String(coin.symbol ?? "").trim(),
    tags: Array.isArray(coin.tags) ? coin.tags.map(String) : [],
  }));
  if (ranked.some((coin) => !coin.cmcId || !coin.cmcRank || !coin.name || !coin.symbol)) {
    throw new Error("CoinMarketCap returned an incomplete ranked listing.");
  }
  return ranked;
}

export async function fetchCoinMarketCapTop100() {
  const payload = await fetchJson(coinMarketCapListingUrl);
  return {
    fetchedAt: payload?.status?.timestamp ?? new Date().toISOString(),
    sourceUrl: "https://coinmarketcap.com/",
    ranked: parseCoinMarketCapTop100(payload),
  };
}

function normalizedName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\b(prev(?:iously)?|new)\b/g, "")
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, "")
    .trim();
}

function candidateScore(coin, candidate) {
  const expected = normalizedName(coin.name);
  const actual = normalizedName(candidate.name);
  if (expected === actual) return 100;
  if (expected && actual && (expected.includes(actual) || actual.includes(expected))) return 70;
  if (normalizedName(coin.slug) === actual) return 60;
  return 10;
}

function selectTradingViewCandidate(coin, candidates) {
  const matching = candidates
    .filter((candidate) => candidate.symbol.toLocaleUpperCase() === coin.symbol.toLocaleUpperCase() && candidate.logoid)
    .sort((left, right) => candidateScore(coin, right) - candidateScore(coin, left));
  if (!matching.length) return undefined;
  const logoids = new Set(matching.map((candidate) => candidate.logoid));
  if (logoids.size > 1 && candidateScore(coin, matching[0]) < 60) return undefined;
  return matching[0];
}

async function fetchTradingViewBatch(coins) {
  const symbols = coins.map((coin) => coin.symbol.toLocaleUpperCase());
  const payload = await fetchJson("https://scanner.tradingview.com/crypto/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: [{ left: "base_currency", operation: "in_range", right: symbols }],
      options: { lang: "en" },
      markets: ["crypto"],
      symbols: { query: { types: [] }, tickers: [] },
      columns: ["name", "description", "base_currency", "base_currency_desc", "base_currency_logoid", "market_cap_calc"],
      sort: { sortBy: "market_cap_calc", sortOrder: "desc" },
      range: [0, 10_000],
    }),
  });
  return (payload.data ?? []).map((item) => ({
    query: item.s,
    pairName: item.d?.[0],
    description: item.d?.[1],
    symbol: item.d?.[2],
    name: item.d?.[3],
    logoid: item.d?.[4],
    marketCap: item.d?.[5],
  }));
}

export async function findTradingViewCryptoLogos(coins, options = {}) {
  const batchSize = Math.max(4, Math.min(20, options.batchSize ?? 12));
  const results = new Map();
  for (let offset = 0; offset < coins.length; offset += batchSize) {
    const batch = coins.slice(offset, offset + batchSize);
    const candidates = await fetchTradingViewBatch(batch);
    for (const coin of batch) {
      const candidate = selectTradingViewCandidate(coin, candidates);
      if (!candidate) continue;
      results.set(coin.cmcId, {
        ...candidate,
        downloadUrl: `https://s3-symbol-logo.tradingview.com/${candidate.logoid}--big.svg`,
        sourceUrl: `https://www.tradingview.com/symbols/${candidate.query.replace(":", "-")}/`,
      });
    }
    options.onBatch?.({ completed: Math.min(offset + batch.length, coins.length), matches: results.size, total: coins.length });
  }
  return results;
}

export async function downloadTradingViewCryptoLogo(candidate) {
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
      if (bytes.length < 64 || !/<svg\b/i.test(bytes.subarray(0, 4096).toString("utf8"))) {
        throw new Error("TradingView did not return an SVG logo");
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay([500, 1_500, 4_000, 8_000][attempt]);
    }
  }
  throw lastError ?? new Error("TradingView logo request failed");
}
