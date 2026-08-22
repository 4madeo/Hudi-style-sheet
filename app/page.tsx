"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  LogoOrb,
  createLogoDevUrl,
  deriveOrbPalette,
  type LogoTreatment,
  type OrbPalette,
} from "@/components/orb";
import { CompanyHeader, type CompanyHeaderStat } from "@/components/header";
import {
  ORB_EXPORT_SCALES,
  createLogoOrbSvg,
  type OrbExportScaleName,
} from "@/components/orb/svg";
import { createZipBlob } from "@/lib/zip";
import logoAssetManifest from "@/public/logos/manifest.json";
import brandColourManifest from "@/public/logos/brand-colours.json";
import { listings } from "./listings";

type View = "generator" | "listings" | "catalog" | "crypto" | "blotter" | "header";
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

const logoDevFormat = process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT === "png"
  || process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT === "webp"
  || process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT === "jpg"
  ? process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT
  : "svg";
const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
const localLogoAssets = logoAssetManifest as Record<string, {
  path: string;
  format: "svg" | "png";
}>;
const localBrandColours = brandColourManifest as Record<string, { orbColour: string }>;

const initialGalleryOrbs = listings.map((listing) => ({
  ...listing,
  logoUrl: localLogoAssets[listing.symbol]?.path ?? createLogoDevUrl(listing.logoDomain, {
    format: logoDevFormat,
    token: logoDevToken,
  }),
  palette: deriveOrbPalette(localBrandColours[listing.symbol]?.orbColour ?? "#394150"),
}));

type GalleryOrb = (typeof initialGalleryOrbs)[number];

type CatalogLogo = {
  path: string;
  orbColour: string;
  orbColourSeed?: string;
  orbColourSource?: "manual-override" | "simple-icons-brand" | "logo-derived" | "removed-background" | "verified-family" | "neutral-fallback";
  orbColourSourceRef?: string;
  orbColourSourceUrl?: string;
  logoTreatment: LogoTreatment;
  logoScale: number;
  cropMode: "curated-emblem" | "curated-mark" | "auto-emblem" | "full-mark";
};

type CatalogEntry = {
  id: string;
  exchange: string;
  symbol: string;
  company: string;
  sector: string;
  cmcRank?: number;
  logo: CatalogLogo | null;
  logoStatus?: "missing" | "failed" | "low-resolution" | "duplicate-review" | "source-review";
};

type CatalogManifest = {
  rowCount: number;
  summary: {
    reference: number;
    ticker: number;
    name: number;
    missing: number;
    failed: number;
    duplicateReview?: number;
    sourceReview?: number;
  };
  entries: CatalogEntry[];
};

type CatalogReviewEntry = {
  id: string;
  reason: "visual-mismatch" | "name-lookup" | "unreadable" | "low-resolution" | "empty-geometric-mark";
  similarity?: number;
};

type CatalogReviewIndex = {
  summary: { total: number };
  entries: CatalogReviewEntry[];
};

const leverageOptions = [2, 3, 5, 8, 10, 15, 20, 23];
const orbExportScaleNames = Object.keys(ORB_EXPORT_SCALES) as OrbExportScaleName[];

function exportFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "orb";
}

function googleLogoSearchUrl(entry: CatalogEntry) {
  const query = `"${entry.company}" company logo ${entry.exchange} ${entry.symbol}`;
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

function fallbackOrbColour(key: string) {
  const colours = ["#3867d6", "#6657d9", "#a646d4", "#d13f78", "#d75a34", "#168c87", "#397f4a", "#47657f"];
  return colours[listingHash(key) % colours.length];
}

function randomSample<T>(items: T[], count: number) {
  const sample = [...items];
  const sampleSize = Math.min(count, sample.length);
  for (let index = 0; index < sampleSize; index += 1) {
    const randomIndex = index + Math.floor(Math.random() * (sample.length - index));
    [sample[index], sample[randomIndex]] = [sample[randomIndex], sample[index]];
  }
  return sample.slice(0, sampleSize);
}

function catalogReviewLabel(review: CatalogReviewEntry) {
  if (review.reason === "visual-mismatch" && typeof review.similarity === "number") {
    return `${Math.round(review.similarity * 100)}% cross-check`;
  }
  if (review.reason === "name-lookup") return "name lookup";
  if (review.reason === "low-resolution") return "low resolution";
  if (review.reason === "empty-geometric-mark") return "empty geometric mark";
  return "unreadable";
}

function catalogSearchTokens(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isNearbyCatalogToken(query: string, candidate: string) {
  if (candidate.includes(query)) return true;
  if (query.length < 4 || Math.abs(query.length - candidate.length) > 1) return false;

  if (query.length === candidate.length) {
    const mismatches = [];
    for (let index = 0; index < query.length; index += 1) {
      if (query[index] !== candidate[index]) mismatches.push(index);
      if (mismatches.length > 2) return false;
    }
    if (mismatches.length === 1) return true;
    return mismatches.length === 2
      && mismatches[1] === mismatches[0] + 1
      && query[mismatches[0]] === candidate[mismatches[1]]
      && query[mismatches[1]] === candidate[mismatches[0]];
  }

  const [shorter, longer] = query.length < candidate.length
    ? [query, candidate]
    : [candidate, query];
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
    } else if (!skipped) {
      skipped = true;
      longIndex += 1;
    } else {
      return false;
    }
  }
  return true;
}

function catalogEntryMatchKind(entry: CatalogEntry, query: string): "exact" | "suggestion" | null {
  const values = [entry.symbol, entry.company, entry.exchange, entry.sector]
    .map((value) => value.toLocaleLowerCase());
  const queryTokens = catalogSearchTokens(query);
  const candidateTokens = values.flatMap(catalogSearchTokens);
  if (values.some((value) => value.includes(query)) || (
    queryTokens.length > 0
    && queryTokens.every((queryToken) => candidateTokens.some((candidateToken) => candidateToken.includes(queryToken)))
  )) return "exact";
  if (queryTokens.length > 0 && queryTokens.every((queryToken) => (
    candidateTokens.some((candidateToken) => isNearbyCatalogToken(queryToken, candidateToken))
  ))) return "suggestion";
  return null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read Logo.dev response"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function loadSvgImage(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const svgUrl = window.URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

    image.onload = () => {
      window.URL.revokeObjectURL(svgUrl);
      resolve(image);
    };
    image.onerror = () => {
      window.URL.revokeObjectURL(svgUrl);
      reject(new Error("Unable to rasterize orb SVG"));
    };
    image.src = svgUrl;
  });
}

async function createOrbPng(svg: string, size: number) {
  const image = await loadSvgImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable");
  context.drawImage(image, 0, 0, size, size);

  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode orb PNG"));
    }, "image/png");
  });
  return new Uint8Array(await png.arrayBuffer());
}

async function fetchLogoAsset(item: GalleryOrb) {
  const response = await window.fetch(item.logoUrl);
  if (!response.ok) throw new Error(`Logo.dev returned ${response.status} for ${item.company}`);
  return blobToDataUrl(await response.blob());
}

function createPosition(listing: GalleryOrb, index: number): Position {
  const hash = listingHash(`${listing.company}-${listing.symbol}`);
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

function galleryKey(item: Pick<GalleryOrb, "symbol">) {
  return item.symbol;
}

function formatSignedCurrency(value: number) {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function createHeaderStats(item: GalleryOrb, position: Position): CompanyHeaderStat[] {
  const hash = listingHash(`${item.exchange}-${item.symbol}-header`);
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
  const seed = listingHash(`${item.symbol}-daily`) % 901;
  const percent = (seed - 300) / 20;
  return {
    amount: mark * (percent / 100),
    percent,
  };
}

type OrbDraft = OrbPalette & {
  logoDomain: string;
  logoScale: number;
  logoTreatment: LogoTreatment;
};
type StoredOrbDraft = Partial<OrbDraft> & { key?: string };
const galleryStorageKey = "hudi-logo-orbs-v2";
const themeStorageKey = "hudi-orb-theme";

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
                      <LogoOrb
                        company={item.company}
                        logoUrl={item.logoUrl}
                        logoTreatment={item.logoTreatment}
                        logoScale={item.logoScale}
                        palette={item.palette}
                        size={24}
                        compact
                        decorative
                      />
                    </div>
                    <span className="blotter-company">{item.company}</span>
                    <span className="blotter-market">{item.exchange}</span>
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
  const generatorDefault = initialGalleryOrbs.find((item) => item.symbol === "NVDA") ?? initialGalleryOrbs[0];
  const [view, setView] = useState<View>("generator");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [generatorSymbol, setGeneratorSymbol] = useState(generatorDefault.symbol);
  const [palette, setPalette] = useState<OrbPalette>(generatorDefault.palette);
  const [logoScale, setLogoScale] = useState(generatorDefault.logoScale ?? 0.58);
  const [logoTreatment, setLogoTreatment] = useState<LogoTreatment>(generatorDefault.logoTreatment ?? "original");
  const [galleryItems, setGalleryItems] = useState(initialGalleryOrbs);
  const [positions, setPositions] = useState<Position[]>(() => initialGalleryOrbs.map(createPosition));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedHeaderKey, setSelectedHeaderKey] = useState("SAMSUNG");
  const [headerPickerOpen, setHeaderPickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [catalog, setCatalog] = useState<CatalogManifest | null>(null);
  const [cryptoCatalog, setCryptoCatalog] = useState<CatalogManifest | null>(null);
  const [catalogReview, setCatalogReview] = useState<CatalogReviewIndex | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [cryptoCatalogError, setCryptoCatalogError] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogVisibleCount, setCatalogVisibleCount] = useState(180);
  const [catalogRandomEntries, setCatalogRandomEntries] = useState<CatalogEntry[] | null>(null);
  const [catalogIssuesOnly, setCatalogIssuesOnly] = useState(false);
  const headerPickerTriggerRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<OrbDraft>({
    logoDomain: "",
    logoScale: 0.58,
    logoTreatment: "original",
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
  const generatorItem = galleryItems.find((item) => item.symbol === generatorSymbol) ?? galleryItems[0];
  const generatorLogoUrl = generatorItem.logoUrl;
  const selectedHeaderPosition = positions[selectedHeaderIndex] ?? createPosition(selectedHeaderItem, selectedHeaderIndex);
  const selectedHeaderChange = createHeaderChange(selectedHeaderItem, selectedHeaderPosition.mark);
  const selectedHeaderStats = useMemo(
    () => createHeaderStats(selectedHeaderItem, selectedHeaderPosition),
    [selectedHeaderItem, selectedHeaderPosition],
  );
  const catalogReviewById = useMemo(() => new Map(
    catalogReview?.entries.map((entry) => [entry.id, entry]) ?? [],
  ), [catalogReview]);
  const catalogReviewRankById = useMemo(() => new Map(
    catalogReview?.entries.map((entry, index) => [entry.id, index]) ?? [],
  ), [catalogReview]);
  const activeCatalog = view === "crypto" ? cryptoCatalog : catalog;
  const catalogMatchGroups = useMemo(() => {
    if (!activeCatalog) return { exact: [], suggestions: [], all: [] };
    const query = catalogQuery.trim().toLocaleLowerCase();
    const exact: CatalogEntry[] = [];
    const suggestions: CatalogEntry[] = [];
    activeCatalog.entries.forEach((entry) => {
      if (view === "catalog" && catalogIssuesOnly && (!entry.logo || !catalogReviewById.has(entry.id))) return;
      const matchKind = query ? catalogEntryMatchKind(entry, query) : "exact";
      if (matchKind === "exact") exact.push(entry);
      if (matchKind === "suggestion") suggestions.push(entry);
    });
    if (view === "catalog" && catalogIssuesOnly) {
      const sortByReviewRank = (left: CatalogEntry, right: CatalogEntry) => (
        (catalogReviewRankById.get(left.id) ?? Number.POSITIVE_INFINITY)
        - (catalogReviewRankById.get(right.id) ?? Number.POSITIVE_INFINITY)
      );
      exact.sort(sortByReviewRank);
      suggestions.sort(sortByReviewRank);
    }
    return { exact, suggestions, all: [...exact, ...suggestions] };
  }, [activeCatalog, catalogIssuesOnly, catalogQuery, catalogReviewById, catalogReviewRankById, view]);
  const catalogMatches = catalogMatchGroups.all;
  const visibleCatalogEntries = catalogRandomEntries ?? catalogMatches.slice(0, catalogVisibleCount);
  const catalogSuggestionIds = useMemo(
    () => new Set(catalogMatchGroups.suggestions.map((entry) => entry.id)),
    [catalogMatchGroups.suggestions],
  );
  const visibleExactCatalogEntries = visibleCatalogEntries.filter((entry) => !catalogSuggestionIds.has(entry.id));
  const visibleSuggestedCatalogEntries = visibleCatalogEntries.filter((entry) => catalogSuggestionIds.has(entry.id));

  const updateColour = (colour: string) => setPalette(deriveOrbPalette(colour));
  const updateToken = (key: "base" | "sheen" | "shadow", value: string) => {
    setPalette((current) => ({ ...current, [key]: value }));
  };
  const selectGeneratorOrb = (symbol: string) => {
    const item = galleryItems.find((candidate) => candidate.symbol === symbol);
    if (!item) return;
    setGeneratorSymbol(item.symbol);
    setPalette(item.palette);
    setLogoScale(item.logoScale ?? 0.58);
    setLogoTreatment(item.logoTreatment ?? "original");
  };
  const showRandomCatalogEntries = () => {
    if (!catalogMatches.length) return;
    setCatalogVisibleCount(180);
    setCatalogRandomEntries(randomSample(catalogMatches, 180));
  };
  const toggleCatalogIssues = () => {
    setCatalogIssuesOnly((current) => !current);
    setCatalogVisibleCount(180);
    setCatalogRandomEntries(null);
  };
  const changeView = (nextView: View) => {
    setView(nextView);
    setHeaderPickerOpen(false);
    setCatalogRandomEntries(null);
    setCatalogVisibleCount(180);
    setCatalogQuery("");
    setCatalogIssuesOnly(false);
    const hashes: Record<View, string> = {
      generator: "#generator",
      listings: "#tickers",
      catalog: "#catalog",
      crypto: "#crypto",
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
    setDraft({
      logoDomain: item.logoDomain,
      logoScale: item.logoScale ?? 0.58,
      logoTreatment: item.logoTreatment ?? "original",
      ...item.palette,
    });
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
    const nextItems = galleryItems.map((item, index) => index === editingIndex
      ? {
        ...item,
        logoDomain: draft.logoDomain.trim() || item.logoDomain,
        logoUrl: createLogoDevUrl(draft.logoDomain.trim() || item.logoDomain, {
          format: logoDevFormat,
          token: logoDevToken,
        }),
        logoScale: draft.logoScale,
        logoTreatment: draft.logoTreatment,
        palette: draftPalette,
      }
      : item);
    setGalleryItems(nextItems);
    window.localStorage.setItem(galleryStorageKey, JSON.stringify(nextItems.map((item) => ({
      key: galleryKey(item),
      logoDomain: item.logoDomain,
      logoScale: item.logoScale,
      logoTreatment: item.logoTreatment,
      colour: item.palette.colour,
      base: item.palette.base,
      sheen: item.palette.sheen,
      shadow: item.palette.shadow,
    }))));
    closeEditor();
  };
  const exportAllOrbs = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportMessage("");
    setExportError("");

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    try {
      const logoAssets = await Promise.all(galleryItems.map(fetchLogoAsset));
      const orbExports = orbExportScaleNames.flatMap((scaleName) => galleryItems.map((item, index) => {
        const filename = [item.exchange, item.symbol]
          .map(exportFilenamePart)
          .join("-");
        return {
          scaleName,
          filename,
          svg: createLogoOrbSvg(logoAssets[index], item.palette, scaleName, {
            theme,
            logoTreatment: item.logoTreatment,
            logoScale: item.logoScale,
            title: `${item.company} ${scaleName} orb`,
          }),
        };
      }));
      const pngs = await Promise.all(orbExports.map(({ scaleName, svg }) => (
        createOrbPng(svg, ORB_EXPORT_SCALES[scaleName].size)
      )));
      const entries = orbExports.flatMap(({ scaleName, filename, svg }, index) => ([
        { name: `svg/${scaleName}/${filename}.svg`, data: svg },
        { name: `png/${scaleName}/${filename}.png`, data: pngs[index] },
      ]));
      const archive = createZipBlob(entries);
      const archiveUrl = window.URL.createObjectURL(archive);
      const downloadLink = document.createElement("a");
      downloadLink.href = archiveUrl;
      downloadLink.download = "hudi-orbs.zip";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(archiveUrl), 1_000);
      setExportMessage(`${orbExports.length} orbs exported as SVG and PNG in matching scale folders.`);
    } catch (error) {
      console.error("Unable to export orb assets", error);
      setExportError("Couldn’t create the orb ZIP. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect -- this mount pass hydrates browser URL and persisted UI state. */
  useEffect(() => {
    if (window.location.hash === "#tickers") setView("listings");
    if (window.location.hash === "#catalog") setView("catalog");
    if (window.location.hash === "#crypto") setView("crypto");
    if (window.location.hash === "#blotter") setView("blotter");
    if (window.location.hash === "#header") setView("header");
    const storedTheme = window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
    setTheme(storedTheme);
    document.documentElement.dataset.theme = storedTheme;

    try {
      const storedOrbs = JSON.parse(window.localStorage.getItem(galleryStorageKey) || "[]") as StoredOrbDraft[];
      if (Array.isArray(storedOrbs)) {
        const storedByKey = new Map(storedOrbs.flatMap((stored) => (
          typeof stored.key === "string" ? [[stored.key, stored] as const] : []
        )));
        const restoredItems = initialGalleryOrbs.map((item) => {
          const stored = storedByKey.get(galleryKey(item));
          if (!stored || typeof stored.colour !== "string") return item;
          const derived = deriveOrbPalette(stored.colour);
          const storedPalette = {
            colour: storedColour(stored.colour, derived.colour),
            base: storedColour(stored.base, derived.base),
            sheen: storedColour(stored.sheen, derived.sheen),
            shadow: storedColour(stored.shadow, derived.shadow),
          };
          const logoDomain = typeof stored.logoDomain === "string" && stored.logoDomain.trim()
            ? stored.logoDomain.trim()
            : item.logoDomain;
          return {
            ...item,
            logoDomain,
            logoUrl: logoDomain === item.logoDomain
              ? item.logoUrl
              : createLogoDevUrl(logoDomain, { format: logoDevFormat, token: logoDevToken }),
            logoScale: typeof stored.logoScale === "number" ? stored.logoScale : item.logoScale,
            logoTreatment: stored.logoTreatment === "light" || stored.logoTreatment === "dark" || stored.logoTreatment === "lift" || stored.logoTreatment === "tint" || stored.logoTreatment === "deepen" || stored.logoTreatment === "knockout" || stored.logoTreatment === "original"
              ? stored.logoTreatment
              : item.logoTreatment,
            palette: storedPalette,
          };
        });
        setGalleryItems(restoredItems);
      }
    } catch {
      window.localStorage.removeItem(galleryStorageKey);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (view !== "catalog" || catalog || catalogError) return;
    const controller = new AbortController();
    Promise.all([
      window.fetch("/logos/catalog/manifest.json", { signal: controller.signal }),
      window.fetch("/logos/catalog/review.json", { signal: controller.signal }),
    ])
      .then(async ([catalogResponse, reviewResponse]) => {
        if (!catalogResponse.ok) throw new Error(`catalog returned ${catalogResponse.status}`);
        if (!reviewResponse.ok) throw new Error(`catalog review returned ${reviewResponse.status}`);
        const [nextCatalog, nextReview] = await Promise.all([
          catalogResponse.json() as Promise<CatalogManifest>,
          reviewResponse.json() as Promise<CatalogReviewIndex>,
        ]);
        setCatalog(nextCatalog);
        setCatalogReview(nextReview);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load the orb catalog", error);
        setCatalogError("The community orb catalog could not be loaded.");
      });
    return () => controller.abort();
  }, [catalog, catalogError, view]);

  useEffect(() => {
    if (view !== "crypto" || cryptoCatalog || cryptoCatalogError) return;
    const controller = new AbortController();
    window.fetch("/logos/crypto/manifest.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`crypto catalog returned ${response.status}`);
        setCryptoCatalog(await response.json() as CatalogManifest);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load the crypto orb catalog", error);
        setCryptoCatalogError("The crypto orb catalog could not be loaded.");
      });
    return () => controller.abort();
  }, [cryptoCatalog, cryptoCatalogError, view]);

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
    <main className={`generator-shell${view === "listings" ? " is-listings-view" : ""}${view === "catalog" || view === "crypto" ? " is-catalog-view" : ""}${view === "blotter" ? " is-blotter-view" : ""}${view === "header" ? " is-header-view" : ""}`}>
      <nav className="view-toggle" aria-label="Orb page">
        <button type="button" aria-pressed={view === "generator"} onClick={() => changeView("generator")}>generator</button>
        <button type="button" aria-pressed={view === "listings"} onClick={() => changeView("listings")}>mvp</button>
        <button type="button" aria-pressed={view === "catalog"} onClick={() => changeView("catalog")}>catalog</button>
        <button type="button" aria-pressed={view === "crypto"} onClick={() => changeView("crypto")}>crypto</button>
        <button type="button" aria-pressed={view === "blotter"} onClick={() => changeView("blotter")}>blotter</button>
        <button type="button" aria-pressed={view === "header"} onClick={() => changeView("header")}>header</button>
        <button type="button" aria-pressed={theme === "dark"} onClick={toggleTheme}>dark</button>
        <button
          type="button"
          disabled={isExporting}
          aria-label={`Export all orbs in ${theme} mode as an SVG and PNG ZIP`}
          onClick={() => void exportAllOrbs()}
          title={`Export every orb in ${theme} mode at all three scales as SVG and PNG`}
        >
          {isExporting ? "exporting…" : "export"}
        </button>
      </nav>

      <p className="visually-hidden" aria-live="polite">{exportMessage || (isExporting ? "Creating SVG and PNG ZIP." : "")}</p>
      {exportError && <p className="export-error" role="alert">{exportError}</p>}

      {view === "generator" && (
        <>
          <section className="orb-stage" aria-label="Company logo orb preview">
            <LogoOrb
              company={generatorItem.company}
              logoUrl={generatorLogoUrl}
              logoTreatment={logoTreatment}
              logoScale={logoScale}
              palette={palette}
            />
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

            <div className="text-controls logo-controls">
              <label className="text-control">
                <span>company:</span>
                <select value={generatorSymbol} aria-label="Company" onChange={(event) => selectGeneratorOrb(event.target.value)}>
                  {galleryItems.map((item) => <option value={item.symbol} key={item.symbol}>{item.company}</option>)}
                </select>
              </label>
              <label className="text-control">
                <span>logo:</span>
                <select value={logoTreatment} aria-label="Logo treatment" onChange={(event) => setLogoTreatment(event.target.value as LogoTreatment)}>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                  <option value="lift">lift colour</option>
                  <option value="tint">tint colour</option>
                  <option value="deepen">deepen colour</option>
                  <option value="knockout">white detail knockout</option>
                  <option value="original">original</option>
                </select>
              </label>
              <label className="text-control">
                <span>scale:</span>
                <input type="range" min="0.36" max="0.72" step="0.01" value={logoScale} aria-label="Logo scale" onChange={(event) => setLogoScale(Number(event.target.value))} />
              </label>
            </div>
            <p className="logo-source-note">Logo source: {generatorItem.logoDomain}</p>
          </section>
        </>
      )}

      {view === "listings" && (
        <section className="listings-gallery" aria-label="Hudi company logo orbs">
          <h1 className="visually-hidden">Hudi company logo orbs</h1>
          <div className="listing-grid">
            {galleryItems.map((listing, index) => (
              <article
                className="listing-card"
                key={listing.symbol}
                aria-label={`${listing.company}, ${listing.exchange}`}
                title={`${listing.symbol} · ${listing.company}`}
              >
                <button className="listing-orb-button" type="button" onClick={() => openEditor(index)} aria-label={`Edit ${listing.company} orb`}>
                  <LogoOrb company={listing.company} logoUrl={listing.logoUrl} logoTreatment={listing.logoTreatment} logoScale={listing.logoScale} palette={listing.palette} size="var(--gallery-orb-size)" compact />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {(view === "catalog" || view === "crypto") && (
        <section className="catalog-gallery" aria-label={view === "crypto" ? "CoinMarketCap crypto orb catalog" : "HUDI community orb catalog"}>
          <header className="catalog-toolbar">
            <div>
              <p>{view === "crypto" ? "coinmarketcap top 100 · stablecoins removed" : "community listings"}</p>
              <h1>{activeCatalog ? activeCatalog.rowCount.toLocaleString() : view === "crypto" ? "—" : "20,524"} orbs</h1>
            </div>
            <div className="catalog-actions">
              {view === "catalog" && (
                <button
                  type="button"
                  aria-pressed={catalogIssuesOnly}
                  disabled={!catalogReview}
                  onClick={toggleCatalogIssues}
                  title="Show current logo assets flagged by visual cross-checks or weaker lookup sources"
                >
                  likely issues
                </button>
              )}
              <button type="button" disabled={!catalogMatches.length} onClick={showRandomCatalogEntries}>
                random 180
              </button>
              <label>
                <span className="visually-hidden">Search orb catalog</span>
                <input
                  type="search"
                  value={catalogQuery}
                  placeholder="ticker, company, exchange"
                  onChange={(event) => {
                    setCatalogQuery(event.target.value);
                    setCatalogVisibleCount(180);
                    setCatalogRandomEntries(null);
                  }}
                />
              </label>
            </div>
          </header>
          {!activeCatalog && !(view === "crypto" ? cryptoCatalogError : catalogError) && <p className="catalog-status">Loading the {view === "crypto" ? "crypto" : "community"} catalog…</p>}
          {(view === "crypto" ? cryptoCatalogError : catalogError) && <p className="catalog-status is-error" role="alert">{view === "crypto" ? cryptoCatalogError : catalogError}</p>}
          {activeCatalog && (
            <>
              <p className="catalog-status">
                {catalogRandomEntries
                  ? `Showing a random ${catalogRandomEntries.length.toLocaleString()} of ${catalogMatches.length.toLocaleString()} ${catalogIssuesOnly ? "likely issues" : catalogQuery.trim() ? "matches" : "listings"}`
                  : `Showing ${Math.min(catalogVisibleCount, catalogMatches.length).toLocaleString()} of ${catalogMatches.length.toLocaleString()} ${catalogIssuesOnly ? "likely issues" : "matches"}`}
                {view === "catalog" && !catalogIssuesOnly && (activeCatalog.summary.sourceReview ?? (activeCatalog.summary.missing + activeCatalog.summary.failed)) > 0 ? ` · ${(activeCatalog.summary.sourceReview ?? (activeCatalog.summary.missing + activeCatalog.summary.failed)).toLocaleString()} need source review` : ""}
              </p>
              <div className="catalog-grid">
                {[
                  { kind: "exact", entries: visibleExactCatalogEntries },
                  { kind: "suggestion", entries: visibleSuggestedCatalogEntries },
                ].map((group) => (
                  <Fragment key={group.kind}>
                    {group.kind === "suggestion" && group.entries.length > 0 && (
                      <p className="catalog-result-divider">suggestions</p>
                    )}
                    {group.entries.map((entry) => (
                      <article className="catalog-card" key={entry.id} title={`${entry.symbol} · ${entry.company}`}>
                        {entry.logo ? (
                          <LogoOrb
                            company={entry.company}
                            logoUrl={entry.logo.path}
                            logoTreatment={entry.logo.logoTreatment}
                            logoScale={entry.logo.logoScale}
                            palette={deriveOrbPalette(entry.logo.orbColour)}
                            size="var(--catalog-orb-size)"
                            compact
                          />
                        ) : (
                          <a
                            className="catalog-missing"
                            href={googleLogoSearchUrl(entry)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Search Google Images for ${entry.company} logo`}
                            title={`Search Google Images for ${entry.company} logo`}
                          >
                            <LogoOrb
                              company={entry.company}
                              fallbackKey={entry.id}
                              colour={fallbackOrbColour(entry.id)}
                              size="var(--catalog-orb-size)"
                              compact
                            />
                          </a>
                        )}
                        <strong>{entry.symbol}</strong>
                        <span>{entry.company}</span>
                        <small>
                          {entry.cmcRank ? `#${entry.cmcRank} · ` : ""}{entry.exchange}
                          {catalogIssuesOnly && catalogReviewById.has(entry.id)
                            ? ` · ${catalogReviewLabel(catalogReviewById.get(entry.id)!)}`
                            : entry.logo?.cropMode.includes("emblem") ? " · emblem" : !entry.logo ? " · default" : ""}
                        </small>
                      </article>
                    ))}
                  </Fragment>
                ))}
              </div>
              {!catalogRandomEntries && catalogVisibleCount < catalogMatches.length && (
                <button className="catalog-more" type="button" onClick={() => setCatalogVisibleCount((current) => current + 180)}>
                  load 180 more
                </button>
              )}
            </>
          )}
        </section>
      )}

      {view === "blotter" && <Blotter items={galleryItems} positions={positions} />}

      {view === "header" && (
        <section className="header-page" aria-label="Selected ticker header preview">
          <CompanyHeader
            company={selectedHeaderItem.company}
            market={selectedHeaderItem.exchange}
            logoUrl={selectedHeaderItem.logoUrl}
            logoTreatment={selectedHeaderItem.logoTreatment}
            logoScale={selectedHeaderItem.logoScale}
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
              <LogoOrb
                company={galleryItems[editingIndex]?.company ?? "Company"}
                logoUrl={createLogoDevUrl(draft.logoDomain || "logo.dev", { format: logoDevFormat, token: logoDevToken })}
                logoTreatment={draft.logoTreatment}
                logoScale={draft.logoScale}
                palette={draftPalette}
                compact
                decorative
              />
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
                <span>Logo.dev domain</span>
                <input
                  autoFocus
                  value={draft.logoDomain}
                  aria-label="Logo.dev domain"
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    logoDomain: event.target.value.trim(),
                  }))}
                />
              </label>
              <label className="orb-editor-field">
                <span>logo treatment</span>
                <select value={draft.logoTreatment} aria-label="Logo treatment" onChange={(event) => setDraft((current) => ({ ...current, logoTreatment: event.target.value as LogoTreatment }))}>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                  <option value="lift">lift colour</option>
                  <option value="tint">tint colour</option>
                  <option value="deepen">deepen colour</option>
                  <option value="knockout">white detail knockout</option>
                  <option value="original">original</option>
                </select>
              </label>
              <label className="orb-editor-field">
                <span>logo scale</span>
                <input type="range" min="0.36" max="0.72" step="0.01" value={draft.logoScale} aria-label="Logo scale" onChange={(event) => setDraft((current) => ({ ...current, logoScale: Number(event.target.value) }))} />
              </label>
            </div>

            <footer className="orb-editor-actions">
              <button type="button" onClick={closeEditor}>cancel</button>
              <button type="submit">save</button>
            </footer>
          </form>
        </div>
      )}

      <footer className="logo-dev-attribution">
        {view === "crypto" ? (
          <>
            <a href="https://www.tradingview.com/">Logos via TradingView</a>
            {" · "}
            <a href="https://coinmarketcap.com/">ranks via CoinMarketCap</a>
          </>
        ) : (
          <a href="https://logo.dev">Logos provided by Logo.dev</a>
        )}
      </footer>
    </main>
  );
}
