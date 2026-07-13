"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TickerOrb,
  createMarketOrbDefinition,
  deriveOrbPalette,
  type OrbPalette,
} from "@/components/orb";
import { CompanyHeader, type CompanyHeaderStat } from "@/components/header";
import { hslToHex } from "@/components/orb/color";
import { listings } from "./listings";

type View = "generator" | "listings" | "blotter" | "header";
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

function galleryKey(item: Pick<GalleryOrb, "market" | "exchangeTicker">) {
  return `${item.market}-${item.exchangeTicker}`;
}

function formatSignedCurrency(value: number) {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function createHeaderStats(item: GalleryOrb, position: Position): CompanyHeaderStat[] {
  const hash = listingHash(`${item.market}-${item.exchangeTicker}-header`);
  const indexOffset = (((hash >>> 3) % 121) - 60) / 10000;
  const index = position.mark * (1 + indexOffset);
  const volume = 18 + ((hash >>> 9) % 1250) / 10;
  const openInterest = 90 + ((hash >>> 16) % 5200) / 10;
  const funding = (((hash >>> 23) % 61) - 30) / 1000;
  return [
    { label: "Mark", value: `$${position.mark.toFixed(2)}` },
    { label: "Index", value: `$${index.toFixed(2)}` },
    { label: "24h Vol", value: `$${volume.toFixed(1)}M` },
    { label: "Open Interest", value: `${openInterest.toFixed(1)}M` },
    { label: "Funding", value: `${funding >= 0 ? "+" : "−"}${Math.abs(funding).toFixed(3)}%` },
  ];
}

function createHeaderChange(item: GalleryOrb, mark: number) {
  const seed = listingHash(`${item.exchangeTicker}-daily`) % 901;
  const percent = (seed - 300) / 20;
  return {
    amount: mark * (percent / 100),
    percent,
  };
}

type OrbDraft = OrbPalette & { ticker: string; number: string };
type StoredOrbDraft = Partial<OrbDraft> & { key?: string };
const galleryStorageKey = "hudi-gallery-orbs-v1";
const themeStorageKey = "hudi-orb-theme";
const marketPaletteStorageKey = "hudi-gallery-market-palette-v1";

function storedColour(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

type BlotterProps = {
  items: GalleryOrb[];
  positions: Position[];
  selectedKey?: string;
  onSelect?: (item: GalleryOrb) => void;
};

function Blotter({ items, positions, selectedKey, onSelect }: BlotterProps) {
  const isPicker = Boolean(onSelect);
  return (
    <section className={`blotter-page${isPicker ? " is-picker" : ""}`} aria-label={isPicker ? "Choose a ticker from the blotter" : "Orb positions blotter"}>
      <h1 className="visually-hidden">{isPicker ? "Choose a ticker" : "Orb positions blotter"}</h1>
      <div className="blotter-window">
        <div className="blotter-tabs" role="tablist" aria-label="Blotter sections">
          <button type="button" role="tab" aria-selected="true">Positions</button>
          <button type="button" role="tab" aria-selected="false" disabled>Orders</button>
          <button type="button" role="tab" aria-selected="false" disabled>Funding</button>
          <button type="button" role="tab" aria-selected="false" disabled>History</button>
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
                const itemKey = galleryKey(item);
                const asset = (
                  <>
                    <div className="blotter-asset-orb" aria-hidden="true">
                      <TickerOrb ticker={item.ticker} number={item.number} palette={item.palette} size={24} compact decorative />
                    </div>
                    <span className="blotter-company">{item.company}</span>
                    <span className="blotter-market">{marketLabel(item.market)}</span>
                  </>
                );
                return (
                  <tr
                    className={isPicker ? "is-selectable" : undefined}
                    data-selected={selectedKey === itemKey || undefined}
                    key={itemKey}
                    onClick={isPicker ? () => onSelect?.(item) : undefined}
                  >
                    <td>
                      {isPicker ? (
                        <button
                          className="blotter-asset blotter-asset-select"
                          type="button"
                          aria-label={`Use ${item.company}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect?.(item);
                          }}
                        >
                          {asset}
                        </button>
                      ) : <div className="blotter-asset">{asset}</div>}
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
                    <td>
                      <button
                        className="blotter-close"
                        type="button"
                        onClick={isPicker ? (event) => {
                          event.stopPropagation();
                          onSelect?.(item);
                        } : undefined}
                      >
                        {isPicker ? "Select" : "Close"}
                      </button>
                    </td>
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

function HeaderTickerSelector({
  items,
  positions,
  selectedKey,
  onSelect,
  onClose,
}: BlotterProps & { selectedKey: string; onSelect: (item: GalleryOrb) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);

  const keepFocusInDialog = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="header-selector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={dialogRef}
        className="header-selector-dialog"
        id="header-ticker-selector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="header-selector-title"
        onKeyDown={keepFocusInDialog}
      >
        <header className="header-selector-heading">
          <div>
            <p>market universe</p>
            <h2 id="header-selector-title">select ticker</h2>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Close ticker selector">×</button>
        </header>
        <Blotter items={items} positions={positions} selectedKey={selectedKey} onSelect={onSelect} />
      </section>
    </div>
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
  const [selectedHeaderKey, setSelectedHeaderKey] = useState("KR-005930");
  const [headerPickerOpen, setHeaderPickerOpen] = useState(false);
  const headerPickerTriggerRef = useRef<HTMLButtonElement>(null);
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
  const selectedHeaderIndex = Math.max(0, galleryItems.findIndex((item) => galleryKey(item) === selectedHeaderKey));
  const selectedHeaderItem = galleryItems[selectedHeaderIndex] ?? initialGalleryOrbs[0];
  const selectedHeaderPosition = positions[selectedHeaderIndex] ?? createPosition(selectedHeaderItem, selectedHeaderIndex);
  const selectedHeaderChange = createHeaderChange(selectedHeaderItem, selectedHeaderPosition.mark);
  const selectedHeaderStats = useMemo(
    () => createHeaderStats(selectedHeaderItem, selectedHeaderPosition),
    [selectedHeaderItem, selectedHeaderPosition],
  );

  const updateColour = (colour: string) => setPalette(deriveOrbPalette(colour));
  const updateToken = (key: "base" | "sheen" | "shadow", value: string) => {
    setPalette((current) => ({ ...current, [key]: value }));
  };
  const changeView = (nextView: View) => {
    setView(nextView);
    setHeaderPickerOpen(false);
    const hashes: Record<View, string> = {
      generator: "#generator",
      listings: "#tickers",
      blotter: "#blotter",
      header: "#header",
    };
    const hash = hashes[nextView];
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
  const closeHeaderPicker = () => {
    setHeaderPickerOpen(false);
    window.requestAnimationFrame(() => headerPickerTriggerRef.current?.focus());
  };
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
      key: galleryKey(item),
      ticker: item.ticker,
      number: item.number,
      colour: item.palette.colour,
      base: item.palette.base,
      sheen: item.palette.sheen,
      shadow: item.palette.shadow,
    }))));
    closeEditor();
  };

  /* eslint-disable react-hooks/set-state-in-effect -- this mount pass hydrates browser URL and persisted UI state. */
  useEffect(() => {
    if (window.location.hash === "#tickers") setView("listings");
    if (window.location.hash === "#blotter") setView("blotter");
    if (window.location.hash === "#header") setView("header");
    const storedTheme = window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
    setTheme(storedTheme);
    document.documentElement.dataset.theme = storedTheme;

    try {
      const storedOrbs = JSON.parse(window.localStorage.getItem(galleryStorageKey) || "[]") as StoredOrbDraft[];
      const shouldApplyMarketPalette = window.localStorage.getItem(marketPaletteStorageKey) !== "1";
      if (Array.isArray(storedOrbs)) {
        const storedByKey = new Map(storedOrbs.flatMap((stored) => (
          typeof stored.key === "string" ? [[stored.key, stored] as const] : []
        )));
        const hasStableKeys = storedByKey.size > 0;
        const restoredItems = initialGalleryOrbs.map((item, index) => {
          const stored = storedByKey.get(galleryKey(item)) ?? (!hasStableKeys ? storedOrbs[index] : undefined);
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
          key: galleryKey(item),
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
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (view !== "blotter" && view !== "header") return;
    const interval = window.setInterval(() => {
      setPositions((current) => current.map((position) => ({
        ...position,
        mark: Math.max(0.01, position.mark * (1 + (Math.random() - 0.5) * 0.006)),
      })));
    }, 1800);
    return () => window.clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (editingIndex === null && !headerPickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditingIndex(null);
        setHeaderPickerOpen(false);
        if (headerPickerOpen) {
          window.requestAnimationFrame(() => headerPickerTriggerRef.current?.focus());
        }
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingIndex, headerPickerOpen]);

  return (
    <main className={`generator-shell${view === "listings" ? " is-listings-view" : ""}${view === "blotter" ? " is-blotter-view" : ""}${view === "header" ? " is-header-view" : ""}`}>
      <nav className="view-toggle" aria-label="Orb page">
        <button type="button" aria-pressed={view === "generator"} onClick={() => changeView("generator")}>generator</button>
        <button type="button" aria-pressed={view === "listings"} onClick={() => changeView("listings")}>tickers</button>
        <button type="button" aria-pressed={view === "blotter"} onClick={() => changeView("blotter")}>blotter</button>
        <button type="button" aria-pressed={view === "header"} onClick={() => changeView("header")}>header</button>
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

      {view === "header" && (
        <section className="header-page" aria-label="Selected ticker header preview">
          <CompanyHeader
            company={selectedHeaderItem.company}
            market={marketLabel(selectedHeaderItem.market)}
            ticker={selectedHeaderItem.ticker}
            number={selectedHeaderItem.number}
            palette={selectedHeaderItem.palette}
            price={`$${selectedHeaderPosition.mark.toFixed(2)}`}
            change={formatSignedCurrency(selectedHeaderChange.amount)}
            changePercent={`${selectedHeaderChange.percent >= 0 ? "+" : "−"}${Math.abs(selectedHeaderChange.percent).toFixed(1)}%`}
            changePositive={selectedHeaderChange.percent >= 0}
            stats={selectedHeaderStats}
            pickerOpen={headerPickerOpen}
            pickerButtonRef={headerPickerTriggerRef}
            onOpenPicker={() => setHeaderPickerOpen(true)}
          />
        </section>
      )}

      {headerPickerOpen && (
        <HeaderTickerSelector
          items={galleryItems}
          positions={positions}
          selectedKey={galleryKey(selectedHeaderItem)}
          onClose={closeHeaderPicker}
          onSelect={(item) => {
            setSelectedHeaderKey(galleryKey(item));
            closeHeaderPicker();
          }}
        />
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
