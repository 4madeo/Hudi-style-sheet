"use client";

import { useMemo, useState } from "react";

type Palette = { name: string; base: string; sheen: string; shadow: string };

const presets: Palette[] = [
  { name: "Blue", base: "#00c8ff", sheen: "#00ffd5", shadow: "#0040b0" },
  { name: "Pink", base: "#ff00c8", sheen: "#ff7dec", shadow: "#860062" },
  { name: "Yellow", base: "#ffe100", sheen: "#ffff86", shadow: "#9e7600" },
  { name: "Green", base: "#00f0b0", sheen: "#9bffdf", shadow: "#00845c" },
];

const sizes = [
  { name: "big", px: 240 },
  { name: "medium", px: 120 },
  { name: "small", px: 43.2 },
  { name: "tiny", px: 21.6 },
];

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
}

function mixWithWhite(hex: string, amount = 0.61) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * amount)}, ${Math.round(g + (255 - g) * amount)}, ${Math.round(b + (255 - b) * amount)})`;
}

function Orb({ size, ticker, number, palette }: { size: number; ticker: string; number: string; palette: Palette }) {
  const id = `${size}-${ticker}-${number}`.replace(/[^a-zA-Z0-9-]/g, "");
  const tickerScale = Math.max(0.72, Math.min(1.68, 5 / Math.max(1, ticker.length)));
  return (
    <div
      className="orb"
      style={{
        "--orb-size": `${size}px`,
        "--orb-base": palette.base,
        "--orb-sheen": palette.sheen,
        "--orb-shadow": palette.shadow,
        "--orb-inner": mixWithWhite(palette.base),
        "--ticker-scale": tickerScale,
      } as React.CSSProperties}
    >
      <svg className="orb-number" viewBox="0 0 100 32" aria-hidden="true">
        <path id={`curve-${id}`} d="M 27 24 A 57.5 57.5 0 0 1 73 24" fill="none" />
        <text textAnchor="middle"><textPath href={`#curve-${id}`} startOffset="50%">{number}</textPath></text>
      </svg>
      <span className="orb-ticker">{ticker}</span>
    </div>
  );
}

export default function Home() {
  const [ticker, setTicker] = useState("ABCDE");
  const [number, setNumber] = useState("1234");
  const [palette, setPalette] = useState<Palette>(presets[0]);
  const [copied, setCopied] = useState(false);
  const css = useMemo(() => `.hudi-stock-orb {\n  --orb-base: ${palette.base};\n  --orb-sheen: ${palette.sheen};\n  --orb-shadow: rgba(${Object.values(hexToRgb(palette.shadow)).join(", ")}, .4);\n  --orb-size: 120px; /* 240 / 120 / 43.2 / 21.6 */\n}`, [palette]);

  const setColor = (key: "base" | "sheen" | "shadow", value: string) => setPalette((current) => ({ ...current, name: "Custom", [key]: value }));
  const copyCss = async () => { await navigator.clipboard.writeText(css); setCopied(true); window.setTimeout(() => setCopied(false), 1400); };

  return (
    <main>
      <header className="site-header"><a className="brand" href="#top">HUDI / ORB</a><span>isolated generator · v1</span></header>
      <section className="hero" id="top">
        <div><p className="eyebrow">KITCHEN SINK / TICKER ORBS</p><h1>Orb generator</h1><p className="intro">Create Hudi ticker orbs with the original material, palette logic, typography treatment, and all four canonical sizes.</p></div>
        <button className="copy-button" onClick={copyCss}>{copied ? "Copied" : "Copy current CSS"}</button>
      </section>

      <section className="workspace" aria-label="Orb generator">
        <div className="preview-panel">
          <div className="panel-label"><span>LIVE PREVIEW</span><span>4 SIZES</span></div>
          <div className="orb-grid">
            {sizes.map((size) => <div className={`orb-sample ${size.name}`} key={size.name}><span className="size-name">{size.name}</span><Orb size={size.px} ticker={ticker} number={number} palette={palette} /><span className="size-value">{size.px}px</span></div>)}
          </div>
        </div>

        <aside className="controls">
          <div className="control-block"><p className="control-title">PALETTE</p><div className="presets">{presets.map((preset) => <button key={preset.name} className="preset" aria-label={`${preset.name} orb`} aria-pressed={palette.name === preset.name} onClick={() => setPalette(preset)} style={{ "--preset-base": preset.base, "--preset-sheen": preset.sheen } as React.CSSProperties} />)}</div></div>
          <div className="field-row"><label><span>TICKER</span><input value={ticker} maxLength={7} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/\s/g, ""))} /></label><label><span>NUMBER</span><input value={number} maxLength={8} onChange={(e) => setNumber(e.target.value.replace(/\s/g, ""))} /></label></div>
          <div className="control-block"><p className="control-title">MATERIAL TOKENS</p>{(["base", "sheen", "shadow"] as const).map((key) => <label className="color-row" key={key}><span><i style={{ background: palette[key] }} />--orb-{key}</span><code>{palette[key]}</code><input type="color" value={palette[key]} onChange={(e) => setColor(key, e.target.value)} /></label>)}</div>
          <div className="token-note"><span>SHADOW ALPHA</span><code>40%</code></div>
          <div className="token-note"><span>TEXT INNER MIX</span><code>base + white 61%</code></div>
        </aside>
      </section>

      <footer><span>Adapted from 4madeo / Hudi-style-sheet</span><a href="https://github.com/4madeo/Hudi-style-sheet" target="_blank" rel="noreferrer">View source ↗</a></footer>
    </main>
  );
}
