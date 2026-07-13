"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TickerOrb,
  createMarketOrbDefinition,
  deriveOrbPalette,
  type OrbPalette,
} from "@/components/orb";
import { hslToHex } from "@/components/orb/color";
import { listings } from "./listings";

type View = "generator" | "listings" | "blotter";
type Position = {
  side: "LONG" | "SHORT";
  size: number;
  entry: number;
  mark: number;
  leverage: number;
};

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
  return hslToHex({
    h: (hash + index * 47) % 360,
    s: 1,
    l: 0.5,
  });
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

const previousReferenceGalleryColourSeeds = [
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

function previousReferenceColourForListing(_label: string, index: number) {
  return previousReferenceGalleryColourSeeds[index % previousReferenceGalleryColourSeeds.length];
}

const previousMarketAgnosticGalleryColourSeeds = [
  "#ff0099",
  "#00ffff",
  "#9dff00",
  "#ff00c8",
  "#ffd000",
  "#00ffb2",
  "#ff003d",
  "#00eaff",
  "#00ff66",
  "#ff00a8",
  "#00ffd5",
  "#b7ff00",
  "#ff006e",
  "#fff000",
  "#00f0ff",
  "#ff00b8",
];

function previousMarketAgnosticColourForListing(index: number) {
  return previousMarketAgnosticGalleryColourSeeds[index % previousMarketAgnosticGalleryColourSeeds.length];
}

const initialGalleryOrbs = listings.map((listing) => ({
  ...listing,
  number: listing.exchangeTicker.padStart(4, "0").slice(-4),
  palette: createMarketOrbDefinition({
    ticker: listing.ticker,
    number: listing.exchangeTicker.padStart(4, "0").slice(-4),
    market: listing.market,
    stableKey: listing.exchangeTicker,
  }).palette,
}));

type GalleryOrb = (typeof initialGalleryOrbs)[number];

const leverageOptions = [2, 3, 5, 8, 10, 15, 20, 23];

function createPosition(listing: GalleryOrb, index: number): Position {
  const hash = listingHash(`${listing.company}-${listing.exchangeTicker}`);
  const side = ((hash >>> 4) + index) % 5 < 2 ? "SHORT" : "LONG";
  const entry = 18 + ((hash >>> 7) % 28000) / 100;
  const move = (((hash >>> 19) % 901) - 450) / 10000;
  return {
    side,
    size: 25 + ((hash >>> 12) % 975),
    entry,
    mark: Math.max(0.01, entry * (1 + move)),
    leverage: leverageOptions[(hash + index) % leverageOptions.length],
  };
}

function marketLabel(market: GalleryOrb["market"]) {
  if (market === "KR") return "KRX";
  if (market === "JP") return "TSE";
  return "HKEX";
}

type OrbDraft = OrbPalette & { ticker: string; number: string };
const galleryStorageKey = "hudi-gallery-orbs-v1";
const themeStorageKey = "hudi-orb-theme";
const marketPaletteStorageKey = "hudi-gallery-market-palette-v1";

function storedColour(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function Blotter({ items, positions }: { items: GalleryOrb[]; positions: Position[] }) {
  return (
    <section className="blotter-page" aria-label="Orb positions blotter">
      <h1 className="visually-hidden">Orb positions blotter</h1>
      <div className="blotter-window">
        <div className="blotter-tabs" role="tablist" aria-label="Blotter sections">
          <button type="button" role="tab" aria-selected="true">Positions</button>
          <button type="button" role="tab" aria-selected="false">Orders</button>
          <button type="button" role="tab" aria-selected="false">Funding</button>
          <button type="button" role="tab" aria-selected="false">History</button>
        </div>
        <div className="blotter-scroll">
          <table className="blotter-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Side</th>
                <th className="is-number">Size</th>
                <th className="is-number">Entry</th>
                <th className="is-number">Mark</th>
                <th>Leverage</th>
                <th className="is-number">PnL</th>
                <th><span className="visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const position = positions[index] ?? createPosition(item, index);
                const direction = position.side === "LONG" ? 1 : -1;
                const pnl = (position.mark - position.entry) * position.size * direction;
                const pnlPercent = ((position.mark - position.entry) / position.entry) * 100 * position.leverage * direction;
                const pnlClass = pnl >= 0 ? "is-positive" : "is-negative";
                return (
                  <tr key={`${item.market}-${item.exchangeTicker}`}>
                    <td>
                      <div className="blotter-asset">
                        <div className="blotter-asset-orb" aria-hidden="true">
                          <TickerOrb ticker={item.ticker} number={item.number} palette={item.palette} size={24} compact decorative />
                        </div>
                        <span className="blotter-company">{item.company}</span>
                        <span className="blotter-market">{marketLabel(item.market)}</span>
                      </div>
                    </td>
                    <td><span className={`blotter-pill is-${position.side.toLowerCase()}`}>{position.side}</span></td>
                    <td className="is-number">{position.size.toFixed(2)}</td>
                    <td className="is-number">${position.entry.toFixed(2)}</td>
                    <td className="is-number is-live">${position.mark.toFixed(2)}</td>
                    <td><span className={`blotter-pill is-leverage is-${position.side.toLowerCase()}`}>{position.leverage}x</span></td>
                    <td className={`is-number blotter-pnl ${pnlClass}`}>
                      <span>{pnl.toFixed(2)}</span>
                      <span>{pnlPercent.toFixed(1)}%</span>
                    </td>
                    <td><button className="blotter-close" type="button">Close</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("generator");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ticker, setTicker] = useState("NTNDO");
  const [number, setNumber] = useState("3325");
  const [palette, setPalette] = useState<OrbPalette>(() => deriveOrbPalette("#ff00aa"));
  const [galleryItems, setGalleryItems] = useState(initialGalleryOrbs);
  const [positions, setPositions] = useState<Position[]>(() => initialGalleryOrbs.map(createPosition));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<OrbDraft>({
    ticker: "",
    number: "",
    ...deriveOrbPalette("#ff0000"),
  });
  const draftPalette = useMemo<OrbPalette>(() => ({
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
  const changeView = (nextView: View) => {
    setView(nextView);
    const hash = nextView === "listings" ? "#tickers" : nextView === "blotter" ? "#blotter" : "#generator";
    window.history.replaceState(null, "", hash);
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
  const updateDraftColour = (key: keyof OrbPalette, colour: string) => {
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
    if (window.location.hash === "#blotter") setView("blotter");
    const storedTheme = window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
    setTheme(storedTheme);
    document.documentElement.dataset.theme = storedTheme;

    try {
      const storedOrbs = JSON.parse(window.localStorage.getItem(galleryStorageKey) || "[]") as Partial<OrbDraft>[];
      const shouldApplyMarketPalette = window.localStorage.getItem(marketPaletteStorageKey) !== "1";
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
          const previousReferenceDefault = deriveOrbPalette(previousReferenceColourForListing(item.company, index));
          const previousMarketAgnosticDefault = deriveOrbPalette(previousMarketAgnosticColourForListing(index));
          const isGeneratedDefault = (["colour", "base", "sheen", "shadow"] as const)
            .every((key) => {
              const value = storedPalette[key].toLowerCase();
              return value === previousDefault[key].toLowerCase()
                || value === previousCuratedDefault[key].toLowerCase()
                || value === previousReferenceDefault[key].toLowerCase()
                || value === previousMarketAgnosticDefault[key].toLowerCase();
            });
          return {
            ...item,
            ticker: stored.ticker.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || item.ticker,
            number: stored.number.replace(/\D/g, "").slice(0, 4).padStart(4, "0"),
            palette: shouldApplyMarketPalette || isGeneratedDefault ? item.palette : storedPalette,
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
        window.localStorage.setItem(marketPaletteStorageKey, "1");
      }
    } catch {
      window.localStorage.removeItem(galleryStorageKey);
    }
  }, []);

  useEffect(() => {
    if (view !== "blotter") return;
    const interval = window.setInterval(() => {
      setPositions((current) => current.map((position) => ({
        ...position,
        mark: Math.max(0.01, position.mark * (1 + (Math.random() - 0.5) * 0.006)),
      })));
    }, 1800);
    return () => window.clearInterval(interval);
  }, [view]);

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
    <main className={`generator-shell${view === "listings" ? " is-listings-view" : ""}${view === "blotter" ? " is-blotter-view" : ""}`}>
      <nav className="view-toggle" aria-label="Orb page">
        <button type="button" aria-pressed={view === "generator"} onClick={() => changeView("generator")}>generator</button>
        <button type="button" aria-pressed={view === "listings"} onClick={() => changeView("listings")}>tickers</button>
        <button type="button" aria-pressed={view === "blotter"} onClick={() => changeView("blotter")}>blotter</button>
        <button type="button" aria-pressed={theme === "dark"} onClick={toggleTheme}>dark</button>
      </nav>

      {view === "generator" && (
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
      )}

      {view === "listings" && (
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
                  <TickerOrb ticker={listing.ticker} number={listing.number} palette={listing.palette} size="var(--gallery-orb-size)" compact />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {view === "blotter" && <Blotter items={galleryItems} positions={positions} />}

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
              <TickerOrb ticker={draft.ticker || "ORB"} number={draft.number || "0000"} palette={draftPalette} compact decorative />
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
