"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { listings } from "./listings";

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type Palette = { colour: string; base: string; sheen: string; shadow: string };

function hexToRgb(hex: string): RGB {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RGB) {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mixRgb(a: RGB, b: RGB, amount: number): RGB {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r
    ? (g - b) / d + (g < b ? 6 : 0)
    : max === g
      ? (b - r) / d + 2
      : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  };
}

function shiftHueToward(hue: number, target: number, amount: number) {
  const delta = ((((target - hue) % 360) + 540) % 360) - 180;
  return hue + delta * amount;
}

function hueDistance(a: number, b: number) {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

function anchoredColour(input: HSL, anchorInput: string, anchorOutput: string) {
  const from = rgbToHsl(hexToRgb(anchorInput));
  const to = rgbToHsl(hexToRgb(anchorOutput));
  const hueDelta = ((((input.h - from.h) % 360) + 540) % 360) - 180;
  return hslToRgb({
    h: to.h + hueDelta,
    s: Math.max(0, Math.min(1, to.s + input.s - from.s)),
    l: Math.max(0.05, Math.min(0.95, to.l + input.l - from.l)),
  });
}

const paletteNeighbourhoods = [
  { colour: "#fade4b", base: "#fade4b", sheen: "#fdf18b", shadow: "#ef8b34", radius: 38 },
  { colour: "#eb5128", base: "#ea3323", sheen: "#eb4034", shadow: "#bb271d", radius: 42 },
  { colour: "#ea33e3", base: "#ea33e3", sheen: "#f0a0cd", shadow: "#c90062", radius: 46 },
];

function deriveOrbPalette(colour: string): Palette {
  const hsl = rgbToHsl(hexToRgb(colour));
  const sourceHue = hsl.s > 0.03 ? hsl.h : 196;
  const sourceSaturation = Math.max(hsl.s, hsl.s > 0.03 ? hsl.s : 0.48);
  let base = hexToRgb(colour);
  let sheen = hslToRgb({
    h: shiftHueToward(sourceHue, 55, 0.21),
    s: Math.max(0.28, Math.min(0.96, sourceSaturation * 0.9 + 0.1)),
    l: Math.min(0.88, hsl.l + 0.3),
  });
  let shadow = hslToRgb({
    h: shiftHueToward(sourceHue, 235, 0.12),
    s: Math.min(1, sourceSaturation * 1.36 + 0.14),
    l: Math.max(0.2, Math.min(0.48, hsl.l * 0.66)),
  });

  if (hsl.s > 0.25) {
    for (const neighbourhood of paletteNeighbourhoods) {
      const anchor = rgbToHsl(hexToRgb(neighbourhood.colour));
      const proximity = Math.max(0, 1 - hueDistance(hsl.h, anchor.h) / neighbourhood.radius);
      const weight = proximity * proximity * (3 - 2 * proximity);
      if (weight === 0) continue;
      base = mixRgb(base, anchoredColour(hsl, neighbourhood.colour, neighbourhood.base), weight);
      sheen = mixRgb(sheen, anchoredColour(hsl, neighbourhood.colour, neighbourhood.sheen), weight);
      shadow = mixRgb(shadow, anchoredColour(hsl, neighbourhood.colour, neighbourhood.shadow), weight);
    }
  }

  return { colour, base: rgbToHex(base), sheen: rgbToHex(sheen), shadow: rgbToHex(shadow) };
}

function listingHash(label: string) {
  let hash = 2166136261;
  for (const character of label) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function previousColourForListing(label: string, index: number) {
  const hash = listingHash(label);
  return rgbToHex(hslToRgb({
    h: (hash + index * 47) % 360,
    s: 1,
    l: 0.5,
  }));
}

const previousGalleryColourSeeds = [
  "#00b7ff",
  "#ff008c",
  "#ffd500",
  "#aaff00",
  "#b80022",
  "#0077ff",
  "#00e5d4",
  "#ff2b00",
  "#00d5ff",
  "#ff1493",
  "#ffe600",
  "#cf143f",
  "#00a8e8",
  "#00f0b5",
];

function previousCuratedColourForListing(label: string, index: number) {
  const hash = listingHash(label);
  return previousGalleryColourSeeds[(hash + index * 5) % previousGalleryColourSeeds.length];
}

const galleryColourSeeds = [
  "#ff0099",
  "#fff000",
  "#9dff00",
  "#ff00c8",
  "#ffd000",
  "#00ffb2",
  "#ff006e",
  "#ffe600",
  "#00ff66",
  "#ff00a8",
  "#ffc400",
  "#b7ff00",
  "#ff003d",
  "#00ffd5",
  "#ff00b8",
  "#e1ff00",
];

function colourForListing(_label: string, index: number) {
  return galleryColourSeeds[index % galleryColourSeeds.length];
}

const initialGalleryOrbs = listings.map((listing, index) => ({
  ...listing,
  number: listing.exchangeTicker.padStart(4, "0").slice(-4),
  palette: deriveOrbPalette(colourForListing(listing.company, index)),
}));

type OrbDraft = Palette & { ticker: string; number: string };
const galleryStorageKey = "hudi-gallery-orbs-v1";
const themeStorageKey = "hudi-orb-theme";

function storedColour(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function relativeLuminance({ r, g, b }: RGB) {
  const linear = (value: number) => {
    value /= 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return linear(r) * 0.2126 + linear(g) * 0.7152 + linear(b) * 0.0722;
}

function contrastRatio(a: string, b: string) {
  const first = relativeLuminance(hexToRgb(a));
  const second = relativeLuminance(hexToRgb(b));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function useWhiteText(base: string, sheen: string) {
  return Math.min(contrastRatio(base, "#506868"), contrastRatio(sheen, "#506868")) < 3;
}

function TickerOrb({ ticker, number, palette, compact = false }: { ticker: string; number: string; palette: Palette; compact?: boolean }) {
  const instanceId = useId().replace(/:/g, "");
  const numberFilterId = `orb-number-inner-${instanceId}`;
  const numberCurveId = `number-curve-${instanceId}`;
  const tickerGradientId = `orb-ticker-gradient-${instanceId}`;
  const whiteText = useWhiteText(palette.base, palette.sheen);
  const tickerScale = Math.max(0.72, Math.min(1.68, 5 / Math.max(1, ticker.trim().length)));
  const shadow = hexToRgb(palette.shadow);
  const tickerInner = rgbToHex(mixRgb(hexToRgb(palette.base), { r: 255, g: 255, b: 255 }, 0.61));
  const numberColour = rgbToHex(mixRgb(hexToRgb(palette.base), { r: 0, g: 0, b: 0 }, 0.18));

  return (
    <div
      className={`ticker-orb${whiteText ? " is-auto-white" : ""}${compact ? " is-compact" : ""}`}
      style={{
        "--orb-base": palette.base,
        "--orb-sheen": palette.sheen,
        "--orb-shadow": `rgba(${shadow.r}, ${shadow.g}, ${shadow.b}, .4)`,
        "--orb-ticker-inner": tickerInner,
        "--orb-number-colour": numberColour,
        "--orb-ticker-scale": tickerScale,
        "--orb-number-filter": `url(#${numberFilterId})`,
      } as React.CSSProperties}
      aria-label={`${ticker} ${number}`}
    >
      <svg className="orb-number" viewBox="0 0 100 32" aria-hidden="true">
        <defs>
          <filter id={numberFilterId} x="-15%" y="-45%" width="130%" height="190%" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="background" />
            <feBlend in="SourceGraphic" in2="background" result="shape" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy=".45" />
            <feGaussianBlur stdDeviation=".38" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" result="innerAlpha" />
            <feFlood floodColor="#000" floodOpacity=".22" result="innerTint" />
            <feComposite in="innerTint" in2="innerAlpha" operator="in" result="innerShadow" />
            <feBlend in="innerShadow" in2="shape" />
          </filter>
        </defs>
        <path id={numberCurveId} d="M 18 26 A 200 200 0 0 1 82 26" fill="none" />
        <text textAnchor="middle">
          <textPath href={`#${numberCurveId}`} startOffset="50%">{number}</textPath>
        </text>
      </svg>

      <svg className="orb-ticker" viewBox="0 0 100 38" role="img" aria-label={ticker}>
        <defs>
          <linearGradient id={tickerGradientId} x1="50" y1="12" x2="50" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor={`color-mix(in srgb, ${palette.base} 24%, #000)`} />
            <stop offset="1" stopColor={`color-mix(in srgb, ${palette.base} 15%, #000)`} />
          </linearGradient>
        </defs>
        <text className="orb-ticker-chip" x="50" y="19" dy={whiteText ? "-.5" : ".5"} textAnchor="middle" dominantBaseline="middle">{ticker}</text>
        <text className="orb-ticker-face" x="50" y="19" textAnchor="middle" dominantBaseline="middle" fill={whiteText ? "#fff" : `url(#${tickerGradientId})`}>{ticker}</text>
      </svg>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<"generator" | "listings">("generator");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ticker, setTicker] = useState("NTNDO");
  const [number, setNumber] = useState("3325");
  const [palette, setPalette] = useState<Palette>(() => deriveOrbPalette("#ff00aa"));
  const [galleryItems, setGalleryItems] = useState(initialGalleryOrbs);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<OrbDraft>({
    ticker: "",
    number: "",
    ...deriveOrbPalette("#ff0000"),
  });
  const draftPalette = useMemo<Palette>(() => ({
    colour: draft.colour,
    base: draft.base,
    sheen: draft.sheen,
    shadow: draft.shadow,
  }), [draft.colour, draft.base, draft.sheen, draft.shadow]);
  const swatches = useMemo(() => [
    { key: "colour" as const, label: "colour" },
    { key: "base" as const, label: "base" },
    { key: "sheen" as const, label: "sheen" },
    { key: "shadow" as const, label: "shadow" },
  ], []);

  const updateColour = (colour: string) => setPalette(deriveOrbPalette(colour));
  const updateToken = (key: "base" | "sheen" | "shadow", value: string) => {
    setPalette((current) => ({ ...current, [key]: value }));
  };
  const changeView = (nextView: "generator" | "listings") => {
    setView(nextView);
    window.history.replaceState(null, "", nextView === "listings" ? "#tickers" : "#generator");
  };
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(themeStorageKey, nextTheme);
  };
  const openEditor = (index: number) => {
    const item = galleryItems[index];
    setDraft({ ticker: item.ticker, number: item.number, ...item.palette });
    setEditingIndex(index);
  };
  const closeEditor = () => setEditingIndex(null);
  const updateDraftColour = (key: keyof Palette, colour: string) => {
    setDraft((current) => key === "colour"
      ? { ...current, ...deriveOrbPalette(colour) }
      : { ...current, [key]: colour });
  };
  const saveEditor = () => {
    if (editingIndex === null) return;
    const tickerValue = draft.ticker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "ORB";
    const numberValue = draft.number.replace(/\D/g, "").slice(0, 4).padStart(4, "0");
    const nextItems = galleryItems.map((item, index) => index === editingIndex
      ? { ...item, ticker: tickerValue, number: numberValue, palette: draftPalette }
      : item);
    setGalleryItems(nextItems);
    window.localStorage.setItem(galleryStorageKey, JSON.stringify(nextItems.map((item) => ({
      ticker: item.ticker,
      number: item.number,
      colour: item.palette.colour,
      base: item.palette.base,
      sheen: item.palette.sheen,
      shadow: item.palette.shadow,
    }))));
    closeEditor();
  };

  useEffect(() => {
    if (window.location.hash === "#tickers") setView("listings");
    const storedTheme = window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
    setTheme(storedTheme);
    document.documentElement.dataset.theme = storedTheme;

    try {
      const storedOrbs = JSON.parse(window.localStorage.getItem(galleryStorageKey) || "[]") as Partial<OrbDraft>[];
      if (Array.isArray(storedOrbs)) {
        const restoredItems = initialGalleryOrbs.map((item, index) => {
          const stored = storedOrbs[index];
          if (!stored || typeof stored.ticker !== "string" || typeof stored.number !== "string" || typeof stored.colour !== "string") return item;
          const derived = deriveOrbPalette(stored.colour);
          const storedPalette = {
            colour: storedColour(stored.colour, derived.colour),
            base: storedColour(stored.base, derived.base),
            sheen: storedColour(stored.sheen, derived.sheen),
            shadow: storedColour(stored.shadow, derived.shadow),
          };
          const previousDefault = deriveOrbPalette(previousColourForListing(item.company, index));
          const previousCuratedDefault = deriveOrbPalette(previousCuratedColourForListing(item.company, index));
          const isGeneratedDefault = (["colour", "base", "sheen", "shadow"] as const)
            .every((key) => {
              const value = storedPalette[key].toLowerCase();
              return value === previousDefault[key].toLowerCase() || value === previousCuratedDefault[key].toLowerCase();
            });
          return {
            ...item,
            ticker: stored.ticker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || item.ticker,
            number: stored.number.replace(/\D/g, "").slice(0, 4).padStart(4, "0"),
            palette: isGeneratedDefault ? item.palette : storedPalette,
          };
        });
        setGalleryItems(restoredItems);
        window.localStorage.setItem(galleryStorageKey, JSON.stringify(restoredItems.map((item) => ({
          ticker: item.ticker,
          number: item.number,
          colour: item.palette.colour,
          base: item.palette.base,
          sheen: item.palette.sheen,
          shadow: item.palette.shadow,
        }))));
      }
    } catch {
      window.localStorage.removeItem(galleryStorageKey);
    }
  }, []);

  useEffect(() => {
    if (editingIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingIndex]);

  return (
    <main className={`generator-shell ${view === "listings" ? "is-listings-view" : ""}`}>
      <nav className="view-toggle" aria-label="Orb page">
        <button type="button" aria-pressed={view === "generator"} onClick={() => changeView("generator")}>generator</button>
        <button type="button" aria-pressed={view === "listings"} onClick={() => changeView("listings")}>tickers</button>
        <button type="button" aria-pressed={theme === "dark"} onClick={toggleTheme}>dark</button>
      </nav>

      {view === "generator" ? (
        <>
          <section className="orb-stage" aria-label="Ticker orb preview">
            <TickerOrb ticker={ticker || " "} number={number || " "} palette={palette} />
          </section>

          <section className="orb-controls" aria-label="Orb controls">
            <p className="colours-label">colours</p>
            <div className="swatch-grid">
              {swatches.map(({ key, label }) => (
                <label className="swatch-control" key={key}>
                  <span className="swatch" style={{ backgroundColor: palette[key] }}>
                    <input
                      type="color"
                      value={palette[key]}
                      aria-label={`${label} colour`}
                      onInput={(event) => key === "colour" ? updateColour(event.currentTarget.value) : updateToken(key, event.currentTarget.value)}
                      onChange={(event) => key === "colour" ? updateColour(event.target.value) : updateToken(key, event.target.value)}
                    />
                  </span>
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="text-controls">
              <label className="text-control">
                <span>ticker:</span>
                <input
                  value={ticker}
                  maxLength={7}
                  aria-label="Ticker"
                  onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/\s/g, ""))}
                />
              </label>
              <label className="text-control">
                <span>number:</span>
                <input
                  value={number}
                  maxLength={8}
                  aria-label="Number"
                  inputMode="numeric"
                  onChange={(event) => setNumber(event.target.value.replace(/\s/g, ""))}
                />
              </label>
            </div>
          </section>
        </>
      ) : (
        <section className="listings-gallery" aria-label="Hudi listing ticker orbs">
          <h1 className="visually-hidden">Hudi listing ticker orbs</h1>
          <div className="listing-grid">
            {galleryItems.map((listing, index) => (
              <article
                className="listing-card"
                key={`${listing.market}-${listing.exchangeTicker}`}
                aria-label={`${listing.company}, ${listing.market}, ${listing.priority}`}
                title={`${listing.company} · ${listing.priority}`}
              >
                <button className="listing-orb-button" type="button" onClick={() => openEditor(index)} aria-label={`Edit ${listing.company} orb`}>
                  <TickerOrb ticker={listing.ticker} number={listing.number} palette={listing.palette} compact />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {editingIndex !== null && (
        <div className="orb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeEditor()}>
          <form
            className="orb-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="orb-editor-title"
            onSubmit={(event) => {
              event.preventDefault();
              saveEditor();
            }}
          >
            <header className="orb-editor-header">
              <h2 id="orb-editor-title">edit orb</h2>
              <button type="button" onClick={closeEditor} aria-label="Close editor">×</button>
            </header>

            <div className="orb-editor-preview" aria-hidden="true">
              <TickerOrb ticker={draft.ticker || "ORB"} number={draft.number || "0000"} palette={draftPalette} compact />
            </div>

            <div className="orb-editor-fields">
              <div className="orb-editor-colours" aria-label="Orb colours">
                {swatches.map(({ key, label }) => (
                  <label className="orb-editor-colour-control" key={key}>
                    <span className="orb-editor-swatch" style={{ backgroundColor: draft[key] }}>
                      <input
                        type="color"
                        value={draft[key]}
                        aria-label={`${label} colour`}
                        onInput={(event) => updateDraftColour(key, event.currentTarget.value)}
                        onChange={(event) => updateDraftColour(key, event.currentTarget.value)}
                      />
                    </span>
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label className="orb-editor-field">
                <span>title</span>
                <input
                  autoFocus
                  value={draft.ticker}
                  maxLength={4}
                  aria-label="Orb title"
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    ticker: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4),
                  }))}
                />
              </label>
              <label className="orb-editor-field">
                <span>number</span>
                <input
                  value={draft.number}
                  maxLength={4}
                  inputMode="numeric"
                  aria-label="Orb number"
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    number: event.target.value.replace(/\D/g, "").slice(0, 4),
                  }))}
                />
              </label>
            </div>

            <footer className="orb-editor-actions">
              <button type="button" onClick={closeEditor}>cancel</button>
              <button type="submit">save</button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
