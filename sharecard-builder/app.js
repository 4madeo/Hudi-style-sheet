const sizePresets = {
  chat: { label: "1200 x 800", width: 1200, height: 800, variant: "classic" },
  "chat-orb": { label: "1200 x 800 with orb", width: 1200, height: 800, variant: "orb" }
};

const hudiMarkets = [
  { name: "Hang Seng", ticker: "HANG", code: "HK", exchange: "HKEX", currency: "HK$", price: 18674.32 },
  { name: "KOSPI", ticker: "KOSP", code: "KR", exchange: "KRX", currency: "₩", price: 2758 },
  { name: "Nikkei 225", ticker: "NIKK", code: "JP", exchange: "TSE", currency: "¥", price: 38467 },
  { name: "Tencent", ticker: "TENC", code: "0700", exchange: "HKEX", currency: "HK$", price: 381.4 },
  { name: "Alibaba", ticker: "BABA", code: "9988", exchange: "HKEX", currency: "HK$", price: 76.85 },
  { name: "Meituan", ticker: "MEIT", code: "3690", exchange: "HKEX", currency: "HK$", price: 120.6 },
  { name: "BYD", ticker: "BYDD", code: "1211", exchange: "HKEX", currency: "HK$", price: 219.8 },
  { name: "Samsung Elec", ticker: "SAMS", code: "005930", exchange: "KRX", currency: "₩", price: 78400 },
  { name: "SK Hynix", ticker: "HYNX", code: "000660", exchange: "KRX", currency: "₩", price: 203500 },
  { name: "DB HiTek", ticker: "HITK", code: "000990", exchange: "KRX", currency: "₩", price: 48750 },
  { name: "Hanmi Semi", ticker: "HNMI", code: "042700", exchange: "KRX", currency: "₩", price: 138900 },
  { name: "Leeno Industrial", ticker: "LENO", code: "058470", exchange: "KOSDAQ", currency: "₩", price: 212300 },
  { name: "ISC", ticker: "ISCX", code: "095340", exchange: "KOSDAQ", currency: "₩", price: 70400 },
  { name: "Hanwha Aerospace", ticker: "HNWA", code: "012450", exchange: "KRX", currency: "₩", price: 211500 },
  { name: "LG Energy", ticker: "LGEN", code: "373220", exchange: "KRX", currency: "₩", price: 340000 },
  { name: "Ecopro", ticker: "ECPR", code: "086520", exchange: "KOSDAQ", currency: "₩", price: 101200 },
  { name: "Advantest", ticker: "ADVT", code: "6857", exchange: "TSE", currency: "¥", price: 6640 },
  { name: "Itochu", ticker: "ITCH", code: "8001", exchange: "TSE", currency: "¥", price: 7314 },
  { name: "Marubeni", ticker: "MRBN", code: "8002", exchange: "TSE", currency: "¥", price: 3016 },
  { name: "Sony", ticker: "SONY", code: "6758", exchange: "TSE", currency: "¥", price: 13890 },
  { name: "Nintendo", ticker: "NINT", code: "7974", exchange: "TSE", currency: "¥", price: 8510 }
];

function normalizeMarketKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const hudiMarketLookup = new Map();
hudiMarkets.forEach((market) => {
  [
    market.name,
    market.ticker,
    market.code,
    `${market.ticker} ${market.code}`,
    `${market.ticker} ${market.exchange}`,
    `${market.name} ${market.code}`,
    `${market.name} ${market.exchange}`,
    `${market.exchange} ${market.code}`
  ].forEach((alias) => {
    hudiMarketLookup.set(normalizeMarketKey(alias), market);
  });
});

function findHudiMarket(token) {
  const normalized = normalizeMarketKey(token);
  if (!normalized) {
    return null;
  }

  if (hudiMarketLookup.has(normalized)) {
    return hudiMarketLookup.get(normalized);
  }

  return (
    hudiMarkets.find(
      (market) => normalizeMarketKey(market.name).includes(normalized) || normalizeMarketKey(market.ticker).includes(normalized)
    ) || null
  );
}

function getDisplayToken(token) {
  const market = findHudiMarket(token);
  if (market?.ticker) {
    return market.ticker;
  }

  const compact = String(token || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return (compact || "TOKN").slice(0, 4).padEnd(4, "X");
}

const scenarios = {
  "slight-profit": {
    label: "Slight Profit",
    token: "TENC",
    hudi: "@hudi",
    entry: "381.40",
    exit: "385.33",
    pnlOverride: "20.6",
    note: "HKEX move. Clean execution.",
    side: "long",
    leverage: "20"
  },
  "big-profit": {
    label: "Big Profit",
    token: "BYDD",
    hudi: "@hudi",
    entry: "219.80",
    exit: "227.41",
    pnlOverride: "34.6",
    note: "Conviction paid. Let the winner breathe.",
    side: "long",
    leverage: "20"
  },
  "huge-profit": {
    label: "Huge Profit",
    token: "NINT",
    hudi: "@hudi",
    entry: "8510.00",
    exit: "9224.84",
    pnlOverride: "168.0",
    note: "Massive move. Size managed, thesis nailed.",
    side: "long",
    leverage: "20"
  },
  "slight-loss": {
    label: "Slight Loss",
    token: "BABA",
    hudi: "@hudi",
    entry: "76.85",
    exit: "76.77",
    pnlOverride: "-2.0",
    note: "Small loss, thesis invalidated early.",
    side: "long",
    leverage: "20"
  },
  "big-loss": {
    label: "Big Loss",
    token: "HITK",
    hudi: "@hudi",
    entry: "48750.00",
    exit: "48472.13",
    pnlOverride: "-11.4",
    note: "Loss logged. Next trade gets cleaner.",
    side: "long",
    leverage: "20"
  },
  "huge-loss": {
    label: "Huge Loss",
    token: "LENO",
    hudi: "@hudi",
    entry: "212300.00",
    exit: "204600.13",
    pnlOverride: "-72.5",
    note: "Brutal hit. Risk rules get reviewed now.",
    side: "long",
    leverage: "20"
  }
};

const form = document.querySelector("#controls");
const marketList = document.querySelector("#market-list");
const preview = document.querySelector("#preview");
const sizeLabel = document.querySelector("#size-label");
const pnlPill = document.querySelector("#pnl-pill");
const statusNode = document.querySelector("#status");
const replayButton = document.querySelector("#replay-animation");
const graphControls = document.querySelector("#graph-controls");
const graphPreview = document.querySelector("#graph-preview");
const graphReplayButton = document.querySelector("#playground-replay");
const applyGraphButton = document.querySelector("#apply-graph");
const exportLottieButton = document.querySelector("#export-lottie");
const cardCustomizer = document.querySelector("#card-customizer");
const resetCustomizerButton = document.querySelector("#reset-customizer");
const copyChatCardButton = document.querySelector("#copy-chat-card");
const curveOutput = document.querySelector("#curve-output");
const bezierEditor = document.querySelector("#bezier-editor");
let appliedGraphState = null;
let graphVariationSeed = createMarketVariationSeed();
const bigProfitHudiAssetPath = "./assets/hudi-big-profit.svg";
const hugeProfitHudiAssetPath = "./assets/hudi-huge-profit.png";
const bigLossHudiAssetPath = "./assets/hudi-big-loss.svg";
const hugeLossHudiAssetPath = "./assets/hudi-huge-loss.svg";
const exportFontAssets = [
  { family: "OCRA Fixed", path: "./assets/fonts/OCRAStdFIXED-Regular.otf", mime: "font/otf", format: "opentype", weight: 400 },
  { family: "Syne Hudi", path: "./assets/fonts/Syne-Bold.ttf", mime: "font/ttf", format: "truetype", weight: 700 },
  { family: "Syne Mono Hudi", path: "./assets/fonts/SyneMono-Regular.ttf", mime: "font/ttf", format: "truetype", weight: 400 }
];
let bigProfitHudiHref = "";
let bigProfitHudiLoadPromise = null;
let hugeProfitHudiHref = "";
let hugeProfitHudiLoadPromise = null;
let bigLossHudiHref = "";
let bigLossHudiLoadPromise = null;
let hugeLossHudiHref = "";
let hugeLossHudiLoadPromise = null;
let exportFontCss = "";
let exportFontCssPromise = null;
const legacyAppStateStorageKey = "hudi-card-builder-state-v1";
const legacyCardCustomizationStorageKey = "hudi-card-customization-by-scenario-v2";
const pngExportScale = 3;
const customizationDefaults = {
  textX: 0,
  textY: 0,
  hudiX: 0,
  hudiY: 0,
  hudiScale: 1,
  orbX: 0,
  orbY: 0,
  orbGroupScale: 1,
  orbScale: 1,
  textScale: 1,
  orbSheenOpacity: 1,
  orbGlassOpacity: 1,
  orbHighlightOpacity: 1,
  orbBloomOpacity: 0.35,
  orbShadowOpacity: 0.4,
  chartX: 0,
  chartY: 0,
  chartScale: 1,
  candleBodyScale: 1.15,
  chartOpacity: 0.92,
  chartStrokeWidth: 1,
  wickStrokeWidth: 1.15,
  pnlStrokeWidth: 2,
  backgroundColor: "#ffffff",
  backgroundOpacity: 1,
  washOpacity: 0.2,
  pnlColor: "#03fd91",
  pnlStrokeColor: "#171717",
  textColor: "#171717",
  tokenColor: "#333333",
  hudiColor: "#03fd91",
  orbProfitColor: "#6bff97",
  orbLossColor: "#fd01ba",
  orbSheenColor: "#ffffff",
  orbShadowColor: "#3dffe8",
  chartStrokeColor: "#171717"
};
const customizationKeys = Object.keys(customizationDefaults);
const transientCustomizationByScenario = {};

function getLocalAssetHref(path) {
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return path;
  }
}

function usesBigLossHudi(state) {
  return state.pnl <= -10 && !usesHugeLossHudi(state);
}

function usesBigProfitHudi(state) {
  return state.scenario === "big-profit";
}

function usesHugeProfitHudi(state) {
  return state.scenario === "huge-profit";
}

function usesHugeLossHudi(state) {
  return state.scenario === "huge-loss";
}

function getBigProfitHudiHref() {
  return bigProfitHudiHref || getLocalAssetHref(bigProfitHudiAssetPath);
}

function getHugeProfitHudiHref() {
  return hugeProfitHudiHref || getLocalAssetHref(hugeProfitHudiAssetPath);
}

function getBigLossHudiHref() {
  return bigLossHudiHref || getLocalAssetHref(bigLossHudiAssetPath);
}

function getHugeLossHudiHref() {
  return hugeLossHudiHref || getLocalAssetHref(hugeLossHudiAssetPath);
}

function ensureBigProfitHudiAsset() {
  if (bigProfitHudiHref) {
    return Promise.resolve(bigProfitHudiHref);
  }

  if (!bigProfitHudiLoadPromise) {
    bigProfitHudiLoadPromise = fetch(getLocalAssetHref(bigProfitHudiAssetPath))
      .then((response) => {
        if (!response.ok) {
          throw new Error("Big profit Hudi asset failed to load.");
        }
        return response.text();
      })
      .then((svg) => {
        bigProfitHudiHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        return bigProfitHudiHref;
      })
      .catch(() => {
        bigProfitHudiHref = getLocalAssetHref(bigProfitHudiAssetPath);
        return bigProfitHudiHref;
      });
  }

  return bigProfitHudiLoadPromise;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fontAssetToCss(font) {
  const response = await fetch(getLocalAssetHref(font.path));
  if (!response.ok) {
    throw new Error(`${font.family} font failed to load.`);
  }

  const buffer = await response.arrayBuffer();
  const href = await blobToDataUrl(new Blob([buffer], { type: font.mime }));
  return `@font-face{font-family:"${font.family}";src:url("${href}") format("${font.format}");font-weight:${font.weight};font-style:normal;font-display:block;}`;
}

async function ensureExportFontCss() {
  if (exportFontCss) {
    return exportFontCss;
  }

  if (!exportFontCssPromise) {
    exportFontCssPromise = Promise.all(exportFontAssets.map(fontAssetToCss)).then((rules) => {
      exportFontCss = rules.join("\n");
      return exportFontCss;
    });
  }

  return exportFontCssPromise;
}

function ensureHugeProfitHudiAsset() {
  if (hugeProfitHudiHref) {
    return Promise.resolve(hugeProfitHudiHref);
  }

  if (!hugeProfitHudiLoadPromise) {
    hugeProfitHudiLoadPromise = fetch(getLocalAssetHref(hugeProfitHudiAssetPath))
      .then((response) => {
        if (!response.ok) {
          throw new Error("Huge profit Hudi asset failed to load.");
        }
        return response.blob();
      })
      .then((blob) => blobToDataUrl(blob))
      .then((href) => {
        hugeProfitHudiHref = href;
        return hugeProfitHudiHref;
      })
      .catch(() => {
        hugeProfitHudiHref = getLocalAssetHref(hugeProfitHudiAssetPath);
        return hugeProfitHudiHref;
      });
  }

  return hugeProfitHudiLoadPromise;
}

function ensureBigLossHudiAsset() {
  if (bigLossHudiHref) {
    return Promise.resolve(bigLossHudiHref);
  }

  if (!bigLossHudiLoadPromise) {
    bigLossHudiLoadPromise = fetch(getLocalAssetHref(bigLossHudiAssetPath))
      .then((response) => {
        if (!response.ok) {
          throw new Error("Big loss Hudi asset failed to load.");
        }
        return response.text();
      })
      .then((svg) => {
        bigLossHudiHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        return bigLossHudiHref;
      })
      .catch(() => {
        bigLossHudiHref = getLocalAssetHref(bigLossHudiAssetPath);
        return bigLossHudiHref;
      });
  }

  return bigLossHudiLoadPromise;
}

function ensureHugeLossHudiAsset() {
  if (hugeLossHudiHref) {
    return Promise.resolve(hugeLossHudiHref);
  }

  if (!hugeLossHudiLoadPromise) {
    hugeLossHudiLoadPromise = fetch(getLocalAssetHref(hugeLossHudiAssetPath))
      .then((response) => {
        if (!response.ok) {
          throw new Error("Huge loss Hudi asset failed to load.");
        }
        return response.text();
      })
      .then((svg) => {
        hugeLossHudiHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        return hugeLossHudiHref;
      })
      .catch(() => {
        hugeLossHudiHref = getLocalAssetHref(hugeLossHudiAssetPath);
        return hugeLossHudiHref;
      });
  }

  return hugeLossHudiLoadPromise;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function colorOrDefault(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function hexToRgbChannels(hex) {
  const safeHex = colorOrDefault(hex, "#000000").slice(1);
  return [
    Number.parseInt(safeHex.slice(0, 2), 16),
    Number.parseInt(safeHex.slice(2, 4), 16),
    Number.parseInt(safeHex.slice(4, 6), 16)
  ];
}

function readCustomization(values = Object.fromEntries(new FormData(form).entries())) {
  return {
    textX: numberOrDefault(values.textX, customizationDefaults.textX),
    textY: numberOrDefault(values.textY, customizationDefaults.textY),
    hudiX: numberOrDefault(values.hudiX, customizationDefaults.hudiX),
    hudiY: numberOrDefault(values.hudiY, customizationDefaults.hudiY),
    hudiScale: numberOrDefault(values.hudiScale, customizationDefaults.hudiScale),
    orbX: numberOrDefault(values.orbX, customizationDefaults.orbX),
    orbY: numberOrDefault(values.orbY, customizationDefaults.orbY),
    orbGroupScale: numberOrDefault(values.orbGroupScale, customizationDefaults.orbGroupScale),
    orbScale: numberOrDefault(values.orbScale, customizationDefaults.orbScale),
    textScale: numberOrDefault(values.textScale, customizationDefaults.textScale),
    orbSheenOpacity: numberOrDefault(values.orbSheenOpacity, customizationDefaults.orbSheenOpacity),
    orbGlassOpacity: numberOrDefault(values.orbGlassOpacity, customizationDefaults.orbGlassOpacity),
    orbHighlightOpacity: numberOrDefault(values.orbHighlightOpacity, customizationDefaults.orbHighlightOpacity),
    orbBloomOpacity: numberOrDefault(values.orbBloomOpacity, customizationDefaults.orbBloomOpacity),
    orbShadowOpacity: numberOrDefault(values.orbShadowOpacity, customizationDefaults.orbShadowOpacity),
    chartX: numberOrDefault(values.chartX, customizationDefaults.chartX),
    chartY: numberOrDefault(values.chartY, customizationDefaults.chartY),
    chartScale: numberOrDefault(values.chartScale, customizationDefaults.chartScale),
    candleBodyScale: numberOrDefault(values.candleBodyScale, customizationDefaults.candleBodyScale),
    chartOpacity: numberOrDefault(values.chartOpacity, customizationDefaults.chartOpacity),
    chartStrokeWidth: numberOrDefault(values.chartStrokeWidth, customizationDefaults.chartStrokeWidth),
    wickStrokeWidth: numberOrDefault(values.wickStrokeWidth, customizationDefaults.wickStrokeWidth),
    pnlStrokeWidth: numberOrDefault(values.pnlStrokeWidth, customizationDefaults.pnlStrokeWidth),
    backgroundColor: colorOrDefault(values.backgroundColor, customizationDefaults.backgroundColor),
    backgroundOpacity: numberOrDefault(values.backgroundOpacity, customizationDefaults.backgroundOpacity),
    washOpacity: numberOrDefault(values.washOpacity, customizationDefaults.washOpacity),
    pnlColor: colorOrDefault(values.pnlColor, customizationDefaults.pnlColor),
    pnlStrokeColor: colorOrDefault(values.pnlStrokeColor, customizationDefaults.pnlStrokeColor),
    textColor: colorOrDefault(values.textColor, customizationDefaults.textColor),
    tokenColor: colorOrDefault(values.tokenColor, customizationDefaults.tokenColor),
    hudiColor: colorOrDefault(values.hudiColor, customizationDefaults.hudiColor),
    orbProfitColor: colorOrDefault(values.orbProfitColor, customizationDefaults.orbProfitColor),
    orbLossColor: colorOrDefault(values.orbLossColor, customizationDefaults.orbLossColor),
    orbSheenColor: colorOrDefault(values.orbSheenColor, customizationDefaults.orbSheenColor),
    orbShadowColor: colorOrDefault(values.orbShadowColor, customizationDefaults.orbShadowColor),
    chartStrokeColor: colorOrDefault(values.chartStrokeColor, customizationDefaults.chartStrokeColor)
  };
}

function isDefaultCustomizationColor(customize, key) {
  return customize[key].toLowerCase() === customizationDefaults[key].toLowerCase();
}

function isDefaultCustomizationNumber(customize, key) {
  return Math.abs(numberOrDefault(customize[key], customizationDefaults[key]) - customizationDefaults[key]) < 0.0001;
}

function formatCustomizerOutput(input) {
  const value = numberOrDefault(input.value, 0);
  const suffix = input.dataset.suffix || "";
  if (suffix === "x") {
    return `${value.toFixed(2)}x`;
  }
  if (suffix === "px") {
    return `${value.toFixed(input.step && Number(input.step) < 1 ? 1 : 0)}px`;
  }
  return input.step && Number(input.step) < 1 ? value.toFixed(2) : String(Math.round(value));
}

function updateCustomizerOutputs() {
  cardCustomizer?.querySelectorAll('input[type="range"]').forEach((input) => {
    const output = cardCustomizer.querySelector(`[data-output="${input.name}"]`);
    if (output) {
      output.textContent = formatCustomizerOutput(input);
    }
  });
}

function clearLegacyPersistedState() {
  try {
    window.localStorage?.removeItem(legacyAppStateStorageKey);
    window.localStorage?.removeItem(legacyCardCustomizationStorageKey);
  } catch {
    // Storage can be blocked in some browser contexts. The demo does not depend on it.
  }
}

function formatMarketDatalistLabel(market) {
  const price = market.price.toLocaleString("en-US", {
    minimumFractionDigits: market.price % 1 ? 2 : 0,
    maximumFractionDigits: 2
  });
  return `${market.name} · ${market.exchange} ${market.code} · ${market.currency}${price}`;
}

function populateMarketList() {
  if (!marketList) {
    return;
  }

  marketList.innerHTML = hudiMarkets
    .map((market) => `<option value="${escapeXml(market.ticker)}" label="${escapeXml(formatMarketDatalistLabel(market))}"></option>`)
    .join("");
}

function getFormValue(name) {
  return form.elements[name]?.value ?? "";
}

function setFormValue(name, value) {
  const field = form.elements[name];
  if (field && value !== undefined && value !== null) {
    field.value = String(value);
  }
}

function getGraphValue(name) {
  return graphControls.elements[name]?.value ?? "";
}

function setGraphValue(name, value) {
  const field = graphControls.elements[name];
  if (field && value !== undefined && value !== null) {
    field.value = String(value);
  }
}

function saveAppState() {
  // The handoff/demo build is intentionally non-persistent: reloads return to defaults.
}

function loadStoredAppState() {
  clearLegacyPersistedState();
  setFormValue("size", "chat-orb");
  syncSimulatedPrices();
}

function getActiveScenarioKey(values) {
  if (values?.scenario) {
    return values.scenario;
  }

  return form.elements.scenario?.value || "slight-profit";
}

function getCustomizerInput(name) {
  return cardCustomizer?.querySelector(`[name="${name}"]`);
}

function setCustomizerInput(name, value) {
  const input = getCustomizerInput(name);
  if (input) {
    input.value = String(value);
  }
}

function saveCustomizationForScenario(scenarioKey = getActiveScenarioKey()) {
  transientCustomizationByScenario[scenarioKey] = {};

  for (const key of customizationKeys) {
    const input = getCustomizerInput(key);
    transientCustomizationByScenario[scenarioKey][key] = input?.value || customizationDefaults[key];
  }
}

function applyStoredCustomizationForScenario(scenarioKey = getActiveScenarioKey()) {
  const values = transientCustomizationByScenario[scenarioKey] || {};

  for (const key of customizationKeys) {
    setCustomizerInput(key, values[key] || customizationDefaults[key]);
  }

  updateCustomizerOutputs();
}

function loadStoredCustomizerState() {
  applyStoredCustomizationForScenario();
}

function persistCustomizerChange(target) {
  if (!target || !cardCustomizer?.contains(target) || !target.name) {
    return;
  }

  saveCustomizationForScenario();
}

function resetCustomizer() {
  const scenarioKey = getActiveScenarioKey();
  for (const [name, value] of Object.entries(customizationDefaults)) {
    setCustomizerInput(name, value);
  }

  saveCustomizationForScenario(scenarioKey);
  updateCustomizerOutputs();
  updatePreview({ animated: false });
  updateGraphPreview();
  setStatus("Customizer reset.");
}

function calculatePnl(entry, exit, side) {
  if (!entry || !exit) {
    return 0;
  }

  const direction = side === "short" ? entry - exit : exit - entry;
  return (direction / entry) * 100;
}

function formatPrice(value) {
  const price = numberOrZero(value);
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

function formatPnl(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatHudiPrice(value) {
  return numberOrZero(value).toFixed(2).replace(".", ",");
}

function formatSimPrice(value) {
  const price = numberOrZero(value);
  if (price >= 1000) {
    return price.toFixed(2);
  }
  if (price >= 1) {
    return price.toFixed(2);
  }
  return price.toFixed(5);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function simulatedEntryForToken(token) {
  return findHudiMarket(token)?.price ?? 100;
}

function simulateTradePrices({ token, pnl, side, leverage }) {
  const entry = simulatedEntryForToken(token);
  const lev = clamp(numberOrZero(leverage) || 1, 1, 20);
  const signedMovePct = getSimulatedPriceMovePct({ pnl, side, leverage: lev });
  const exit = Math.max(entry * (1 + signedMovePct / 100), entry * 0.01);

  return { entry, exit };
}

function getSimulatedPriceMovePct({ pnl, side, leverage }) {
  const lev = clamp(numberOrZero(leverage) || 1, 1, 20);
  const sideSign = side === "short" ? -1 : 1;
  return (numberOrZero(pnl) / lev) * sideSign;
}

function syncSimulatedPrices() {
  const values = Object.fromEntries(new FormData(form).entries());
  const override = String(values.pnlOverride || "").trim();
  const currentEntry = numberOrZero(values.entry) || simulatedEntryForToken(values.token);
  const currentExit = numberOrZero(values.exit) || currentEntry;
  const rawPnl = override === "" ? calculatePnl(currentEntry, currentExit, values.side) : numberOrZero(override);
  const simulated = simulateTradePrices({
    token: values.token,
    pnl: rawPnl,
    side: values.side,
    leverage: values.leverage
  });

  form.elements.entry.value = formatSimPrice(simulated.entry);
  form.elements.exit.value = formatSimPrice(simulated.exit);
}

function estimateMonoWidth(value, fontSize) {
  return String(value).length * fontSize * 0.63;
}

function estimateSyneWidth(value, fontSize) {
  return String(value).length * fontSize * 0.7;
}

function getOrbCompositionLayout(customize = customizationDefaults) {
  const groupScale = numberOrDefault(customize.orbGroupScale, customizationDefaults.orbGroupScale);
  const orbScale = numberOrDefault(customize.orbScale, customizationDefaults.orbScale);
  const size = 590 * groupScale * orbScale;
  const centerX = 340 + customize.orbX;
  const centerY = 400 + customize.orbY;

  return {
    x: centerX - size / 2,
    y: centerY - size / 2,
    size,
    centerX,
    centerY
  };
}

function getTextBoxLayout({ token, side, pnl, meta, preset, customize = customizationDefaults }) {
  const isOrb = preset?.variant === "orb";
  const orbLayout = isOrb ? getOrbCompositionLayout(customize) : null;
  const textScale = numberOrDefault(customize.textScale, customizationDefaults.textScale);
  const groupScale = isOrb ? numberOrDefault(customize.orbGroupScale, customizationDefaults.orbGroupScale) : 1;
  const effectiveTextScale = isOrb ? textScale * groupScale : 1;
  const pnlFontSize = (isOrb ? 108 : 112) * effectiveTextScale;
  const metaFontSize = (isOrb ? 24 : 28) * effectiveTextScale;
  const sideFontSize = (isOrb ? 25 : 28) * effectiveTextScale;
  const tokenFontSize = (isOrb ? 56 : 58) * effectiveTextScale;
  const pnlWidth = estimateMonoWidth(pnl, pnlFontSize);
  const boxWidth = Math.ceil(pnlWidth);
  const boxLeft = (isOrb ? orbLayout.centerX - boxWidth / 2 : clamp(82, 48, 680 - boxWidth)) + customize.textX;
  const boxRight = boxLeft + boxWidth;
  const pnlCenterY = (isOrb ? orbLayout.centerY : 419) + customize.textY;
  const sideOffsetY = (isOrb ? -100 : -99) * effectiveTextScale;
  const tokenOffsetY = (isOrb ? -92 : -91) * effectiveTextScale;
  const pnlOffsetY = (isOrb ? 48 : 47) * effectiveTextScale;
  const metaOffsetY = (isOrb ? 105 : 106) * effectiveTextScale;

  return {
    boxLeft,
    boxRight,
    boxWidth,
    pnlCenterX: boxLeft + boxWidth / 2,
    pnlCenterY,
    pnlX: boxLeft,
    sideX: boxLeft,
    tokenX: boxRight,
    metaX: boxLeft,
    sideY: isOrb ? pnlCenterY + sideOffsetY : 320,
    tokenY: isOrb ? pnlCenterY + tokenOffsetY : 328,
    pnlY: isOrb ? pnlCenterY + pnlOffsetY : 466,
    metaY: isOrb ? pnlCenterY + metaOffsetY : 525,
    pnlFontSize,
    metaFontSize,
    sideFontSize,
    tokenFontSize
  };
}

function normalizeChartValue(value) {
  return clamp(value, 0.08, 0.92);
}

function createSeededRandom(seedText) {
  let seed = 2166136261;
  for (const character of String(seedText)) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    seed ^= seed >>> 16;
    return (seed >>> 0) / 4294967296;
  };
}

function centeredNoise(random, amount) {
  return (random() - 0.5) * amount;
}

function createMarketVariationSeed() {
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(2);
    window.crypto.getRandomValues(values);
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function randomizeGraphVariation() {
  graphVariationSeed = createMarketVariationSeed();
}

function getPatternDirection(pattern) {
  return ["trend-down", "breakdown", "capitulation"].includes(pattern) ? "down" : "up";
}

function getCurrentTradeContext() {
  const state = readState();
  return {
    entry: state.entry,
    exit: state.exit,
    pnl: state.pnl,
    side: state.side,
    leverage: state.leverage
  };
}

function getTradeGraphInfluence({ entry = 0, exit = 0, pnl, side = "long", leverage = 20 }) {
  const entryPrice = numberOrZero(entry);
  const magnitude = Math.abs(numberOrZero(pnl));
  const lev = clamp(numberOrZero(leverage) || 1, 1, 20);
  const isShort = side === "short";
  const isProfit = pnl >= 0;
  const priceMovePct = getSimulatedPriceMovePct({ pnl, side, leverage: lev });
  const exitPrice = entryPrice > 0 ? Math.max(entryPrice * (1 + priceMovePct / 100), entryPrice * 0.01) : numberOrZero(exit);
  const sideReturnPct = isShort ? -priceMovePct : priceMovePct;
  const marketDirection = priceMovePct >= 0 ? "up" : "down";
  const expectedPnlPct = sideReturnPct * lev;
  const impliedLeverage = Math.abs(sideReturnPct) > 0.001 ? clamp(Math.abs(numberOrZero(pnl) / sideReturnPct), 1, 20) : lev;
  const pnlMismatch = Math.abs(numberOrZero(pnl) - expectedPnlPct);
  const underlyingMove = Math.abs(priceMovePct);

  return {
    entry: entryPrice,
    exit: exitPrice,
    pnl,
    side,
    leverage: lev,
    impliedLeverage,
    sign: isProfit ? "profit" : "loss",
    marketDirection,
    priceMovePct,
    sideReturnPct,
    expectedPnlPct,
    pnlMismatch,
    underlyingMove,
    strength: clamp(Math.log10(magnitude + 1) / 3.4 + lev / 180 + Math.min(underlyingMove, 55) / 95 + Math.min(pnlMismatch, 45) / 260, 0.12, 0.82),
    isStrong: magnitude >= 12,
    isVeryStrong: magnitude >= 25
  };
}

function resolvePatternForTrade(pattern, tradeContext) {
  const influence = getTradeGraphInfluence(tradeContext);

  if (Math.abs(influence.pnl) < 0.05 || pattern === "chop") {
    return "chop";
  }

  if (pattern === "pnl-driven") {
    if (influence.marketDirection === "down") {
      return influence.isVeryStrong || (influence.side === "long" && influence.sign === "loss" && influence.isStrong) ? "capitulation" : "trend-down";
    }
    return influence.isStrong || (influence.side === "short" && influence.sign === "loss") ? "breakout" : "trend-up";
  }

  if (influence.marketDirection === "down") {
    if (["breakout", "breakdown", "squeeze"].includes(pattern)) {
      return "breakdown";
    }
    if (["capitulation", "pump-dump"].includes(pattern) || influence.isVeryStrong) {
      return "capitulation";
    }
    return "trend-down";
  }

  if (["breakout", "breakdown", "squeeze"].includes(pattern)) {
    return "breakout";
  }
  if (["capitulation", "pump-dump"].includes(pattern) || influence.isStrong) {
    return "breakout";
  }
  return "trend-up";
}

function withTradeGraphInfluence(graphState, tradeContext) {
  const influence = getTradeGraphInfluence(tradeContext);
  const effectivePattern = resolvePatternForTrade(graphState.pattern, tradeContext);

  return {
    ...graphState,
    pnl: influence.pnl,
    entry: influence.entry,
    exit: influence.exit,
    side: influence.side,
    leverage: influence.leverage,
    impliedLeverage: influence.impliedLeverage,
    marketDirection: influence.marketDirection,
    priceMovePct: influence.priceMovePct,
    sideReturnPct: influence.sideReturnPct,
    expectedPnlPct: influence.expectedPnlPct,
    pnlMismatch: influence.pnlMismatch,
    underlyingMove: influence.underlyingMove,
    pnlStrength: influence.strength,
    pnlSign: influence.sign,
    effectivePattern
  };
}

function getPatternStart(pattern, random) {
  const jitter = centeredNoise(random, 0.065);
  const starts = {
    "trend-up": 0.2,
    "trend-down": 0.8,
    breakout: 0.32,
    breakdown: 0.68,
    chop: 0.5,
    squeeze: 0.44,
    "pump-dump": 0.26,
    capitulation: 0.84
  };

  return normalizeChartValue((starts[pattern] ?? 0.5) + jitter);
}

function createMarketProfile(pattern, strength, random) {
  const breakoutAt = clamp(0.36 + random() * 0.36 - strength * 0.1, 0.22, 0.78);
  const cycleA = 4 + Math.floor(random() * 5);
  const cycleB = 8 + Math.floor(random() * 8);
  const offsetA = Math.floor(random() * cycleA);
  const offsetB = Math.floor(random() * cycleB);

  return {
    breakoutAt,
    releaseAt: clamp(breakoutAt + 0.08 + random() * 0.18, 0.42, 0.82),
    pullbackA: cycleA,
    pullbackB: cycleB,
    offsetA,
    offsetB,
    volatility: 0.78 + random() * 0.72,
    wick: 0.75 + random() * 0.85,
    drift: 0.82 + random() * 0.5,
    impulseBias: random() > 0.48 ? 1 : -1,
    falseBreakChance: 0.08 + random() * 0.18
  };
}

function taperExtremeDrift(price, drift) {
  if (drift > 0 && price > 0.78) {
    return drift * clamp((0.94 - price) / 0.18, 0.12, 1);
  }
  if (drift < 0 && price < 0.22) {
    return drift * clamp((price - 0.06) / 0.18, 0.12, 1);
  }
  return drift;
}

function getPatternRegime(pattern, t, index, count, price, strength, random, profile) {
  const pullback = (index + profile.offsetA) % profile.pullbackA === 0 || (index + profile.offsetB) % profile.pullbackB === 0;
  const impulse = index % Math.max(3, Math.round(profile.pullbackA * 1.6)) === 2 || index > count * (0.66 + profile.breakoutAt * 0.18);
  const meanRevert = (0.5 - price) * 0.07;
  const earlyRamp = clamp(t / Math.max(profile.breakoutAt, 0.22), 0, 1);
  let drift = 0;
  let volatility = (0.018 + strength * 0.025) * profile.volatility;
  let wickBias = profile.wick;

  if (pattern === "trend-down") {
    drift = (-0.011 - strength * 0.014) * profile.drift + (pullback ? 0.018 + random() * 0.024 : 0) + centeredNoise(random, 0.019);
    wickBias = pullback ? 1.35 : 0.95;
  } else if (pattern === "breakout") {
    const compressed = t < profile.breakoutAt;
    const falseBreak = compressed && random() < profile.falseBreakChance;
    drift = compressed
      ? (0.006 + strength * 0.014) * (0.42 + earlyRamp) + (pullback ? -0.018 - random() * 0.014 : 0) + centeredNoise(random, 0.021) - (falseBreak ? 0.014 : 0)
      : (0.018 + strength * 0.041) * profile.drift + (pullback ? -0.015 - random() * 0.025 : 0) + centeredNoise(random, 0.028);
    volatility = compressed ? (0.014 + strength * 0.014 + random() * 0.014) * profile.volatility : (0.024 + strength * 0.032) * profile.volatility;
    wickBias = compressed ? 1.05 : 1.15;
  } else if (pattern === "breakdown") {
    const compressed = t < profile.breakoutAt;
    const falseBreak = compressed && random() < profile.falseBreakChance;
    drift = compressed
      ? (-0.006 - strength * 0.014) * (0.42 + earlyRamp) + (pullback ? 0.018 + random() * 0.014 : 0) + centeredNoise(random, 0.021) + (falseBreak ? 0.014 : 0)
      : (-0.018 - strength * 0.041) * profile.drift + (pullback ? 0.015 + random() * 0.025 : 0) + centeredNoise(random, 0.028);
    volatility = compressed ? (0.014 + strength * 0.014 + random() * 0.014) * profile.volatility : (0.024 + strength * 0.032) * profile.volatility;
    wickBias = compressed ? 1.05 : 1.15;
  } else if (pattern === "chop") {
    drift = (0.5 - price) * 0.18 + centeredNoise(random, 0.054);
    volatility = 0.026 + random() * 0.018;
    wickBias = 1.45;
  } else if (pattern === "squeeze") {
    const release = t > profile.releaseAt;
    drift = release ? 0.025 + strength * 0.045 + centeredNoise(random, 0.02) : meanRevert + centeredNoise(random, 0.011 * (1 - t));
    volatility = release ? 0.034 + strength * 0.025 : 0.018 * (1 - t) + 0.006;
    wickBias = release ? 1.05 : 0.55;
  } else if (pattern === "pump-dump") {
    drift = t < 0.42 ? 0.03 + strength * 0.052 : t < 0.62 ? -0.006 + centeredNoise(random, 0.03) : -0.032 - strength * 0.038;
    volatility = t < 0.62 ? 0.028 + strength * 0.025 : 0.041 + strength * 0.034;
    wickBias = t < 0.62 ? 1.1 : 1.55;
  } else if (pattern === "capitulation") {
    drift = t < 0.36 ? -0.014 - strength * 0.014 : t < 0.8 ? -0.038 - strength * 0.05 : 0.018 + centeredNoise(random, 0.028);
    volatility = t < 0.36 ? 0.025 : 0.046 + strength * 0.042;
    wickBias = t > 0.45 ? 1.9 : 1.2;
  } else {
    drift = (0.011 + strength * 0.014) * profile.drift + (pullback ? -0.018 - random() * 0.024 : 0) + (impulse ? 0.01 * profile.impulseBias : 0) + centeredNoise(random, 0.019);
    wickBias = pullback ? 1.35 : 0.95;
  }

  return { drift: taperExtremeDrift(price, drift), volatility, wickBias };
}

function candleDirection(open, close, fallback = "up") {
  if (Math.abs(close - open) < 0.000001) {
    return fallback === "down" ? "down" : "up";
  }
  return close > open ? "up" : "down";
}

function candleStrength(open, close) {
  return Math.abs(close - open) >= 0.018 ? "strong" : "slight";
}

function candleColor(open, close, index, fallbackDirection = "up") {
  const direction = candleDirection(open, close, fallbackDirection);
  const strength = candleStrength(open, close);
  if (direction === "up") {
    return strength === "strong" ? "#01FD90" : "#96FFD2";
  }
  return strength === "strong" ? "#FD01BA" : "#FF92E2";
}

function candleStepWeight(candle, index, count, random, tradeRoute) {
  const progress = index / Math.max(count - 1, 1);
  const originalBody = Math.abs(candle.close - candle.open);
  const originalRange = Math.max(candle.high - candle.low, originalBody);
  const releaseZone = progress > 0.42 && progress < 0.78;
  const latePush = progress > 0.72 ? 0.3 : 0;
  const impulse = releaseZone && random() > 0.58 ? 1.65 + random() * 1.45 : 1;
  const volatilityMemory = 0.55 + originalBody * 34 + originalRange * 8;
  const noise = 0.45 + Math.pow(random(), 1.85) * 2.8;
  const strengthBoost = 0.75 + tradeRoute.pnlStrength * 0.9 + latePush;

  return clamp(volatilityMemory * noise * impulse * strengthBoost, 0.32, 8.5);
}

function fitCandlesToTradeRoute(candles, tradeRoute, seed) {
  if (!tradeRoute || candles.length < 2) {
    return candles;
  }

  const random = createSeededRandom(`${seed}-route-fit`);
  const move = Math.abs(numberOrZero(tradeRoute.priceMovePct));
  const routeDirection = tradeRoute.marketDirection === "down" ? "down" : "up";
  const targetRange = clamp(0.14 + Math.log1p(move) * 0.095 + tradeRoute.pnlStrength * 0.2, 0.16, 0.74);
  const isProfit = numberOrZero(tradeRoute.pnl) >= 0;
  const profitStart = 0.08 + random() * 0.055;
  const lossStart = 0.92 - random() * 0.055;
  let targetStart = isProfit ? profitStart : lossStart;
  if (routeDirection === "up") {
    targetStart = Math.min(targetStart, 0.9 - targetRange);
  } else {
    targetStart = Math.max(targetStart, 0.1 + targetRange);
  }
  const targetEnd = routeDirection === "up" ? targetStart + targetRange : targetStart - targetRange;
  const targetDelta = targetEnd - targetStart;
  const routeSign = targetDelta >= 0 ? 1 : -1;
  const pullbackChance = clamp(0.2 - tradeRoute.pnlStrength * 0.08, 0.07, 0.2);
  const weightedSteps = candles.map((candle, index) => {
    const progress = index / Math.max(candles.length - 1, 1);
    const originalSign = candle.close >= candle.open ? 1 : -1;
    const canPullback = index > 1 && index < candles.length - 2;
    const followsOriginalPullback = originalSign !== routeSign && random() < 0.55;
    const stochasticPullback = canPullback && random() < pullbackChance * (progress > 0.22 && progress < 0.86 ? 1 : 0.45);
    const sign = canPullback && (followsOriginalPullback || stochasticPullback) ? -routeSign : routeSign;

    return {
      sign,
      weight: candleStepWeight(candle, index, candles.length, random, tradeRoute)
    };
  });
  const counterWeight = weightedSteps.filter((step) => step.sign !== routeSign).reduce((sum, step) => sum + step.weight, 0);
  const sameWeight = weightedSteps.filter((step) => step.sign === routeSign).reduce((sum, step) => sum + step.weight, 0) || 1;
  const counterBudget = counterWeight > 0 ? Math.abs(targetDelta) * clamp(0.06 + counterWeight / (sameWeight + counterWeight) * 0.22, 0.04, 0.18) : 0;
  const sameBudget = Math.abs(targetDelta) + counterBudget;
  const steps = weightedSteps.map((step) => {
    if (step.sign === routeSign) {
      return routeSign * sameBudget * (step.weight / sameWeight);
    }
    return -routeSign * counterBudget * (step.weight / counterWeight);
  });
  let previousClose = targetStart;

  return candles.map((candle, index) => {
    const open = index === 0 ? targetStart : previousClose;
    const close = index === candles.length - 1 ? targetEnd : normalizeChartValue(open + steps[index]);
    const body = Math.abs(close - open);
    const originalRange = Math.max(candle.high - candle.low, body);
    const wickBase = 0.005 + tradeRoute.pnlStrength * 0.006 + body * (0.25 + random() * 0.55) + originalRange * 0.06;
    const longWick = random() < 0.14 ? 1.8 + random() * 2.4 : 1;
    const upperBias = routeDirection === "up" ? 0.9 : 1.15;
    const lowerBias = routeDirection === "down" ? 1.05 : 1.2;
    const upperWick = wickBase * upperBias * longWick * (0.35 + random() * 1.25);
    const lowerWick = wickBase * lowerBias * (random() < 0.16 ? 1.65 + random() * 1.85 : 1) * (0.35 + random() * 1.25);
    const high = Math.max(open, close) + upperWick;
    const low = Math.min(open, close) - lowerWick;
    const direction = candleDirection(open, close, routeDirection);
    previousClose = close;

    return {
      ...candle,
      open,
      close,
      high: normalizeChartValue(high),
      low: normalizeChartValue(low),
      color: candleColor(open, close, index, routeDirection),
      direction
    };
  });
}

function generateOhlcCandles({ pattern, barAmount, strength = 0.28, seed = "hudi", tradeRoute = null }) {
  const count = Math.max(12, Math.round(numberOrZero(barAmount)));
  const random = createSeededRandom(`${pattern}-${count}-${strength.toFixed(3)}-${seed}`);
  const direction = getPatternDirection(pattern);
  const profile = createMarketProfile(pattern, strength, random);
  const candles = [];
  let close = getPatternStart(pattern, random);

  for (let index = 0; index < count; index += 1) {
    const t = index / Math.max(count - 1, 1);
    const { drift, volatility, wickBias } = getPatternRegime(pattern, t, index, count, close, strength, random, profile);
    const open = close;
    close = normalizeChartValue(open + drift + centeredNoise(random, volatility));
    const body = Math.abs(close - open);
    const upperWick = (0.01 + random() * volatility * wickBias) * (close >= open ? 0.85 : 1.25);
    const lowerWick = (0.01 + random() * volatility * wickBias) * (close >= open ? 1.15 : 0.9);
    const panicWick = pattern === "capitulation" && t > 0.48 ? random() * 0.09 : 0;
    const high = normalizeChartValue(Math.max(open, close) + upperWick + body * 0.2);
    const low = normalizeChartValue(Math.min(open, close) - lowerWick - panicWick);

    candles.push({
      open,
      close,
      high,
      low,
      color: candleColor(open, close, index, direction),
      direction: candleDirection(open, close, direction),
      profile: profile.breakoutAt
    });
  }

  return fitCandlesToTradeRoute(candles, tradeRoute, `${pattern}-${count}-${strength.toFixed(3)}-${seed}`);
}

function getChartBars(pnl) {
  const strength = clamp(Math.abs(pnl) / 100, 0.08, 0.62);
  const pattern = pnl >= 0 ? (strength > 0.24 ? "breakout" : "trend-up") : strength > 0.24 ? "capitulation" : "trend-down";
  return generateOhlcCandles({ pattern, barAmount: 32, strength, seed: `sharecard-${pnl}` });
}

function getSharecardChartState(state) {
  const sourceGraphState = readGraphState();
  const graphState = withTradeGraphInfluence(sourceGraphState, state);

  return {
    candles: generateOhlcCandles({
      pattern: graphState.effectivePattern,
      barAmount: graphState.barAmount,
      strength: graphState.pnlStrength,
      seed: `sharecard-${graphState.marketSeed}-${graphState.effectivePattern}-${state.side}-${state.entry}-${state.exit}-${state.pnl}-${graphState.barAmount}`,
      tradeRoute: graphState
    }),
    duration: graphState.duration,
    spline: graphState.spline,
    curve: graphState.curve,
    animationType: graphState.animationType,
    pattern: graphState.effectivePattern,
    sourcePattern: graphState.pattern,
    marketSeed: graphState.marketSeed,
    cardScale: graphState.cardScale,
    customize: state.customize,
    pnlStrength: graphState.pnlStrength,
    pnlSign: graphState.pnlSign,
    side: graphState.side,
    leverage: graphState.leverage,
    impliedLeverage: graphState.impliedLeverage,
    marketDirection: graphState.marketDirection,
    priceMovePct: graphState.priceMovePct,
    sideReturnPct: graphState.sideReturnPct,
    expectedPnlPct: graphState.expectedPnlPct,
    pnlMismatch: graphState.pnlMismatch,
    underlyingMove: graphState.underlyingMove
  };
}

function getSharecardChartMetrics(chartState) {
  const customize = chartState.customize || customizationDefaults;
  const chartScale = (chartState.cardScale || 1.75) * numberOrDefault(customize.chartScale, customizationDefaults.chartScale);
  const candleBodyScale = clamp(numberOrDefault(customize.candleBodyScale, customizationDefaults.candleBodyScale), 0.75, 2.2);
  const chartX = customize.chartX;
  const chartY = -215 * (chartScale - 1) + customize.chartY;
  const chartWidth = 1200 / chartScale;
  const barStep = chartWidth / chartState.candles.length;

  return {
    chartScale,
    candleBodyScale,
    chartX,
    chartY,
    chartWidth,
    barStep,
    bodyWidth: clamp(barStep * 0.72, 7, barStep * 0.82)
  };
}

function transformSharecardChartPoint(metrics, x, y) {
  return {
    x: metrics.chartX + x * metrics.chartScale,
    y: metrics.chartY + y * metrics.chartScale
  };
}

function valueToChartY(value) {
  const top = 0.5;
  const bottom = 505.5;
  return bottom - normalizeChartValue(value) * (bottom - top);
}

function buildBarChartSvg(state, options = {}) {
  const chartState = getSharecardChartState(state);
  if (!chartState) {
    return "";
  }

  const bars = chartState.candles;
  const metrics = getSharecardChartMetrics(chartState);
  const customize = state.customize || customizationDefaults;
  const minBodyHeight = 4;
  const totalDuration = Math.max(chartState.duration, 0.4);
  const candleDuration = Math.max(0.2, totalDuration * 0.42);
  const stagger = Math.max(0.006, (totalDuration - candleDuration) / Math.max(bars.length - 1, 1));

  const barMarkup = bars
    .map((bar, index) => {
      const localX = index * metrics.barStep + 0.5;
      const localBodyWidth = metrics.bodyWidth;
      const x = localX * metrics.chartScale;
      const bodyWidth = localBodyWidth * metrics.chartScale;
      const centerX = x + bodyWidth / 2;
      const openY = valueToChartY(bar.open) * metrics.chartScale;
      const closeY = valueToChartY(bar.close) * metrics.chartScale;
      const highY = valueToChartY(bar.high) * metrics.chartScale;
      const lowY = valueToChartY(bar.low) * metrics.chartScale;
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      const bodyCenter = (bodyTop + bodyBottom) / 2;
      const rawBodyHeight = bodyBottom - bodyTop;
      const scaledMinBodyHeight = minBodyHeight * metrics.chartScale;
      const bodyHeight = Math.max(scaledMinBodyHeight, rawBodyHeight * metrics.candleBodyScale);
      const adjustedTop = bodyCenter - bodyHeight / 2;
      const adjustedBottom = adjustedTop + bodyHeight;
      const wickHighY = Math.min(highY, adjustedTop);
      const wickLowY = Math.max(lowY, adjustedBottom);
      const originY = bar.direction === "down" ? Math.min(openY, closeY, wickHighY) : Math.max(openY, closeY, wickLowY);
      const begin = (0.18 + index * stagger).toFixed(3);

      return `
        <g class="chart-bar chart-bar-${index + 1} ${options.animated ? "sharecard-candle-grow" : ""}" data-pattern="${escapeXml(chartState.pattern)}" data-animation="${escapeXml(
        chartState.animationType
      )}" style="${options.animated ? `--delay:${begin}s; --dur:${candleDuration.toFixed(3)}s; --ease:${chartState.curve}; transform-box:view-box; transform-origin:${centerX}px ${originY}px;` : ""}">
          <line x1="${centerX}" y1="${wickHighY}" x2="${centerX}" y2="${wickLowY}" stroke="${customize.chartStrokeColor}" stroke-width="${customize.chartStrokeWidth}" />
          <rect x="${x}" y="${adjustedTop}" width="${bodyWidth}" height="${bodyHeight}" fill="${bar.color}" stroke="${customize.chartStrokeColor}" stroke-width="${customize.chartStrokeWidth}" />
        </g>
      `;
    })
    .join("");

  return `
    <g class="bar-chart" transform="translate(${metrics.chartX} ${metrics.chartY})" opacity="${customize.chartOpacity}">
      ${barMarkup}
    </g>
  `;
}

function generatePlaygroundCandles(state) {
  const pnlState = withTradeGraphInfluence(state, getCurrentTradeContext());
  return generateOhlcCandles({
    pattern: pnlState.effectivePattern,
    barAmount: pnlState.barAmount,
    strength: pnlState.pnlStrength,
    seed: `playground-${pnlState.marketSeed}-${pnlState.effectivePattern}-${pnlState.side}-${pnlState.entry}-${pnlState.exit}-${pnlState.pnl.toFixed(2)}`,
    tradeRoute: pnlState
  });
}

function readGraphState() {
  const values = Object.fromEntries(new FormData(graphControls).entries());
  const x1 = numberOrZero(values.x1);
  const y1 = numberOrZero(values.y1);
  const x2 = numberOrZero(values.x2);
  const y2 = numberOrZero(values.y2);

  return {
    pattern: values.pattern,
    animationType: "grow",
    barAmount: numberOrZero(values.barAmount),
    cardScale: numberOrZero(values.cardScale),
    marketSeed: graphVariationSeed,
    duration: numberOrZero(values.duration),
    curve: `cubic-bezier(${x1.toFixed(2)}, ${y1.toFixed(2)}, ${x2.toFixed(2)}, ${y2.toFixed(2)})`,
    spline: `${x1.toFixed(2)} ${clamp(y1, 0, 1).toFixed(2)} ${x2.toFixed(2)} ${clamp(y2, 0, 1).toFixed(2)}`
  };
}

function chartY(value, top = 40, bottom = 500) {
  return bottom - normalizeChartValue(value) * (bottom - top);
}

function buildPlaygroundGraphSvg(state) {
  const pnlState = withTradeGraphInfluence(state, getCurrentTradeContext());
  const candles = generatePlaygroundCandles(state);
  const customize = readCustomization();
  const candleBodyScale = clamp(numberOrDefault(customize.candleBodyScale, customizationDefaults.candleBodyScale), 0.75, 2.2);
  const width = 960;
  const height = 540;
  const left = 42;
  const right = 918;
  const step = (right - left) / candles.length;
  const bodyWidth = clamp(step * 0.78, 5, step * 0.84);
  const minBodyHeight = 4;
  const totalDuration = Math.max(state.duration, 0.4);
  const candleDuration = Math.max(0.18, totalDuration * 0.38);
  const stagger = Math.max(0.006, (totalDuration - candleDuration) / Math.max(candles.length - 1, 1));

  const animationClass = "lab-grow";

  const candleMarkup = candles
    .map((candle, index) => {
      const centerX = left + index * step + step / 2;
      const openY = chartY(candle.open);
      const closeY = chartY(candle.close);
      const highY = chartY(candle.high);
      const lowY = chartY(candle.low);
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      const bodyCenter = (bodyTop + bodyBottom) / 2;
      const bodyHeight = Math.max(minBodyHeight, (bodyBottom - bodyTop) * candleBodyScale);
      const adjustedTop = bodyCenter - bodyHeight / 2;
      const adjustedBottom = adjustedTop + bodyHeight;
      const wickHighY = Math.min(highY, adjustedTop);
      const wickLowY = Math.max(lowY, adjustedBottom);
      const delay = index * stagger;
      const originY = candle.direction === "down" ? Math.min(openY, closeY, wickHighY) : Math.max(openY, closeY, wickLowY);

      return `
        <g class="lab-candle ${animationClass}" style="--delay:${delay.toFixed(3)}s; --dur:${candleDuration.toFixed(
          3
        )}s; --ease:${state.curve}; --origin-x:${centerX}px; --origin-y:${originY}px;">
          <line x1="${centerX}" y1="${wickHighY}" x2="${centerX}" y2="${wickLowY}" stroke="#171717" stroke-width="1.2" />
          <rect x="${centerX - bodyWidth / 2}" y="${adjustedTop}" width="${bodyWidth}" height="${bodyHeight}" fill="${
        candle.color
      }" stroke="#171717" stroke-width="1" />
        </g>
      `;
    })
    .join("");

  return `
    <svg class="lab-graph-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Graph animation playground preview">
      <defs>
        <linearGradient id="labWash" x1="0" y1="0" x2="960" y2="540" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F8FCFF" />
          <stop offset="1" stop-color="#E9FFF4" />
        </linearGradient>
      </defs>
      <style>
        .lab-candle {
          opacity: 0;
          transform-box: view-box;
          transform-origin: var(--origin-x) var(--origin-y);
          animation-duration: var(--dur);
          animation-delay: var(--delay);
          animation-timing-function: var(--ease);
          animation-fill-mode: forwards;
        }
        .lab-grow { animation-name: labGrow; }
        @keyframes labGrow { from { opacity: 0; transform: scaleY(0); } to { opacity: 1; transform: scaleY(1); } }
      </style>
      <rect width="960" height="540" rx="18" fill="url(#labWash)" />
      <path d="M42 500H918" stroke="#171717" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="7 7" />
      <path d="M42 40H918" stroke="#171717" stroke-opacity="0.16" stroke-width="1" stroke-dasharray="7 7" />
      ${candleMarkup}
      <text x="42" y="32" fill="#74809B" font-size="18" font-family="'OCRA Fixed', ui-monospace, monospace">${escapeXml(
        pnlState.effectivePattern
      )} | ${pnlState.side} ${formatPnl(pnlState.pnl)} | move ${pnlState.priceMovePct.toFixed(2)}% | ${pnlState.marketDirection} | ${pnlState.leverage}x | ${candles.length} bars</text>
    </svg>
  `;
}

function hexToLottieColor(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
    1
  ];
}

function lottieEase(state) {
  const [x1, y1, x2, y2] = state.spline.split(" ").map(Number);
  return {
    o: { x: [x1], y: [y1] },
    i: { x: [x2], y: [y2] }
  };
}

function buildCandleLottieLayer({ candle, index, totalFrames, candleFrames, staggerFrames, ease, centerX, originY, highY, lowY, bodyTop, bodyHeight, bodyWidth, strokeWidth }) {
  const startFrame = index * staggerFrames;
  const endFrame = startFrame + candleFrames;
  const color = hexToLottieColor(candle.color);

  return {
    ddd: 0,
    ind: index + 1,
    ty: 4,
    nm: `candle ${index + 1}`,
    sr: 1,
    ks: {
      o: {
        a: 1,
        k: [
          { t: startFrame, s: [0], e: [100], ...ease },
          { t: startFrame + Math.round(candleFrames * 0.5), s: [100] }
        ]
      },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [centerX, originY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: startFrame, s: [100, 0, 100], e: [100, 100, 100], ...ease },
          { t: endFrame, s: [100, 100, 100] }
        ]
      }
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "wick",
        it: [
          {
            ty: "sh",
            ks: {
              a: 0,
              k: {
                i: [
                  [0, 0],
                  [0, 0]
                ],
                o: [
                  [0, 0],
                  [0, 0]
                ],
                v: [
                  [0, highY - originY],
                  [0, lowY - originY]
                ],
                c: false
              }
            }
          },
          { ty: "st", c: { a: 0, k: [0.09, 0.09, 0.09, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: strokeWidth }, lc: 2, lj: 2 },
          { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
        ]
      },
      {
        ty: "gr",
        nm: "body",
        it: [
          {
            ty: "rc",
            p: { a: 0, k: [0, bodyTop + bodyHeight / 2 - originY] },
            s: { a: 0, k: [bodyWidth, bodyHeight] },
            r: { a: 0, k: 0 }
          },
          { ty: "fl", c: { a: 0, k: color }, o: { a: 0, k: 100 }, r: 1 },
          { ty: "st", c: { a: 0, k: [0.09, 0.09, 0.09, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: Math.max(1, strokeWidth * 0.82) }, lc: 2, lj: 2 },
          { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
        ]
      }
    ],
    ip: 0,
    op: totalFrames + candleFrames,
    st: 0,
    bm: 0
  };
}

function buildGraphLottie(state) {
  const candles = generatePlaygroundCandles(state);
  const customize = readCustomization();
  const candleBodyScale = clamp(numberOrDefault(customize.candleBodyScale, customizationDefaults.candleBodyScale), 0.75, 2.2);
  const width = 960;
  const height = 540;
  const fps = 60;
  const left = 42;
  const right = 918;
  const step = (right - left) / candles.length;
  const bodyWidth = clamp(step * 0.78, 5, step * 0.84);
  const minBodyHeight = 4;
  const totalFrames = Math.round(Math.max(state.duration, 0.4) * fps);
  const candleFrames = Math.max(8, Math.round(totalFrames * 0.38));
  const staggerFrames = Math.max(1, Math.round((totalFrames - candleFrames) / Math.max(candles.length - 1, 1)));
  const ease = lottieEase(state);

  const layers = candles.map((candle, index) => {
    const centerX = left + index * step + step / 2;
    const openY = chartY(candle.open);
    const closeY = chartY(candle.close);
    const highY = chartY(candle.high);
    const lowY = chartY(candle.low);
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyCenter = (bodyTop + bodyBottom) / 2;
    const bodyHeight = Math.max(minBodyHeight, (bodyBottom - bodyTop) * candleBodyScale);
    const adjustedTop = bodyCenter - bodyHeight / 2;
    const adjustedBottom = adjustedTop + bodyHeight;
    const wickHighY = Math.min(highY, adjustedTop);
    const wickLowY = Math.max(lowY, adjustedBottom);
    const originY = candle.direction === "down" ? Math.min(openY, closeY, wickHighY) : Math.max(openY, closeY, wickLowY);
    return buildCandleLottieLayer({
      candle,
      index,
      totalFrames,
      candleFrames,
      staggerFrames,
      ease,
      centerX,
      originY,
      highY: wickHighY,
      lowY: wickLowY,
      bodyTop: adjustedTop,
      bodyHeight,
      bodyWidth,
      strokeWidth: 1.2
    });
  });

  return {
    v: "5.12.2",
    fr: fps,
    ip: 0,
    op: totalFrames + candleFrames,
    w: width,
    h: height,
    nm: `hudi-${state.pattern}-graph-transparent`,
    ddd: 0,
    assets: [],
    layers
  };
}

async function exportGraphLottie() {
  const state = readGraphState();
  const lottie = buildGraphLottie(state);
  const filename = `${slugify(`hudi-${state.pattern}-${Math.round(state.barAmount)}-bars`)}.json`;
  await downloadBlob(filename, new Blob([JSON.stringify(lottie, null, 2)], { type: "application/json" }));
  setStatus("Transparent Lottie graph export started.");
}

function updateGraphOutputs(state) {
  const tradeGraphState = withTradeGraphInfluence(state, getCurrentTradeContext());
  graphControls.querySelector('[data-output="barAmount"]').textContent = String(Math.round(state.barAmount));
  graphControls.querySelector('[data-output="duration"]').textContent = `${state.duration.toFixed(1)}s`;
  graphControls.querySelector('[data-output="cardScale"]').textContent = `${state.cardScale.toFixed(2)}x`;
  graphControls.elements.patternLabel.value = `${tradeGraphState.side} ${formatPnl(tradeGraphState.pnl)} | ${tradeGraphState.entry}->${tradeGraphState.exit} (${tradeGraphState.priceMovePct.toFixed(2)}%) | ${tradeGraphState.effectivePattern}`;
  for (const name of ["x1", "y1", "x2", "y2"]) {
    graphControls.querySelector(`[data-output="${name}"]`).textContent = numberOrZero(graphControls.elements[name].value).toFixed(2);
  }
  curveOutput.textContent = state.curve;
}

function curveToPoint(x, y) {
  return {
    x: 22 + clamp(x, 0, 1) * 276,
    y: 158 - clamp(y, -0.8, 1.8) / 2.6 * 136
  };
}

function pointToCurve(x, y) {
  return {
    x: clamp((x - 22) / 276, 0, 1),
    y: clamp(((158 - y) / 136) * 2.6, -0.8, 1.8)
  };
}

function updateBezierEditor(state) {
  const p0 = { x: 22, y: 158 };
  const p3 = { x: 298, y: 22 };
  const p1 = curveToPoint(numberOrZero(graphControls.elements.x1.value), numberOrZero(graphControls.elements.y1.value));
  const p2 = curveToPoint(numberOrZero(graphControls.elements.x2.value), numberOrZero(graphControls.elements.y2.value));

  bezierEditor.querySelector("#bezier-path").setAttribute("d", `M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`);

  const handle1 = bezierEditor.querySelector('[data-handle="p1"]');
  const handle2 = bezierEditor.querySelector('[data-handle="p2"]');
  handle1.setAttribute("cx", p1.x);
  handle1.setAttribute("cy", p1.y);
  handle2.setAttribute("cx", p2.x);
  handle2.setAttribute("cy", p2.y);

  const startLine = bezierEditor.querySelector('[data-line="start"]');
  const endLine = bezierEditor.querySelector('[data-line="end"]');
  startLine.setAttribute("x2", p1.x);
  startLine.setAttribute("y2", p1.y);
  endLine.setAttribute("x2", p2.x);
  endLine.setAttribute("y2", p2.y);
}

function updateGraphPreview() {
  const state = readGraphState();
  updateGraphOutputs(state);
  updateBezierEditor(state);
  graphPreview.innerHTML = buildPlaygroundGraphSvg(state);
}

function updateGraphAndSharecard() {
  updateGraphPreview();
  updatePreview({ animated: false });
  saveAppState();
}

function replayGraphVariation() {
  randomizeGraphVariation();
  updateGraphPreview();
  updatePreview({ animated: true });
  saveAppState();
  setStatus("New market variation generated.");
}

function applyGraphToSharecard() {
  appliedGraphState = readGraphState();
  const pnlGraphState = withTradeGraphInfluence(appliedGraphState, readState());
  updateGraphOutputs(appliedGraphState);
  updatePreview({ animated: true });
  setStatus(`Replayed ${pnlGraphState.side} ${formatPnl(pnlGraphState.pnl)} as ${pnlGraphState.marketDirection} market.`);
}

function setCurveHandle(handleName, point) {
  const values = pointToCurve(point.x, point.y);
  const xField = handleName === "p1" ? "x1" : "x2";
  const yField = handleName === "p1" ? "y1" : "y2";
  graphControls.elements[xField].value = values.x.toFixed(2);
  graphControls.elements[yField].value = values.y.toFixed(2);
  updateGraphPreview();
  saveAppState();
}

function editorPointFromEvent(event) {
  const rect = bezierEditor.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 320, 22, 298),
    y: clamp(((event.clientY - rect.top) / rect.height) * 180, 1, 179)
  };
}

function initBezierDrag() {
  let activeHandle = null;

  bezierEditor.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-handle]");
    if (!handle) {
      return;
    }

    activeHandle = handle.dataset.handle;
    handle.setPointerCapture(event.pointerId);
    setCurveHandle(activeHandle, editorPointFromEvent(event));
  });

  bezierEditor.addEventListener("pointermove", (event) => {
    if (!activeHandle) {
      return;
    }

    setCurveHandle(activeHandle, editorPointFromEvent(event));
  });

  bezierEditor.addEventListener("pointerup", () => {
    activeHandle = null;
  });

  bezierEditor.addEventListener("pointercancel", () => {
    activeHandle = null;
  });
}

function readState() {
  syncSimulatedPrices();
  const values = Object.fromEntries(new FormData(form).entries());
  const customize = readCustomization(values);
  const entry = numberOrZero(values.entry);
  const exit = numberOrZero(values.exit);
  const override = String(values.pnlOverride || "").trim();
  const pnl = override === "" ? calculatePnl(entry, exit, values.side) : numberOrZero(override);
  return {
    ...values,
    displayToken: getDisplayToken(values.token),
    entry,
    exit,
    leverage: clamp(numberOrZero(values.leverage) || 1, 1, 20),
    pnl,
    preset: sizePresets[values.size],
    customize
  };
}

function setStatus(message) {
  statusNode.textContent = message;
  window.clearTimeout(setStatus.timeoutId);
  setStatus.timeoutId = window.setTimeout(() => {
    statusNode.textContent = "";
  }, 2800);
}

function getTone(pnl, scenario) {
  if (scenario === "huge-profit") {
    return {
      isProfit: true,
      accent: "#FF2BF8",
      washA: "#F4CBFB",
      washB: "#E1FDFF",
      background: "#F1FBFF"
    };
  }

  if (scenario === "huge-loss") {
    return {
      isProfit: false,
      accent: "#FF003D",
      washA: "#FFFDB8",
      washB: "#FF432E",
      background: "#FFF4E8"
    };
  }

  const isProfit = pnl >= 0;

  return {
    isProfit,
    accent: isProfit ? "#03FD91" : "#E833B5",
    washA: isProfit ? "#A5EDFF" : "#FBE8F5",
    washB: isProfit ? "#8EFFCE" : "#F097DE",
    background: "#FFFFFF"
  };
}

function getScenarioOrbDefaults(pnl, scenario) {
  if (scenario === "huge-profit" || scenario === "huge-win") {
    return {
      base: "#f8d6ff",
      sheen: "#dbffe9",
      shadow: "#f2c2ff"
    };
  }

  if (scenario === "huge-loss") {
    return {
      base: "#ff0000",
      sheen: "#fffdb8",
      shadow: "#ff432e"
    };
  }

  if (scenario === "slight-profit" || scenario === "big-profit") {
    return {
      base: "#66ffb0",
      sheen: "#f4cafb",
      shadow: "#f6ff7a"
    };
  }

  if (scenario === "slight-loss" || scenario === "big-loss") {
    return {
      base: "#ff33e4",
      sheen: "#ffffff",
      shadow: "#ffdd00"
    };
  }

  const isProfit = pnl >= 0;
  return {
    base: isProfit ? customizationDefaults.orbProfitColor : customizationDefaults.orbLossColor,
    sheen: customizationDefaults.orbSheenColor,
    shadow: isProfit ? "#3dffe8" : "#fd01ba"
  };
}

function getOrbTone(pnl, scenario, customize = customizationDefaults) {
  const scenarioDefaults = getScenarioOrbDefaults(pnl, scenario);
  const isProfit = pnl >= 0;
  const baseKey = isProfit ? "orbProfitColor" : "orbLossColor";
  const customBaseColor = colorOrDefault(customize[baseKey], customizationDefaults[baseKey]);
  const customSheenColor = colorOrDefault(customize.orbSheenColor, customizationDefaults.orbSheenColor);
  const customShadowColor = colorOrDefault(customize.orbShadowColor, customizationDefaults.orbShadowColor);
  const baseColor = customBaseColor.toLowerCase() === customizationDefaults[baseKey].toLowerCase()
    ? scenarioDefaults.base
    : customBaseColor;
  const sheenColor = customSheenColor.toLowerCase() === customizationDefaults.orbSheenColor.toLowerCase()
    ? scenarioDefaults.sheen
    : customSheenColor;
  const shadowColor = customShadowColor.toLowerCase() === customizationDefaults.orbShadowColor.toLowerCase()
    ? scenarioDefaults.shadow
    : customShadowColor;

  return {
    base: baseColor,
    sheen: sheenColor,
    shadowRgb: hexToRgbChannels(shadowColor),
    shadowOpacity: clamp(customize.orbShadowOpacity, 0, 1)
  };
}

function buildOrbSvg(state, { id = "cardOrb" } = {}) {
  if (state.preset.variant !== "orb") {
    return "";
  }

  const customize = state.customize || customizationDefaults;
  const orb = getOrbTone(state.pnl, state.scenario, customize);
  const { x, y, size } = getOrbCompositionLayout(customize);
  const scale = size / 100;

  return `
    <g class="card-orb" transform="translate(${x} ${y}) scale(${scale})">
      <g filter="url(#${id}Inner)">
        <rect width="100" height="100" rx="50" fill="${orb.base}" />
      </g>
      <rect width="100.4" height="100" rx="50" fill="url(#${id}Wash)" fill-opacity="${clamp(customize.orbSheenOpacity, 0, 1.25)}" />
      <ellipse cx="50.2262" cy="8.80278" rx="18.1716" ry="9.02935" fill="url(#${id}Highlight)" fill-opacity="${clamp(customize.orbHighlightOpacity, 0, 1.25)}" />
      <path d="M18.6016 26.8008C18.6016 14.0982 32.9285 3.80078 50.6016 3.80078C68.2747 3.80078 82.6016 14.0982 82.6016 26.8008C82.6016 39.5033 68.2747 49.8008 50.6016 49.8008C32.9285 49.8008 18.6016 39.5033 18.6016 26.8008Z" fill="url(#${id}Screen)" fill-opacity="${clamp(customize.orbGlassOpacity, 0, 1.25)}" style="mix-blend-mode:screen" />
      <circle cx="50.6031" cy="69.5992" r="24.4" fill="url(#${id}Bloom)" fill-opacity="${clamp(customize.orbBloomOpacity, 0, 1)}" />
    </g>
  `;
}

function buildOrbDefs(state, id = "cardOrb") {
  if (state.preset.variant !== "orb") {
    return "";
  }

  const customize = state.customize || customizationDefaults;
  const orb = getOrbTone(state.pnl, state.scenario, customize);
  const [shadowR, shadowG, shadowB] = orb.shadowRgb.map((channel) => channel / 255);

  return `
    <filter id="${id}Inner" x="0" y="-6.16253" width="100" height="106.163" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
      <feOffset dy="-6.16253" />
      <feGaussianBlur stdDeviation="32.1992" />
      <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
      <feColorMatrix type="matrix" values="0 0 0 0 ${shadowR} 0 0 0 0 ${shadowG} 0 0 0 0 ${shadowB} 0 0 0 ${orb.shadowOpacity} 0" />
      <feBlend mode="multiply" in2="shape" result="effect1_innerShadow_${id}" />
    </filter>
    <linearGradient id="${id}Wash" x1="50.2" y1="0" x2="50.2" y2="100" gradientUnits="userSpaceOnUse">
      <stop stop-color="${orb.sheen}" />
      <stop offset="1" stop-color="white" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="${id}Highlight" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50.2262 8.80278) rotate(-90) scale(9.02935 18.7474)">
      <stop stop-color="white" />
      <stop offset="1" stop-color="white" stop-opacity="0.14" />
    </radialGradient>
    <linearGradient id="${id}Screen" x1="50.6016" y1="49.8008" x2="50.2676" y2="3.80321" gradientUnits="userSpaceOnUse">
      <stop stop-color="white" stop-opacity="0" />
      <stop offset="1" stop-color="white" />
    </linearGradient>
    <radialGradient id="${id}Bloom" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50.6031 69.5992) rotate(90) scale(24.4)">
      <stop stop-color="white" />
      <stop offset="1" stop-color="white" stop-opacity="0" />
    </radialGradient>
  `;
}

function buildBigLossHudiSvg(state) {
  if (!usesBigLossHudi(state)) {
    return "";
  }

  const customize = state.customize || customizationDefaults;
  const baseWidth = 560;
  const baseHeight = 862;
  const width = baseWidth * customize.hudiScale;
  const height = baseHeight * customize.hudiScale;
  const centerX = 635 + baseWidth / 2 + customize.hudiX;
  const centerY = 400 + customize.hudiY;

  return `
    <image
      class="hudi-character hudi-character-big-loss"
      href="${getBigLossHudiHref()}"
      x="${centerX - width / 2}"
      y="${centerY - height / 2}"
      width="${width}"
      height="${height}"
      preserveAspectRatio="xMidYMid meet"
    />`;
}

function buildBigProfitHudiSvg(state) {
  if (!usesBigProfitHudi(state)) {
    return "";
  }

  const customize = state.customize || customizationDefaults;
  const baseWidth = 848;
  const baseHeight = 674;
  const width = baseWidth * customize.hudiScale;
  const height = baseHeight * customize.hudiScale;
  const centerX = 845 + customize.hudiX;
  const centerY = 440 + customize.hudiY;

  return `
    <image
      class="hudi-character hudi-character-big-profit"
      href="${getBigProfitHudiHref()}"
      x="${centerX - width / 2}"
      y="${centerY - height / 2}"
      width="${width}"
      height="${height}"
      preserveAspectRatio="xMidYMid meet"
    />`;
}

function buildHugeProfitHudiSvg(state) {
  if (!usesHugeProfitHudi(state)) {
    return "";
  }

  const customize = state.customize || customizationDefaults;
  const baseWidth = 926.446;
  const baseHeight = 1157.64;
  const pivotX = 985.239;
  const pivotY = 400.477;
  const hudiTransform = [
    `translate(${customize.hudiX} ${customize.hudiY})`,
    `translate(${pivotX} ${pivotY})`,
    `scale(${customize.hudiScale})`,
    `translate(${-pivotX} ${-pivotY})`,
    "matrix(-0.996302 0.0859151 0.0859151 0.996302 1397.02 -216)"
  ].join(" ");

  return `
    <g class="hudi-character-placement hudi-character-huge-profit hudi-character-mirrored" transform="${hudiTransform}">
      <g class="hudi-character hudi-character-huge-profit-art">
        <image
          href="${getHugeProfitHudiHref()}"
          x="0"
          y="0"
          width="${baseWidth}"
          height="${baseHeight}"
          preserveAspectRatio="none"
        />
      </g>
    </g>`;
}

function buildHugeLossHudiSvg(state) {
  if (!usesHugeLossHudi(state)) {
    return "";
  }

  const customize = state.customize || customizationDefaults;
  const baseWidth = 652;
  const baseHeight = 191;
  const width = baseWidth * customize.hudiScale;
  const height = baseHeight * customize.hudiScale;
  const centerX = 800 + customize.hudiX;
  const centerY = 465 + customize.hudiY;

  return `
    <image
      class="hudi-character hudi-character-huge-loss"
      href="${getHugeLossHudiHref()}"
      x="${centerX - width / 2}"
      y="${centerY - height / 2}"
      width="${width}"
      height="${height}"
      preserveAspectRatio="xMidYMid meet"
    />`;
}

function buildShareText(state) {
  const side = `${state.side.toUpperCase()} ${state.leverage}X`;
  return `${state.displayToken || getDisplayToken(state.token)} ${side} closed ${formatPnl(state.pnl)} | Entry ${formatPrice(
    state.entry
  )} -> Exit ${formatPrice(state.exit)} | ${state.hudi}`;
}

function getTradeHoloTier(scenario) {
  if (scenario.startsWith("huge-")) return "vstar";
  if (scenario.startsWith("big-")) return "vmax";
  return "trainer-gallery";
}

function getTradeHoloTheme(tier, isLoss) {
  const themes = {
    vstar: {
      profit: {
        baseOpacity: 0.86,
        surfaceOpacity: 0.72,
        lineOpacity: 0.56,
        crossOpacity: 0.28,
        glitterOpacity: 0.5,
        shineOpacity: 0.72,
        sweepOpacity: 0.76,
        spotOpacity: 0.78,
        rimOpacity: 0.7,
        baseBlend: "color-dodge",
        surfaceBlend: "screen",
        lineBlend: "hard-light",
        prism: [
          [null, "#00E5FF", 0.82],
          ["0.18", "#B9FFF4", 0.72],
          ["0.36", "#A77DFF", 0.78],
          ["0.55", "#FF2BF8", 0.76],
          ["0.74", "#FFF36F", 0.58],
          ["1", "#FFFFFF", 0.18]
        ],
        aura: ["#FFF8A8", "#FFE7F3", "#B9FFF4", "#9A69FF"],
        surface: ["#FFFFFF", "#42F4FF", "#FFFFFF", "#CC83FF", "#FF49DA", "#FFFFFF"],
        shine: ["#F9DFFF", "#FEFFED", "#F6FFF0"],
        spot: ["#FFF8A8", "#FFFFFF", "#FF8DF2", "#00E5FF", "#FFFFFF"],
        rim: ["#FFF8A8", "#83FFF2", "#FFFFFF", "#FF62EA", "#A77DFF"]
      },
      loss: {
        baseOpacity: 0.88,
        surfaceOpacity: 0.76,
        lineOpacity: 0.6,
        crossOpacity: 0.32,
        glitterOpacity: 0.58,
        shineOpacity: 0.76,
        sweepOpacity: 0.78,
        spotOpacity: 0.8,
        rimOpacity: 0.74,
        baseBlend: "color-dodge",
        surfaceBlend: "screen",
        lineBlend: "hard-light",
        prism: [
          [null, "#FF003D", 0.88],
          ["0.18", "#FFF36F", 0.76],
          ["0.36", "#FF7A00", 0.82],
          ["0.54", "#FD01BA", 0.78],
          ["0.72", "#7E00FF", 0.62],
          ["1", "#FFFFFF", 0.16]
        ],
        aura: ["#FFFDB8", "#FF7A00", "#FF003D", "#FD01BA"],
        surface: ["#FFFFFF", "#FFFDB8", "#FF432E", "#FD01BA", "#FF7A00", "#FFFFFF"],
        shine: ["#FFFDB8", "#FF432E", "#FD01BA"],
        spot: ["#FFFDB8", "#FFFFFF", "#FF432E", "#FD01BA", "#FFFFFF"],
        rim: ["#FFFDB8", "#FF432E", "#FFFFFF", "#FD01BA", "#FF003D"]
      }
    },
    vmax: {
      profit: {
        baseOpacity: 0.66,
        surfaceOpacity: 0.56,
        lineOpacity: 0.46,
        crossOpacity: 0.18,
        glitterOpacity: 0.26,
        shineOpacity: 0.42,
        sweepOpacity: 0.5,
        spotOpacity: 0.62,
        rimOpacity: 0.36,
        baseBlend: "lighten",
        surfaceBlend: "hard-light",
        lineBlend: "luminosity",
        prism: [
          [null, "#0DBDE9", 0.68],
          ["0.22", "#21E985", 0.58],
          ["0.44", "#EEDF10", 0.42],
          ["0.66", "#C929F1", 0.54],
          ["0.84", "#56F3FF", 0.48],
          ["1", "#FFFFFF", 0.1]
        ],
        aura: ["#A8FFF4", "#6BFF97", "#C7B7FF", "#FFFFFF"],
        surface: ["#FFFFFF", "#22F6FF", "#B8FFE4", "#C929F1", "#FFFFFF", "#FFFFFF"],
        shine: ["#E8FBFF", "#F9FFDD", "#E9FFF7"],
        spot: ["#FFFFFF", "#BAFFE7", "#9BB5FF", "#FFFFFF", "#FFFFFF"],
        rim: ["#A8FFF4", "#FFFFFF", "#6BFF97", "#C929F1", "#FFFFFF"]
      },
      loss: {
        baseOpacity: 0.68,
        surfaceOpacity: 0.58,
        lineOpacity: 0.48,
        crossOpacity: 0.2,
        glitterOpacity: 0.3,
        shineOpacity: 0.46,
        sweepOpacity: 0.54,
        spotOpacity: 0.64,
        rimOpacity: 0.4,
        baseBlend: "lighten",
        surfaceBlend: "hard-light",
        lineBlend: "luminosity",
        prism: [
          [null, "#F80E35", 0.7],
          ["0.22", "#EEDF10", 0.48],
          ["0.44", "#C929F1", 0.62],
          ["0.66", "#FF92E2", 0.58],
          ["0.84", "#FF432E", 0.48],
          ["1", "#FFFFFF", 0.1]
        ],
        aura: ["#FFF3A2", "#FF92E2", "#FF432E", "#FFFFFF"],
        surface: ["#FFFFFF", "#FFF3A2", "#FF92E2", "#F80E35", "#C929F1", "#FFFFFF"],
        shine: ["#FFF7DA", "#FFD0F1", "#FFECE6"],
        spot: ["#FFFFFF", "#FFF3A2", "#FF92E2", "#FFFFFF", "#FFFFFF"],
        rim: ["#FFF3A2", "#FF92E2", "#FFFFFF", "#F80E35", "#C929F1"]
      }
    },
    "trainer-gallery": {
      profit: {
        baseOpacity: 0.38,
        surfaceOpacity: 0.34,
        lineOpacity: 0.32,
        crossOpacity: 0.1,
        glitterOpacity: 0.1,
        shineOpacity: 0.22,
        sweepOpacity: 0.32,
        spotOpacity: 0.44,
        rimOpacity: 0.28,
        baseBlend: "color-dodge",
        surfaceBlend: "soft-light",
        lineBlend: "color-dodge",
        prism: [
          [null, "#C929F1", 0.48],
          ["0.18", "#F80E35", 0.38],
          ["0.34", "#EEDF10", 0.38],
          ["0.5", "#21E985", 0.42],
          ["0.66", "#0DBDE9", 0.36],
          ["0.84", "#839BFF", 0.42],
          ["1", "#C929F1", 0.42]
        ],
        aura: ["#FFFFFF", "#BAFFE7", "#EBD7FF", "#FFFFFF"],
        surface: ["#FFFFFF", "#C929F1", "#EEDF10", "#21E985", "#0DBDE9", "#FFFFFF"],
        shine: ["#FFFFFF", "#FEFFED", "#F6FFF0"],
        spot: ["#FFFFFF", "#D7FFF0", "#7A4B82", "#222222", "#FFFFFF"],
        rim: ["#FFFFFF", "#21E985", "#FFFFFF", "#C929F1", "#0DBDE9"]
      },
      loss: {
        baseOpacity: 0.4,
        surfaceOpacity: 0.36,
        lineOpacity: 0.34,
        crossOpacity: 0.12,
        glitterOpacity: 0.12,
        shineOpacity: 0.24,
        sweepOpacity: 0.34,
        spotOpacity: 0.46,
        rimOpacity: 0.3,
        baseBlend: "color-dodge",
        surfaceBlend: "soft-light",
        lineBlend: "color-dodge",
        prism: [
          [null, "#C929F1", 0.5],
          ["0.18", "#F80E35", 0.42],
          ["0.34", "#EEDF10", 0.38],
          ["0.5", "#FF92E2", 0.42],
          ["0.66", "#839BFF", 0.36],
          ["0.84", "#FD01BA", 0.42],
          ["1", "#C929F1", 0.42]
        ],
        aura: ["#FFFFFF", "#FFD1F2", "#FFF3A2", "#FFFFFF"],
        surface: ["#FFFFFF", "#FD01BA", "#EEDF10", "#FF92E2", "#F80E35", "#FFFFFF"],
        shine: ["#FFFFFF", "#FFF7DA", "#FFDFF6"],
        spot: ["#FFFFFF", "#FFD1F2", "#7A335A", "#222222", "#FFFFFF"],
        rim: ["#FFFFFF", "#FF92E2", "#FFFFFF", "#FD01BA", "#F80E35"]
      }
    }
  };

  return themes[tier]?.[isLoss ? "loss" : "profit"] || themes["trainer-gallery"].profit;
}

function renderGradientStops(stops) {
  return stops
    .map(([offset, color, opacity]) => `<stop${offset === null ? "" : ` offset="${offset}"`} stop-color="${color}"${opacity === undefined ? "" : ` stop-opacity="${opacity}"`} />`)
    .join("");
}

function buildTradeHoloDefs(tier, isLoss) {
  const theme = getTradeHoloTheme(tier, isLoss);
  const linesAngle = tier === "trainer-gallery" ? -22 : tier === "vmax" ? 133 : 133;
  const grainSeed = tier === "vstar" ? (isLoss ? 19 : 11) : tier === "vmax" ? 27 : 35;
  const lineWidth = tier === "trainer-gallery" ? 92 : tier === "vmax" ? 68 : 76;
  const shimmerWidth = tier === "trainer-gallery" ? 1.8 : tier === "vmax" ? 2.6 : 3.4;

  return `
        <linearGradient id="tradeHoloPrism" x1="-128" y1="650" x2="1215" y2="28" gradientUnits="userSpaceOnUse">
          ${renderGradientStops(theme.prism)}
        </linearGradient>
        <radialGradient id="tradeHoloAura" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(470 460) rotate(-14) scale(740 330)">
          <stop stop-color="${theme.aura[0]}" stop-opacity="0.76" />
          <stop offset="0.24" stop-color="${theme.aura[1]}" stop-opacity="0.46" />
          <stop offset="0.52" stop-color="${theme.aura[2]}" stop-opacity="0.32" />
          <stop offset="1" stop-color="${theme.aura[3]}" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="tradeHoloSurface" x1="70" y1="826" x2="1168" y2="-126" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.surface[0]}" stop-opacity="0" />
          <stop offset="0.18" stop-color="${theme.surface[1]}" stop-opacity="0.6" />
          <stop offset="0.36" stop-color="${theme.surface[2]}" stop-opacity="0.46" />
          <stop offset="0.55" stop-color="${theme.surface[3]}" stop-opacity="0.58" />
          <stop offset="0.74" stop-color="${theme.surface[4]}" stop-opacity="0.48" />
          <stop offset="1" stop-color="${theme.surface[5]}" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="tradeHoloStreak" x1="-88" y1="924" x2="1040" y2="-118" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.surface[1]}" stop-opacity="0" />
          <stop offset="0.2" stop-color="#FFFFFF" stop-opacity="0.88" />
          <stop offset="0.34" stop-color="${theme.shine[1]}" stop-opacity="0.7" />
          <stop offset="0.5" stop-color="${theme.surface[3]}" stop-opacity="0.66" />
          <stop offset="0.67" stop-color="${theme.surface[4]}" stop-opacity="0.52" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="tradeHoloShineGradient" x1="671.277" y1="-86.6909" x2="681.906" y2="1024.02" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.shine[0]}" stop-opacity="0" />
          <stop offset="0.18" stop-color="${theme.shine[0]}" stop-opacity="0.42" />
          <stop offset="0.322115" stop-color="${theme.shine[1]}" stop-opacity="0.62" />
          <stop offset="0.66" stop-color="${theme.shine[2]}" stop-opacity="0.34" />
          <stop offset="0.807692" stop-color="${theme.shine[2]}" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="tradeHoloShineMaskGradient" x1="0" y1="0" x2="1" y2="0">
          <stop stop-color="white" stop-opacity="0" />
          <stop offset="0.2" stop-color="white" stop-opacity="0.45" />
          <stop offset="0.54" stop-color="white" stop-opacity="0.7" />
          <stop offset="0.82" stop-color="white" stop-opacity="0.35" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
        <mask id="tradeHoloShineSoftMask" maskUnits="userSpaceOnUse">
          <rect x="548.931" y="-179" width="270.371" height="1203" transform="rotate(34.0127 548.931 -179)" fill="url(#tradeHoloShineMaskGradient)" />
        </mask>
        <radialGradient id="tradeHoloSpot" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(438 475) rotate(-4) scale(480 185)">
          <stop stop-color="${theme.spot[0]}" stop-opacity="0.95" />
          <stop offset="0.2" stop-color="${theme.spot[1]}" stop-opacity="0.62" />
          <stop offset="0.44" stop-color="${theme.spot[2]}" stop-opacity="0.42" />
          <stop offset="0.72" stop-color="${theme.spot[3]}" stop-opacity="0.24" />
          <stop offset="1" stop-color="${theme.spot[4]}" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="tradeHoloRim" x1="0" y1="800" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.rim[0]}" />
          <stop offset="0.24" stop-color="${theme.rim[1]}" />
          <stop offset="0.5" stop-color="${theme.rim[2]}" />
          <stop offset="0.75" stop-color="${theme.rim[3]}" />
          <stop offset="1" stop-color="${theme.rim[4]}" />
        </linearGradient>
        <pattern id="tradeHoloLines" patternUnits="userSpaceOnUse" width="${lineWidth}" height="${lineWidth}" patternTransform="rotate(${linesAngle} 600 400)">
          <rect width="${lineWidth}" height="${lineWidth}" fill="transparent" />
          <rect x="0" y="${lineWidth * 0.08}" width="${lineWidth}" height="${shimmerWidth}" fill="#FFFFFF" opacity="0.46" />
          <rect x="0" y="${lineWidth * 0.3}" width="${lineWidth}" height="${Math.max(1.2, shimmerWidth * 0.65)}" fill="${theme.surface[1]}" opacity="0.34" />
          <rect x="0" y="${lineWidth * 0.56}" width="${lineWidth}" height="${Math.max(1.4, shimmerWidth * 0.85)}" fill="${theme.surface[3]}" opacity="0.3" />
          <rect x="0" y="${lineWidth * 0.8}" width="${lineWidth}" height="${Math.max(1, shimmerWidth * 0.48)}" fill="${theme.shine[1]}" opacity="0.26" />
        </pattern>
        <pattern id="tradeHoloCrosshatch" patternUnits="userSpaceOnUse" width="18" height="18" patternTransform="rotate(31 600 400)">
          <rect width="18" height="18" fill="transparent" />
          <path d="M0 1H18M0 10H18" stroke="#FFFFFF" stroke-width="0.7" opacity="0.2" />
          <path d="M1 0V18M10 0V18" stroke="${theme.shine[1]}" stroke-width="0.55" opacity="0.16" />
        </pattern>
        <pattern id="tradeHoloGlitter" patternUnits="userSpaceOnUse" width="34" height="34" patternTransform="rotate(18 600 400)">
          <rect width="34" height="34" fill="transparent" />
          <circle cx="5" cy="6" r="1.15" fill="#FFFFFF" opacity="0.65" />
          <circle cx="22" cy="11" r="0.9" fill="${theme.shine[1]}" opacity="0.56" />
          <circle cx="15" cy="27" r="1.05" fill="${theme.surface[3]}" opacity="0.45" />
          <path d="M29 23L31 25L29 27L27 25Z" fill="#FFFFFF" opacity="0.48" />
        </pattern>
        <filter id="tradeHoloBlur" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
          <feGaussianBlur stdDeviation="${tier === "trainer-gallery" ? 5 : tier === "vmax" ? 8 : 10}" />
        </filter>
        <filter id="tradeHoloShineFilter" x="-153.2" y="-208.2" width="955.445" height="1206.82" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 0.98 0 0 0 0 0.86 0 0 0 1 0" />
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow_tradeHoloShine" />
          <feGaussianBlur stdDeviation="${tier === "trainer-gallery" ? 7 : 14.6}" result="effect2_foregroundBlur_tradeHoloShine" />
        </filter>
        <filter id="tradeHoloFoilGrain" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="${tier === "trainer-gallery" ? "0.48 0.92" : "0.78 1.18"}" numOctaves="4" seed="${grainSeed}" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="1.25 0 0 0 0 0 1.25 0 0 0 0 0 1.25 0 0 0 0 0 ${tier === "trainer-gallery" ? "0.2" : "0.42"} 0" />
        </filter>`;
}

function buildTradeHoloSvg(width, height, tier, isLoss, layer = "surface") {
  const theme = getTradeHoloTheme(tier, isLoss);
  const tierClass = `holo-tier-${tier}`;
  const shineOpacity = theme.shineOpacity * (tier === "vstar" ? 0.24 : tier === "vmax" ? 0.2 : 0.16);
  const stripeOpacity = tier === "trainer-gallery" ? 0.16 : tier === "vmax" ? 0.34 : 0.58;
  const baseBlur = tier === "trainer-gallery" ? 0.24 : tier === "vmax" ? 0.4 : 0.52;
  const bleed = Math.max(width, height) * 0.42;
  const bleedX = -bleed;
  const bleedY = -bleed;
  const bleedWidth = width + bleed * 2;
  const bleedHeight = height + bleed * 2;

  if (layer === "base") {
    return `
        <g class="holo-card-effect holo-card-base ${tierClass}" data-holo-tier="${tier}" pointer-events="none">
          <rect x="${bleedX}" y="${bleedY}" width="${bleedWidth}" height="${bleedHeight}" fill="url(#tradeHoloPrism)" opacity="${theme.baseOpacity}" style="mix-blend-mode:${theme.baseBlend}" />
          <rect x="${bleedX}" y="${bleedY}" width="${bleedWidth}" height="${bleedHeight}" fill="url(#tradeHoloAura)" opacity="${baseBlur}" filter="url(#tradeHoloBlur)" style="mix-blend-mode:screen" />
          <rect class="holo-grain" x="${bleedX}" y="${bleedY}" width="${bleedWidth}" height="${bleedHeight}" filter="url(#tradeHoloFoilGrain)" opacity="${tier === "trainer-gallery" ? 0.18 : 0.36}" style="mix-blend-mode:soft-light" />
          <rect class="holo-crosshatch" x="${bleedX}" y="${bleedY}" width="${bleedWidth}" height="${bleedHeight}" fill="url(#tradeHoloCrosshatch)" opacity="${theme.crossOpacity}" style="mix-blend-mode:overlay" />
        </g>`;
  }

  return `
        <g class="holo-card-effect holo-card-surface ${tierClass}" data-holo-tier="${tier}" pointer-events="none">
          <rect x="${bleedX}" y="${bleedY}" width="${bleedWidth}" height="${bleedHeight}" fill="url(#tradeHoloSurface)" opacity="${theme.surfaceOpacity}" style="mix-blend-mode:${theme.surfaceBlend}" />
          <rect class="holo-lines" x="${bleedX}" y="${bleedY}" width="${bleedWidth}" height="${bleedHeight}" fill="url(#tradeHoloLines)" opacity="${theme.lineOpacity}" style="mix-blend-mode:${theme.lineBlend}" />
          <rect class="holo-glitter" x="${bleedX}" y="${bleedY}" width="${bleedWidth}" height="${bleedHeight}" fill="url(#tradeHoloGlitter)" opacity="${theme.glitterOpacity}" style="mix-blend-mode:screen" />
          <ellipse
            class="holo-rectangle-shine"
            cx="${width * 0.52}"
            cy="${height * 0.48}"
            rx="${width * 0.72}"
            ry="${height * 0.16}"
            transform="rotate(-36 ${width * 0.52} ${height * 0.48})"
            fill="url(#tradeHoloStreak)"
            opacity="${shineOpacity}"
            filter="url(#tradeHoloBlur)"
            style="mix-blend-mode:screen"
          />
          <ellipse
            class="holo-sweep"
            cx="${width * 0.58}"
            cy="${height * 0.42}"
            rx="${bleedWidth * 0.58}"
            ry="${height * 0.18}"
            transform="rotate(-18 ${width * 0.58} ${height * 0.42})"
            fill="url(#tradeHoloStreak)"
            opacity="${theme.sweepOpacity * 0.38}"
            filter="url(#tradeHoloBlur)"
            style="mix-blend-mode:screen"
          />
          <ellipse class="holo-hotspot" cx="438" cy="475" rx="470" ry="180" fill="url(#tradeHoloSpot)" opacity="${theme.spotOpacity}" style="mix-blend-mode:${tier === "trainer-gallery" ? "soft-light" : "screen"}" />
          <rect class="holo-rim" x="8" y="8" width="${width - 16}" height="${height - 16}" rx="14" fill="none" stroke="url(#tradeHoloRim)" stroke-width="${tier === "trainer-gallery" ? 2.5 : 4}" opacity="${theme.rimOpacity}" style="mix-blend-mode:screen" />
          <rect x="${bleedX}" y="${bleedY}" width="${bleedWidth}" height="${bleedHeight}" fill="url(#tradeHoloLines)" opacity="${stripeOpacity}" style="mix-blend-mode:overlay" />
        </g>`;
}

function buildCardSvg(state, options = {}) {
  const tone = getTone(state.pnl, state.scenario);
  const customize = state.customize || customizationDefaults;
  const { width, height } = state.preset;
  const embeddedFontCss = options.embeddedFontCss || "";
  const isHugeProfit = state.scenario === "huge-profit";
  const isHugeLoss = state.scenario === "huge-loss";
  const isLossScenario = state.scenario.endsWith("loss");
  const holoTier = getTradeHoloTier(state.scenario);
  const isHoloScenario = Boolean(holoTier);
  const tokenText = state.displayToken || getDisplayToken(state.token);
  const sideText = `${state.side.toLowerCase()} ${state.leverage}x`;
  const pnlText = formatPnl(state.pnl);
  const entryText = formatHudiPrice(state.entry);
  const exitText = formatHudiPrice(state.exit);
  const metaText = `entry|${entryText}|exit|${exitText}`;
  const textBox = getTextBoxLayout({ token: tokenText, side: sideText, pnl: pnlText, meta: metaText, preset: state.preset, customize });
  const token = escapeXml(tokenText);
  const side = escapeXml(sideText);
  const pnl = escapeXml(pnlText);
  const meta = escapeXml(metaText);
  const backgroundColor = isDefaultCustomizationColor(customize, "backgroundColor") ? tone.background : customize.backgroundColor;
  const washOpacity = isHoloScenario && isDefaultCustomizationNumber(customize, "washOpacity") ? 1 : customize.washOpacity;
  const pnlColor = isDefaultCustomizationColor(customize, "pnlColor") ? tone.accent : customize.pnlColor;
  const pnlFill = isHugeProfit && isDefaultCustomizationColor(customize, "pnlColor") ? "url(#hugeProfitPnlFill)" : pnlColor;
  const textColor = isHugeProfit && isDefaultCustomizationColor(customize, "textColor") ? "#000000" : customize.textColor;
  const tokenColor = isHugeProfit && isDefaultCustomizationColor(customize, "tokenColor") ? "#232323" : customize.tokenColor;
  const pnlStrokeColor = isHugeProfit && isDefaultCustomizationColor(customize, "pnlStrokeColor") ? "#000000" : customize.pnlStrokeColor;
  const characterColor = isDefaultCustomizationColor(customize, "hudiColor") ? tone.accent : customize.hudiColor;
  const hudiTransform = `translate(${customize.hudiX} ${customize.hudiY}) translate(1015 420) scale(${customize.hudiScale}) translate(-1015 -420)`;
  const svgClass = options.animated ? "sharecard-svg is-animated" : "sharecard-svg";
  const backgroundBleed = Math.max(width, height) * 0.42;
  const backgroundX = -backgroundBleed;
  const backgroundY = -backgroundBleed;
  const backgroundWidth = width + backgroundBleed * 2;
  const backgroundHeight = height + backgroundBleed * 2;
  const useBigProfitHudi = usesBigProfitHudi(state);
  const useHugeProfitHudi = usesHugeProfitHudi(state);
  const useBigLossHudi = usesBigLossHudi(state);
  const useHugeLossHudi = usesHugeLossHudi(state);
  const useSpecialHudi = useBigProfitHudi || useHugeProfitHudi || useBigLossHudi || useHugeLossHudi;

  return `
    <svg class="${svgClass}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="PNL sharecard preview">
      <defs>
        ${embeddedFontCss ? `<style type="text/css"><![CDATA[${embeddedFontCss}]]></style>` : ""}
        ${
          isHugeProfit
            ? `
        <radialGradient id="hudiWash" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(600 -520.5) rotate(90) scale(1552.5 2328.75)">
          <stop stop-color="${tone.washA}" />
          <stop offset="0.774038" stop-color="white" />
          <stop offset="1" stop-color="${tone.washB}" />
        </radialGradient>`
            : isHugeLoss
            ? `
        <radialGradient id="hudiWash" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 -315) rotate(90) scale(1320 2050)">
          <stop stop-color="${tone.washA}" />
          <stop offset="0.42" stop-color="#FFF4E8" />
          <stop offset="0.74" stop-color="#FFD7BD" />
          <stop offset="1" stop-color="${tone.washB}" />
        </radialGradient>`
            : `
        <linearGradient id="hudiWash" x1="600" y1="0" x2="600" y2="${height}" gradientUnits="userSpaceOnUse">
          <stop stop-color="${tone.washA}" />
          <stop offset="1" stop-color="${tone.washB}" />
        </linearGradient>`
        }
        ${
          isHugeProfit
            ? `
        <radialGradient id="hugeProfitPnlFill" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(374.733 409.564) scale(494.433 92.2737)">
          <stop stop-color="white" />
          <stop offset="0.269263" stop-color="#F1FBFF" />
          <stop offset="0.520095" stop-color="#F0FFFC" />
          <stop offset="1" stop-color="#FF2BF8" />
        </radialGradient>`
            : ""
        }
        ${
          false && isHugeProfit
            ? `
        <linearGradient id="hugeProfitHoloPrism" x1="-92" y1="590" x2="1207" y2="106" gradientUnits="userSpaceOnUse">
          <stop stop-color="#00E5FF" stop-opacity="0.92" />
          <stop offset="0.18" stop-color="#B9FFF4" stop-opacity="0.86" />
          <stop offset="0.35" stop-color="#A77DFF" stop-opacity="0.88" />
          <stop offset="0.55" stop-color="#E245FF" stop-opacity="0.86" />
          <stop offset="0.74" stop-color="#FF56B8" stop-opacity="0.76" />
          <stop offset="0.9" stop-color="#FFE56B" stop-opacity="0.58" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.24" />
        </linearGradient>
        <radialGradient id="hugeProfitHoloAura" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 490) rotate(-15) scale(735 310)">
          <stop stop-color="#FFF3A2" stop-opacity="0.78" />
          <stop offset="0.2" stop-color="#FFE7F3" stop-opacity="0.58" />
          <stop offset="0.44" stop-color="#B9FFF4" stop-opacity="0.48" />
          <stop offset="0.68" stop-color="#9A69FF" stop-opacity="0.34" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="hugeProfitHoloSurface" x1="98" y1="764" x2="1144" y2="-80" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFFFFF" stop-opacity="0" />
          <stop offset="0.2" stop-color="#42F4FF" stop-opacity="0.56" />
          <stop offset="0.38" stop-color="#FFFFFF" stop-opacity="0.4" />
          <stop offset="0.56" stop-color="#CC83FF" stop-opacity="0.7" />
          <stop offset="0.74" stop-color="#FF49DA" stop-opacity="0.62" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="hugeProfitHoloStreak" x1="-24" y1="862" x2="1004" y2="-92" gradientUnits="userSpaceOnUse">
          <stop stop-color="#00F5FF" stop-opacity="0" />
          <stop offset="0.22" stop-color="#FFFFFF" stop-opacity="0.88" />
          <stop offset="0.34" stop-color="#FFF36F" stop-opacity="0.64" />
          <stop offset="0.49" stop-color="#FF79E7" stop-opacity="0.72" />
          <stop offset="0.66" stop-color="#86FFF1" stop-opacity="0.58" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="hugeProfitShineGradient" x1="671.277" y1="-86.6909" x2="681.906" y2="1024.02" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F9DFFF" />
          <stop offset="0.322115" stop-color="#FEFFED" />
          <stop offset="0.807692" stop-color="#F6FFF0" />
        </linearGradient>
        <radialGradient id="hugeProfitHoloSpot" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(430 533) rotate(-3) scale(430 150)">
          <stop stop-color="#FFF8A8" stop-opacity="0.9" />
          <stop offset="0.23" stop-color="#FFFFFF" stop-opacity="0.7" />
          <stop offset="0.44" stop-color="#FF8DF2" stop-opacity="0.42" />
          <stop offset="0.7" stop-color="#00E5FF" stop-opacity="0.28" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="hugeProfitHoloRim" x1="0" y1="800" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFF8A8" />
          <stop offset="0.24" stop-color="#83FFF2" />
          <stop offset="0.52" stop-color="#FFFFFF" />
          <stop offset="0.76" stop-color="#FF62EA" />
          <stop offset="1" stop-color="#A77DFF" />
        </linearGradient>
        <pattern id="hugeProfitHoloLines" patternUnits="userSpaceOnUse" width="76" height="76" patternTransform="rotate(-18 600 400)">
          <rect width="76" height="76" fill="transparent" />
          <rect x="0" y="6" width="76" height="4" fill="#FFFFFF" opacity="0.48" />
          <rect x="0" y="23" width="76" height="2" fill="#00F5FF" opacity="0.32" />
          <rect x="0" y="45" width="76" height="3" fill="#FF2BF8" opacity="0.28" />
          <rect x="0" y="66" width="76" height="1.5" fill="#FFF36F" opacity="0.26" />
        </pattern>
        <pattern id="hugeProfitHoloCrosshatch" patternUnits="userSpaceOnUse" width="18" height="18" patternTransform="rotate(27 600 400)">
          <rect width="18" height="18" fill="transparent" />
          <path d="M0 1H18M0 10H18" stroke="#FFFFFF" stroke-width="0.7" opacity="0.22" />
          <path d="M1 0V18M10 0V18" stroke="#72F7FF" stroke-width="0.55" opacity="0.16" />
        </pattern>
        <filter id="hugeProfitHoloBlur" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="hugeProfitShineFilter" x="-153.2" y="-208.2" width="955.445" height="1206.82" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow_hugeProfitShine" />
          <feGaussianBlur stdDeviation="14.6" result="effect2_foregroundBlur_hugeProfitShine" />
        </filter>
        <filter id="hugeProfitFoilGrain" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.82 1.18" numOctaves="4" seed="11" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="1.25 0 0 0 0 0 1.25 0 0 0 0 0 1.25 0 0 0 0 0 0.42 0" />
        </filter>`
            : ""
        }
        ${
          false && isHugeLoss
            ? `
        <linearGradient id="hugeLossHoloPrism" x1="-130" y1="642" x2="1218" y2="32" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FF003D" stop-opacity="0.9" />
          <stop offset="0.18" stop-color="#FFF36F" stop-opacity="0.82" />
          <stop offset="0.34" stop-color="#FF7A00" stop-opacity="0.86" />
          <stop offset="0.52" stop-color="#FD01BA" stop-opacity="0.82" />
          <stop offset="0.7" stop-color="#7E00FF" stop-opacity="0.68" />
          <stop offset="0.86" stop-color="#FFFDB8" stop-opacity="0.58" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.18" />
        </linearGradient>
        <radialGradient id="hugeLossHoloAura" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(390 450) rotate(-12) scale(700 340)">
          <stop stop-color="#FFFDB8" stop-opacity="0.82" />
          <stop offset="0.22" stop-color="#FF7A00" stop-opacity="0.48" />
          <stop offset="0.5" stop-color="#FF003D" stop-opacity="0.42" />
          <stop offset="0.74" stop-color="#FD01BA" stop-opacity="0.28" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="hugeLossHoloSurface" x1="60" y1="814" x2="1155" y2="-120" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFFFFF" stop-opacity="0" />
          <stop offset="0.16" stop-color="#FFFDB8" stop-opacity="0.62" />
          <stop offset="0.34" stop-color="#FF432E" stop-opacity="0.72" />
          <stop offset="0.52" stop-color="#FD01BA" stop-opacity="0.68" />
          <stop offset="0.72" stop-color="#FF7A00" stop-opacity="0.58" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="hugeLossHoloStreak" x1="-92" y1="920" x2="1038" y2="-120" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FF003D" stop-opacity="0" />
          <stop offset="0.2" stop-color="#FFFFFF" stop-opacity="0.9" />
          <stop offset="0.33" stop-color="#FFFDB8" stop-opacity="0.78" />
          <stop offset="0.49" stop-color="#FF432E" stop-opacity="0.72" />
          <stop offset="0.66" stop-color="#FD01BA" stop-opacity="0.62" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="hugeLossShineGradient" x1="671.277" y1="-86.6909" x2="681.906" y2="1024.02" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFFDB8" />
          <stop offset="0.322115" stop-color="#FF432E" />
          <stop offset="0.807692" stop-color="#FD01BA" />
        </linearGradient>
        <radialGradient id="hugeLossHoloSpot" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(438 475) rotate(-4) scale(470 180)">
          <stop stop-color="#FFFDB8" stop-opacity="0.96" />
          <stop offset="0.2" stop-color="#FFFFFF" stop-opacity="0.64" />
          <stop offset="0.44" stop-color="#FF432E" stop-opacity="0.46" />
          <stop offset="0.72" stop-color="#FD01BA" stop-opacity="0.3" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="hugeLossHoloRim" x1="0" y1="800" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFFDB8" />
          <stop offset="0.24" stop-color="#FF432E" />
          <stop offset="0.5" stop-color="#FFFFFF" />
          <stop offset="0.75" stop-color="#FD01BA" />
          <stop offset="1" stop-color="#FF003D" />
        </linearGradient>
        <pattern id="hugeLossHoloLines" patternUnits="userSpaceOnUse" width="70" height="70" patternTransform="rotate(-25 600 400)">
          <rect width="70" height="70" fill="transparent" />
          <rect x="0" y="5" width="70" height="3.6" fill="#FFFFFF" opacity="0.46" />
          <rect x="0" y="21" width="70" height="2.4" fill="#FFFDB8" opacity="0.36" />
          <rect x="0" y="42" width="70" height="3.2" fill="#FD01BA" opacity="0.34" />
          <rect x="0" y="61" width="70" height="1.8" fill="#FF432E" opacity="0.32" />
        </pattern>
        <pattern id="hugeLossHoloCrosshatch" patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(32 600 400)">
          <rect width="16" height="16" fill="transparent" />
          <path d="M0 1H16M0 9H16" stroke="#FFFFFF" stroke-width="0.7" opacity="0.2" />
          <path d="M1 0V16M9 0V16" stroke="#FFFDB8" stroke-width="0.55" opacity="0.18" />
        </pattern>
        <pattern id="hugeLossGlitter" patternUnits="userSpaceOnUse" width="34" height="34" patternTransform="rotate(18 600 400)">
          <rect width="34" height="34" fill="transparent" />
          <circle cx="5" cy="6" r="1.15" fill="#FFFFFF" opacity="0.65" />
          <circle cx="22" cy="11" r="0.9" fill="#FFFDB8" opacity="0.56" />
          <circle cx="15" cy="27" r="1.05" fill="#FD01BA" opacity="0.45" />
          <path d="M29 23L31 25L29 27L27 25Z" fill="#FFFFFF" opacity="0.48" />
        </pattern>
        <filter id="hugeLossHoloBlur" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="hugeLossShineFilter" x="-153.2" y="-208.2" width="955.445" height="1206.82" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 0.96 0 0 0 0 0.72 0 0 0 1 0" />
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow_hugeLossShine" />
          <feGaussianBlur stdDeviation="14.6" result="effect2_foregroundBlur_hugeLossShine" />
        </filter>
        <filter id="hugeLossFoilGrain" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.74 1.28" numOctaves="4" seed="19" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="1.35 0 0 0 0 0 1.1 0 0 0 0 0 0.85 0 0 0 0 0 0.45 0" />
        </filter>`
            : ""
        }
        ${isHoloScenario ? buildTradeHoloDefs(holoTier, isLossScenario) : ""}
        <linearGradient id="screenWash" x1="558.008" y1="490.225" x2="550.896" y2="-489.724" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0" />
          <stop offset="1" stop-color="white" />
        </linearGradient>
        <clipPath id="cardClip">
          <rect width="${width}" height="${height}" rx="12" />
        </clipPath>
        ${buildOrbDefs(state)}
      </defs>

      <g clip-path="url(#cardClip)">
        ${
          options.includeBackground === false
            ? ""
            : isDefaultCustomizationColor(customize, "backgroundColor") &&
              isDefaultCustomizationNumber(customize, "backgroundOpacity") &&
              isDefaultCustomizationNumber(customize, "washOpacity")
              ? `
        <g class="card-background-layer">
          <rect class="card-fill" x="${backgroundX}" y="${backgroundY}" width="${backgroundWidth}" height="${backgroundHeight}" fill="url(#hudiWash)" />
        </g>`
              : `
        <g class="card-background-layer">
          <rect class="card-fill" x="${backgroundX}" y="${backgroundY}" width="${backgroundWidth}" height="${backgroundHeight}" fill="${backgroundColor}" fill-opacity="${clamp(customize.backgroundOpacity, 0, 1)}" />
          <rect x="${backgroundX}" y="${backgroundY}" width="${backgroundWidth}" height="${backgroundHeight}" fill="url(#hudiWash)" fill-opacity="${clamp(washOpacity, 0, 1)}" />
        </g>`
        }

        ${
          isHoloScenario && options.includeBackground !== false
            ? buildTradeHoloSvg(width, height, holoTier, isLossScenario, "base")
            : ""
        }
        ${options.includeChart === false ? "" : buildBarChartSvg(state, options)}
        ${
          isHoloScenario
            ? options.includeBackground !== false
              ? buildTradeHoloSvg(width, height, holoTier, isLossScenario, "surface")
              : ""
            : `<path class="screen-wash" d="M-123.992 0.224617C-123.992 -270.395 181.35 -489.775 558.008 -489.775C934.666 -489.775 1240.01 -270.395 1240.01 0.224617C1240.01 270.844 934.666 490.225 558.008 490.225C181.35 490.225 -123.992 270.844 -123.992 0.224617Z" fill="url(#screenWash)" style="mix-blend-mode:screen" />`
        }
        ${buildBigProfitHudiSvg(state)}
        ${buildHugeProfitHudiSvg(state)}
        ${buildBigLossHudiSvg(state)}
        ${buildHugeLossHudiSvg(state)}

        <g class="hudi-positioner" transform="${hudiTransform}" style="${useSpecialHudi ? "display:none" : ""}">
          <g class="hudi-character">
          <path d="M1062.4 -100.371C1050.93 -82.417 1037.01 -63.3017 1024.92 -45.4167C1001.9 -11.3223 979.108 22.9182 956.557 57.3013C946.478 72.5809 933.312 91.3959 924.15 106.891L864.465 0.157278L847.453 -29.6778C843.724 -36.1897 838.647 -45.4258 834.181 -51.3229C826.574 -37.716 819.632 -26.2511 812.985 -11.889C791.406 34.7329 775.146 85.7909 760.082 134.616L746.881 178.029C744.507 185.933 741.905 195.569 739.161 203.25C719.489 201.928 699.631 200.404 679.967 198.98C671.671 198.381 658.485 197.274 650.493 195.845C660.963 231.843 670.92 265.339 682.839 301.153C687.092 313.857 691.422 326.535 695.835 339.187C699.028 348.407 704.582 363.617 705.687 373.044C694.032 394.245 678.01 401.688 654.836 408.61C651.705 409.531 648.513 410.272 645.291 410.826C661.574 434.124 675.161 448.422 700.088 462.948C706.45 466.654 721.726 475.442 727.061 479.338C721.708 498.848 709.382 526.542 701.638 545.536L792.767 578.018C799.325 580.287 805.986 582.106 812.608 584.475C827.803 589.904 842.289 597.286 857.072 603.383C880.335 612.983 909.854 620.537 935.24 621.53C922.805 629.29 910.022 657.751 897.733 669.595C895.795 673.364 888.86 681.999 885.646 687.913C878.502 698.799 878.295 703.534 873.678 713.752C861.861 739.195 849.844 766.167 857.697 794.361C860.55 804.599 863.17 813.204 873.581 818.587C886.889 825.479 902.163 830.342 914.82 820.153C916.067 821.981 917.443 823.873 918.2 825.948C921.312 834.512 922.163 854.033 924.088 864.291C927.413 882.04 945.195 942.049 956.369 955.483C961.338 961.459 969.363 965.934 977.146 967.456C988.541 969.684 1002.39 966.424 1012.02 960.252C1025.43 951.657 1029.08 936.631 1031.97 922.37C1032.64 919.106 1033.18 915.678 1033.28 912.351C1033.41 908.005 1030.98 900.544 1035.33 897.632C1036.94 896.554 1038.18 896.827 1039.91 897.193C1043.09 899.497 1044.75 907.027 1046.33 910.96C1049.88 919.786 1054 928.198 1057.91 936.866C1060.96 946.004 1063.52 955.373 1067.39 964.232C1073.41 977.991 1086.5 992.456 1101.96 996.391C1108.96 998.176 1120.72 996.042 1127.9 994.346C1137.08 991.147 1139.77 985.126 1145.82 977.657C1147.27 974.135 1148.06 967.899 1149.41 964.004C1158.04 939.176 1157.87 914.246 1157.2 888.501C1157.14 885.906 1155.06 861.542 1160.46 862.626C1175.9 865.724 1183.81 867.951 1198.98 859.672C1211.69 852.736 1220.36 838.032 1221.62 824.148C1222.16 810.392 1220.21 794.817 1216.32 781.514C1214.44 775.291 1210.58 768.65 1208.06 762.566C1200.82 745.092 1192.19 727.859 1182.3 711.628C1177.96 706.76 1174.06 700.756 1170.3 695.374C1168.06 691.329 1166.86 691.104 1163.97 687.686L1148.81 669.948C1143.66 663.856 1139.07 657.285 1133.76 651.342C1132.47 650.576 1122.87 640.769 1121.25 639.142C1117.13 636.852 1095.61 617.86 1095.05 613.745C1099.95 608.173 1162.63 611.637 1172.56 611.724C1187.82 611.862 1204.26 613.706 1220.01 612.387C1218.73 599.495 1217.58 586.132 1216.04 573.3C1264.01 563.474 1314.11 558.884 1362.45 551.229C1357.04 542.619 1350.64 534.017 1344.26 526.042C1327.24 504.773 1313.47 481.334 1297.47 459.374C1325.73 441.123 1363.67 419.563 1383.86 392.473C1374.64 388.45 1365.58 384.839 1356.35 380.661C1349.22 377.437 1336.96 371.5 1330.06 369.367C1347.9 346.349 1369.6 322.159 1388.6 299.633C1405.9 279.128 1426.07 253.948 1444.43 234.733C1402.37 232.835 1360.51 230.136 1318.47 227.848C1309.09 227.337 1300.17 227.491 1290.86 226.024L1290.47 225.959C1291.75 219.946 1291.62 213.406 1291.99 207.197L1293.98 168.392L1301.75 32.8639L1303.91 -3.31474C1304.14 -7.63087 1303.88 -14.4824 1304.44 -18.4191C1297.7 -12.5702 1290.88 -7.5601 1283.46 -2.53353C1269.44 6.96438 1256.18 17.5739 1242.91 28.0301C1204.9 58.5744 1167.64 89.9658 1131.14 122.179C1127.56 105.408 1118.36 80.734 1112.85 63.9891C1101.64 28.7303 1090.68 -6.60307 1079.97 -42.0089L1069.42 -76.4381C1067.22 -83.5027 1063.81 -93.3842 1062.4 -100.371Z" fill="${characterColor}" />
          <path d="M795.603 412.51C790.33 412.212 786.082 413.209 781.274 415.116C777.351 419.775 775.621 423.294 774.307 429.27C772.98 435.307 774.048 440.323 774.313 446.193C775.204 466.069 784.517 486.946 796.463 503.282C816.799 531.074 851.281 560.404 887.275 566.607C897.927 568.438 907.541 568.344 916.448 562.1C928.146 553.895 929.008 547.412 931.442 534.863C933.352 521.961 921.108 500.598 914.773 489.16C914.984 505.168 913.738 528.903 896.85 535.951C866.891 548.461 834.928 509.639 824.465 487.493C812.818 462.839 807.449 440.22 816.534 414.967C806.831 413.472 805.891 412.666 795.603 412.51Z" fill="#FEFEFE" />
          <path d="M1181.86 388.924C1170.61 391.279 1163.94 392.366 1153.18 396.746C1160.35 403.418 1165.6 410.176 1169.81 418.992C1179.57 439.577 1180.35 463.11 1171.99 484.383C1165.76 500.153 1153.98 514.943 1137.66 521.953C1125.08 527.496 1110.73 527.892 1097.92 523.047C1079 515.808 1069.27 501.412 1061.59 484.35C1059.79 491.946 1058.39 498.259 1057.16 505.935C1055.38 517.709 1058.25 533.113 1060.19 544.725C1077.85 552.38 1098.61 547.534 1116.97 544.218C1137.72 540.476 1158.97 532.876 1175.12 519.353C1193.46 503.71 1204.65 481.751 1206.22 458.301C1207.88 432.933 1199.14 408.022 1181.86 388.924Z" fill="#FEFEFE" />
          </g>
        </g>

        ${buildOrbSvg(state)}
        <g class="text-box" data-box-width="${textBox.boxWidth}" data-box-left="${textBox.boxLeft}" data-box-right="${textBox.boxRight}" data-origin-x="${textBox.pnlCenterX}" data-origin-y="${textBox.pnlCenterY}" style="transform-box: view-box; transform-origin: ${textBox.pnlCenterX}px ${textBox.pnlCenterY}px;">
          <text class="card-copy card-side" x="${textBox.sideX}" y="${textBox.sideY}" fill="${textColor}" font-size="${textBox.sideFontSize}" letter-spacing="0" font-family="'OCRA Fixed', ui-monospace, monospace">${side}</text>
          <text class="card-copy card-token" x="${textBox.tokenX}" y="${textBox.tokenY}" fill="${tokenColor}" font-size="${textBox.tokenFontSize}" font-weight="700" letter-spacing="0" text-anchor="end" font-family="'Syne Hudi', Syne, sans-serif">${token}</text>
          <text class="card-copy card-pnl" x="${textBox.pnlX}" y="${textBox.pnlY}" fill="${pnlFill}" stroke="${pnlStrokeColor}" stroke-width="${customize.pnlStrokeWidth}" paint-order="stroke fill" font-size="${textBox.pnlFontSize}" letter-spacing="0" textLength="${textBox.boxWidth}" lengthAdjust="spacingAndGlyphs" font-family="'OCRA Fixed', ui-monospace, monospace">${pnl}</text>
          <text class="card-copy card-meta" x="${textBox.metaX}" y="${textBox.metaY}" fill="${textColor}" font-size="${textBox.metaFontSize}" letter-spacing="0" textLength="${textBox.boxWidth}" lengthAdjust="spacingAndGlyphs" font-family="'OCRA Fixed', ui-monospace, monospace">${meta}</text>
        </g>
      </g>
    </svg>
  `;
}

function updatePreview(options = {}) {
  const state = readState();
  const svg = buildCardSvg(state, { animated: options.animated !== false });
  preview.innerHTML = svg;
  preview.style.aspectRatio = `${state.preset.width} / ${state.preset.height}`;
  resetPreviewInteraction();
  sizeLabel.textContent = state.preset.label;
  pnlPill.textContent = formatPnl(state.pnl);
  pnlPill.classList.toggle("loss", state.pnl < 0);
}

function replayAnimation() {
  updatePreview({ animated: true });
  setStatus("Animation replayed.");
}

function getPreviewInteractionDefaults() {
  return {
    "--mx": "0",
    "--my": "0",
    "--hover-strength": "0",
    "--tilt-x": "0deg",
    "--tilt-y": "0deg",
    "--card-z": "0.01px",
    "--card-scale": "1",
    "--shadow-x": "0px",
    "--shadow-y": "24px",
    "--svg-saturate": "1",
    "--svg-brightness": "1",
    "--base-x": "0px",
    "--base-y": "0px",
    "--base-rotate": "0deg",
    "--base-opacity": "0.96",
    "--surface-x": "0px",
    "--surface-y": "0px",
    "--surface-rotate": "0deg",
    "--surface-opacity": "0.96",
    "--sweep-x": "0px",
    "--sweep-y": "0px",
    "--sweep-rotate": "0deg",
    "--sweep-opacity": "0.82",
    "--shine-x": "0px",
    "--shine-y": "0px",
    "--shine-rotate": "0deg",
    "--shine-scale": "1",
    "--shine-opacity": "0.18",
    "--hotspot-x": "0px",
    "--hotspot-y": "0px",
    "--hotspot-scale": "1",
    "--hotspot-opacity": "0.72",
    "--line-x": "0px",
    "--line-y": "0px",
    "--line-opacity": "0.42",
    "--grain-x": "0px",
    "--grain-y": "0px",
    "--grain-rotate": "0deg",
    "--grain-opacity": "0.28",
    "--rim-opacity": "0.66"
  };
}

function resetInteractiveCard(target) {
  target.classList.remove("is-holo-hovering");

  for (const [name, value] of Object.entries(getPreviewInteractionDefaults())) {
    target.style.setProperty(name, value);
  }
}

function updateInteractiveCard(target, event) {
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  const mx = (x - 0.5) * 2;
  const my = (y - 0.5) * 2;
  const distance = clamp(Math.hypot(mx, my) / Math.SQRT2, 0, 1);
  const strength = 0.3 + distance * 0.7;

  target.classList.add("is-holo-hovering");
  target.style.setProperty("--mx", mx.toFixed(4));
  target.style.setProperty("--my", my.toFixed(4));
  target.style.setProperty("--hover-strength", strength.toFixed(4));
  target.style.setProperty("--tilt-x", `${(-my * 7.5).toFixed(3)}deg`);
  target.style.setProperty("--tilt-y", `${(mx * 9.5).toFixed(3)}deg`);
  target.style.setProperty("--card-z", `${(8 + strength * 34).toFixed(2)}px`);
  target.style.setProperty("--card-scale", (1 + strength * 0.045).toFixed(4));
  target.style.setProperty("--shadow-x", `${(-mx * 10).toFixed(2)}px`);
  target.style.setProperty("--shadow-y", `${(24 + my * 8).toFixed(2)}px`);
  target.style.setProperty("--svg-saturate", (1 + strength * 0.18).toFixed(3));
  target.style.setProperty("--svg-brightness", (1 + strength * 0.04).toFixed(3));
  target.style.setProperty("--base-x", `${(-mx * 18).toFixed(2)}px`);
  target.style.setProperty("--base-y", `${(-my * 12).toFixed(2)}px`);
  target.style.setProperty("--base-rotate", `${(-mx * 0.65).toFixed(3)}deg`);
  target.style.setProperty("--base-opacity", (0.78 + strength * 0.22).toFixed(3));
  target.style.setProperty("--surface-x", `${(mx * 34).toFixed(2)}px`);
  target.style.setProperty("--surface-y", `${(my * 24).toFixed(2)}px`);
  target.style.setProperty("--surface-rotate", `${(mx * 0.75).toFixed(3)}deg`);
  target.style.setProperty("--surface-opacity", (0.72 + strength * 0.24).toFixed(3));
  target.style.setProperty("--sweep-x", `${(mx * 245).toFixed(2)}px`);
  target.style.setProperty("--sweep-y", `${(-my * 115).toFixed(2)}px`);
  target.style.setProperty("--sweep-rotate", `${(mx * 2.2).toFixed(3)}deg`);
  target.style.setProperty("--sweep-opacity", (0.4 + strength * 0.52).toFixed(3));
  target.style.setProperty("--shine-x", `${(mx * 390).toFixed(2)}px`);
  target.style.setProperty("--shine-y", `${(-my * 170).toFixed(2)}px`);
  target.style.setProperty("--shine-rotate", `${(mx * 1.5).toFixed(3)}deg`);
  target.style.setProperty("--shine-scale", (1 + strength * 0.035).toFixed(4));
  target.style.setProperty("--shine-opacity", (0.1 + strength * 0.24).toFixed(3));
  target.style.setProperty("--hotspot-x", `${(mx * 270).toFixed(2)}px`);
  target.style.setProperty("--hotspot-y", `${(my * 145).toFixed(2)}px`);
  target.style.setProperty("--hotspot-scale", (0.9 + strength * 0.22).toFixed(4));
  target.style.setProperty("--hotspot-opacity", (0.28 + strength * 0.62).toFixed(3));
  target.style.setProperty("--line-x", `${(-mx * 40).toFixed(2)}px`);
  target.style.setProperty("--line-y", `${(-my * 28).toFixed(2)}px`);
  target.style.setProperty("--line-opacity", (0.24 + strength * 0.34).toFixed(3));
  target.style.setProperty("--grain-x", `${(mx * 58).toFixed(2)}px`);
  target.style.setProperty("--grain-y", `${(my * 42).toFixed(2)}px`);
  target.style.setProperty("--grain-rotate", `${(mx * 0.8).toFixed(3)}deg`);
  target.style.setProperty("--grain-opacity", (0.18 + strength * 0.48).toFixed(3));
  target.style.setProperty("--rim-opacity", (0.5 + strength * 0.36).toFixed(3));
}

function resetPreviewInteraction() {
  resetInteractiveCard(preview);
}

function updatePreviewInteraction(event) {
  updateInteractiveCard(preview, event);
}

function resetPreviewInteractionWhenOutside(event) {
  if (!preview.classList.contains("is-holo-hovering")) {
    return;
  }

  const rect = preview.getBoundingClientRect();
  const isOutside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;

  if (isOutside) {
    resetPreviewInteraction();
  }
}

function startPreviewInteraction(event) {
  if (event.pointerId !== undefined && preview.setPointerCapture) {
    try {
      preview.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if the browser already released the pointer.
    }
  }
  updatePreviewInteraction(event);
}

function stopPreviewInteraction(event) {
  if (event?.pointerId !== undefined && preview.releasePointerCapture) {
    try {
      preview.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore stale pointer captures.
    }
  }
  resetPreviewInteraction();
}

function applyScenario(value) {
  const scenario = scenarios[value];
  if (!scenario) {
    return;
  }

  form.elements.token.value = scenario.token;
  form.elements.hudi.value = scenario.hudi;
  form.elements.pnlOverride.value = scenario.pnlOverride;
  form.elements.note.value = scenario.note;
  form.elements.side.value = scenario.side;
  form.elements.leverage.value = scenario.leverage;
  syncSimulatedPrices();
}

async function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "pnl-sharecard";
}

async function ensureCardExportAssets(state) {
  if (usesBigProfitHudi(state)) {
    await ensureBigProfitHudiAsset();
  }
  if (usesHugeProfitHudi(state)) {
    await ensureHugeProfitHudiAsset();
  }
  if (usesBigLossHudi(state)) {
    await ensureBigLossHudiAsset();
  }
  if (usesHugeLossHudi(state)) {
    await ensureHugeLossHudiAsset();
  }

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  return await ensureExportFontCss();
}

async function buildExportSvg(state, options = {}) {
  const embeddedFontCss = await ensureCardExportAssets(state);
  return buildCardSvg(state, { animated: false, embeddedFontCss, ...options });
}

async function cardBlob(type = "image/png", scale = pngExportScale) {
  const state = readState();
  const svg = await buildExportSvg(state);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const exportScale = clamp(Number(scale) || 1, 1, 4);
  const exportWidth = Math.round(state.preset.width * exportScale);
  const exportHeight = Math.round(state.preset.height * exportScale);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, exportWidth, exportHeight);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("PNG export failed."));
        }
      }, type);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function downloadPng() {
  try {
    const state = readState();
    const blob = await cardBlob("image/png");
    await downloadBlob(`${slugify(`${state.displayToken}-${formatPnl(state.pnl)}`)}-${pngExportScale}x.png`, blob);
    setStatus(`PNG export started at ${state.preset.width * pngExportScale} x ${state.preset.height * pngExportScale}.`);
  } catch {
    setStatus("PNG export failed in this browser.");
  }
}

async function downloadSvg() {
  try {
    const state = readState();
    const svg = await buildExportSvg(state);
    await downloadBlob(`${slugify(`${state.displayToken}-${formatPnl(state.pnl)}`)}.svg`, new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    setStatus("SVG export started.");
  } catch {
    setStatus("SVG export failed in this browser.");
  }
}

async function copyText() {
  try {
    const state = readState();
    await navigator.clipboard.writeText(buildShareText(state));
    setStatus("Share text copied.");
  } catch {
    setStatus("Clipboard text copy is blocked here.");
  }
}

async function copyPng() {
  if (!navigator.clipboard || !window.ClipboardItem) {
    setStatus("PNG clipboard is not available in this browser.");
    return;
  }

  try {
    const blob = await cardBlob("image/png");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    const state = readState();
    setStatus(`PNG copied for chat at ${state.preset.width * pngExportScale} x ${state.preset.height * pngExportScale}.`);
  } catch {
    setStatus("PNG clipboard copy is blocked here.");
  }
}

function bindInteractiveCard(target) {
  if (!target || target.dataset.hudi3dBound === "true") {
    return target;
  }

  const releasePointer = (event) => {
    if (event?.pointerId !== undefined && target.releasePointerCapture) {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }
  };

  target.dataset.hudi3dBound = "true";
  resetInteractiveCard(target);
  target.addEventListener("pointerdown", (event) => {
    if (event.pointerId !== undefined && target.setPointerCapture) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail on synthetic or interrupted events.
      }
    }
    updateInteractiveCard(target, event);
  });
  target.addEventListener("pointermove", (event) => updateInteractiveCard(target, event));
  target.addEventListener("pointerenter", (event) => updateInteractiveCard(target, event));
  target.addEventListener("pointerleave", (event) => {
    releasePointer(event);
    resetInteractiveCard(target);
  });
  target.addEventListener("pointerup", (event) => {
    releasePointer(event);
    resetInteractiveCard(target);
  });
  target.addEventListener("pointercancel", (event) => {
    releasePointer(event);
    resetInteractiveCard(target);
  });

  return target;
}

function renderChatSharecard(container, payload = {}) {
  const target = typeof container === "string" ? document.querySelector(container) : container;
  if (!target) {
    return null;
  }

  const state = payload.state || readState();
  const card = document.createElement("div");
  card.className = "preview chat-sharecard-preview";
  card.style.aspectRatio = `${state.preset.width} / ${state.preset.height}`;
  card.innerHTML = payload.svg || buildCardSvg(state, { animated: false });
  target.replaceChildren(card);
  return bindInteractiveCard(card);
}

async function getChatSharePayload(options = {}) {
  const state = readState();
  const svg = options.portable ? await buildExportSvg(state) : buildCardSvg(state, { animated: false });

  return {
    type: "hudi-sharecard",
    version: 1,
    renderMode: "interactive-3d-svg",
    shareText: buildShareText(state),
    generatedAt: new Date().toISOString(),
    state: JSON.parse(JSON.stringify(state)),
    graphState: getSharecardChartState(state),
    svg,
    interaction: {
      enabled: true,
      renderer: "window.hudiSharecard.renderChatSharecard(container, payload)"
    }
  };
}

async function copyChatCardPayload() {
  if (!navigator.clipboard) {
    setStatus("3D card payload copy is blocked here.");
    return;
  }

  try {
    const payload = await getChatSharePayload();
    await navigator.clipboard.writeText(JSON.stringify(payload));
    setStatus("3D chat card payload copied.");
  } catch {
    setStatus("3D card payload copy failed.");
  }
}

function setTradeData(data = {}) {
  const fields = ["token", "hudi", "pnlOverride", "side", "leverage", "note"];

  for (const field of fields) {
    if (data[field] !== undefined && form.elements[field]) {
      form.elements[field].value = data[field];
    }
  }

  if (data.pnl !== undefined) {
    form.elements.pnlOverride.value = data.pnl;
  }

  randomizeGraphVariation();
  updatePreview({ animated: true });
  updateGraphPreview();
  saveAppState();
}

window.hudiSharecard = {
  setTradeData,
  replayMarketVariation: replayGraphVariation,
  getTradeState: readState,
  getGraphState: () => getSharecardChartState(readState()),
  getChatSharePayload,
  renderChatSharecard
};

form.addEventListener("input", (event) => {
  persistCustomizerChange(event.target);
  updateCustomizerOutputs();
  updatePreview({ animated: false });
  updateGraphPreview();
  saveAppState();
});
form.addEventListener("change", (event) => {
  const animatePreview = event.target.name === "scenario";
  if (event.target.name === "scenario") {
    applyScenario(event.target.value);
    applyStoredCustomizationForScenario(event.target.value);
    randomizeGraphVariation();
  } else {
    persistCustomizerChange(event.target);
  }
  updateCustomizerOutputs();
  updatePreview({ animated: animatePreview });
  updateGraphPreview();
  saveAppState();
});
resetCustomizerButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  resetCustomizer();
  saveAppState();
});

document.querySelector("#download-png").addEventListener("click", downloadPng);
document.querySelector("#download-svg").addEventListener("click", downloadSvg);
document.querySelector("#copy-text").addEventListener("click", copyText);
document.querySelector("#copy-png").addEventListener("click", copyPng);
copyChatCardButton.addEventListener("click", copyChatCardPayload);
replayButton.addEventListener("click", replayAnimation);
preview.addEventListener("pointerdown", startPreviewInteraction);
preview.addEventListener("pointermove", updatePreviewInteraction);
preview.addEventListener("pointerenter", updatePreviewInteraction);
preview.addEventListener("pointerleave", stopPreviewInteraction);
preview.addEventListener("pointerup", stopPreviewInteraction);
preview.addEventListener("pointercancel", stopPreviewInteraction);
window.addEventListener("pointermove", resetPreviewInteractionWhenOutside, { passive: true });
window.addEventListener("pointerup", resetPreviewInteraction, { passive: true });
window.addEventListener("pointercancel", resetPreviewInteraction, { passive: true });
graphControls.addEventListener("input", updateGraphAndSharecard);
graphControls.addEventListener("change", updateGraphAndSharecard);
graphReplayButton.addEventListener("click", replayGraphVariation);
applyGraphButton.addEventListener("click", applyGraphToSharecard);
exportLottieButton.addEventListener("click", exportGraphLottie);
initBezierDrag();
populateMarketList();
loadStoredAppState();
loadStoredCustomizerState();

updatePreview();
updateGraphPreview();
ensureBigProfitHudiAsset().then(() => {
  if (usesBigProfitHudi(readState())) {
    updatePreview({ animated: false });
  }
});
ensureHugeProfitHudiAsset().then(() => {
  if (usesHugeProfitHudi(readState())) {
    updatePreview({ animated: false });
  }
});
ensureBigLossHudiAsset().then(() => {
  if (usesBigLossHudi(readState())) {
    updatePreview({ animated: false });
  }
});
ensureHugeLossHudiAsset().then(() => {
  if (usesHugeLossHudi(readState())) {
    updatePreview({ animated: false });
  }
});
