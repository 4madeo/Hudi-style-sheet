"use client";

import { useMemo, useState } from "react";

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

function deriveOrbPalette(colour: string): Palette {
  const hsl = rgbToHsl(hexToRgb(colour));
  const sourceHue = hsl.s > 0.03 ? hsl.h : 196;
  const sourceSaturation = Math.max(hsl.s, hsl.s > 0.03 ? hsl.s : 0.48);
  const sheen = hslToRgb({
    h: shiftHueToward(sourceHue, 55, 0.21),
    s: Math.max(0.28, Math.min(0.96, sourceSaturation * 0.9 + 0.1)),
    l: Math.min(0.88, hsl.l + 0.3),
  });
  const shadow = hslToRgb({
    h: shiftHueToward(sourceHue, 235, 0.12),
    s: Math.min(1, sourceSaturation * 1.36 + 0.14),
    l: Math.max(0.2, Math.min(0.48, hsl.l * 0.66)),
  });
  return { colour, base: colour, sheen: rgbToHex(sheen), shadow: rgbToHex(shadow) };
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

function TickerOrb({ ticker, number, palette }: { ticker: string; number: string; palette: Palette }) {
  const whiteText = useWhiteText(palette.base, palette.sheen);
  const tickerScale = Math.max(0.72, Math.min(1.68, 5 / Math.max(1, ticker.trim().length)));
  const shadow = hexToRgb(palette.shadow);
  const tickerInner = rgbToHex(mixRgb(hexToRgb(palette.base), { r: 255, g: 255, b: 255 }, 0.61));
  const numberColour = rgbToHex(mixRgb(hexToRgb(palette.base), { r: 0, g: 0, b: 0 }, 0.18));

  return (
    <div
      className={`ticker-orb${whiteText ? " is-auto-white" : ""}`}
      style={{
        "--orb-base": palette.base,
        "--orb-sheen": palette.sheen,
        "--orb-shadow": `rgba(${shadow.r}, ${shadow.g}, ${shadow.b}, .4)`,
        "--orb-ticker-inner": tickerInner,
        "--orb-number-colour": numberColour,
        "--orb-ticker-scale": tickerScale,
      } as React.CSSProperties}
      aria-label={`${ticker} ${number}`}
    >
      <svg className="orb-number" viewBox="0 0 100 32" aria-hidden="true">
        <defs>
          <filter id="orb-text-inner" x="-10%" y="-40%" width="120%" height="180%" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="background" />
            <feBlend in="SourceGraphic" in2="background" result="shape" />
            <feOffset dy=".55" />
            <feGaussianBlur stdDeviation=".7" />
            <feComposite in2="shape" operator="in" />
            <feBlend in2="shape" />
          </filter>
        </defs>
        <text x="50" y="23" textAnchor="middle">{number}</text>
      </svg>

      <svg className="orb-ticker" viewBox="0 0 100 38" role="img" aria-label={ticker}>
        <defs>
          <linearGradient id="orb-ticker-gradient" x1="50" y1="12" x2="50" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor={`color-mix(in srgb, ${palette.base} 14%, #101722)`} />
            <stop offset="1" stopColor={`color-mix(in srgb, ${palette.base} 8%, #03070e)`} />
          </linearGradient>
        </defs>
        <text className="orb-ticker-chip" x="50" y="19" dy="-.5" textAnchor="middle" dominantBaseline="middle">{ticker}</text>
        <text className="orb-ticker-face" x="50" y="19" textAnchor="middle" dominantBaseline="middle" fill={whiteText ? "#fff" : "url(#orb-ticker-gradient)"}>{ticker}</text>
      </svg>
    </div>
  );
}

export default function Home() {
  const [ticker, setTicker] = useState("NTNDO");
  const [number, setNumber] = useState("3325");
  const [palette, setPalette] = useState<Palette>(() => deriveOrbPalette("#ec009e"));
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

  return (
    <main className="generator-shell">
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
    </main>
  );
}
