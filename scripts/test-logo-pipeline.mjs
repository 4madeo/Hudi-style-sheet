import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { analyseLogoColourMode, deriveBrandColourFromLogo } from "./brand-colour.mjs";
import { findSimpleIconsBrandColourCandidates } from "./simple-icons-logo-source.mjs";
import { buildIsolatedVectorLogo, isSvgBytes, prepareVectorLogo } from "./svg-logo-processing.mjs";
import { contrastRatio, correctLogoContrast, logoContrastBackground } from "./logo-contrast.mjs";
import { canvasEdgeLineInsets, stripExtractedCanvasEdgeLines } from "./png-logo-processing.mjs";

const tradingViewSvg = Buffer.from(`<!-- by TradingView --><svg width="56" height="56" xmlns="http://www.w3.org/2000/svg"><path fill="url(#tile)" d="M0 0h56v56H0z"/><path id="emblem" fill="#76B900" d="M12 12h32v32H12z"/><defs><linearGradient id="tile"><stop stop-color="#111"/></linearGradient></defs></svg>`);
assert.equal(isSvgBytes(tradingViewSvg), true);
const prepared = prepareVectorLogo(tradingViewSvg, { stripCanvasBackground: true });
assert.equal(prepared.backgroundElementsRemoved, 1);
assert.deepEqual(prepared.removedBackgroundColours, ["#111"]);
assert.doesNotMatch(prepared.analysisBytes.toString("utf8"), /M0 0h56v56H0z/);
assert.match(prepared.analysisBytes.toString("utf8"), /id="emblem"/);
const colouredPanel = prepareVectorLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#d00013"/><path fill="white" d="M2 2h6v6H2z"/></svg>'), { stripCanvasBackground: true });
assert.deepEqual(colouredPanel.removedBackgroundColours, ["#d00013"]);
const reversedPanel = prepareVectorLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path d="M56 0H0v56h56V0Z" fill="#fff"/><path id="mark" d="M20 20h16v16H20z"/></svg>'), { stripCanvasBackground: true });
assert.equal(reversedPanel.backgroundElementsRemoved, 1);
assert.doesNotMatch(reversedPanel.analysisBytes.toString("utf8"), /M56 0H0v56h56V0Z/);
const closedCanvasPanel = prepareVectorLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path d="M0 0h56v56H0V0Z" fill="#fc6432"/><path id="mark" d="M20 20h16v16H20z"/></svg>'), { stripCanvasBackground: true });
assert.equal(closedCanvasPanel.backgroundElementsRemoved, 1);
assert.doesNotMatch(closedCanvasPanel.analysisBytes.toString("utf8"), /fc6432/i);
const halfPixelCanvasPanel = prepareVectorLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 57"><path fill="#f0f3fa" d="M0 .5h56v56H0z"/><path id="mark" d="M4 22.5h48v9H4z"/></svg>'), { stripCanvasBackground: true });
assert.equal(halfPixelCanvasPanel.backgroundElementsRemoved, 1);
assert.doesNotMatch(halfPixelCanvasPanel.analysisBytes.toString("utf8"), /f0f3fa/i);
assert.match(halfPixelCanvasPanel.analysisBytes.toString("utf8"), /id="mark"/);
const strippedBadge = prepareVectorLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><circle id="rim" cx="28" cy="28" r="17"/><circle id="disc" cx="28" cy="28" r="15"/><path id="mark" d="M20 20h16v16H20z"/></svg>'), { stripVisibleElementIndexes: [0, 1] });
assert.doesNotMatch(strippedBadge.analysisBytes.toString("utf8"), /id="(?:rim|disc)"/);
assert.match(strippedBadge.analysisBytes.toString("utf8"), /id="mark"/);

const isolated = buildIsolatedVectorLogo(prepared, {
  left: 12 / 56,
  top: 12 / 56,
  width: 32 / 56,
  height: 32 / 56,
}, { source: "tradingview" });
const metadata = await sharp(isolated).metadata();
assert.equal(metadata.format, "svg");
assert.equal(metadata.width, 512);
assert.equal(metadata.height, 512);
assert.match(isolated.toString("utf8"), /HUDI isolated vector mark/);
assert.match(isolated.toString("utf8"), /id="emblem"/);

const colours = findSimpleIconsBrandColourCandidates([
  { exchange: "NYSE", symbol: "KO", name: "COCA COLA CO" },
]);
assert.equal(colours.get("NYSE:KO")?.colour, "#D00013");
assert.equal(colours.get("NYSE:KO")?.slug, "cocacola");
assert.equal(findSimpleIconsBrandColourCandidates([
  { exchange: "NASDAQ", symbol: "NVDA", name: "Nvidia" },
]).get("NASDAQ:NVDA")?.colour, "#76B900");

const derived = await deriveBrandColourFromLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#e60012" d="M0 0h10v10H0z"/></svg>'));
assert.equal(derived.hex, "#e60012");
assert.equal(derived.source, "logo-derived");
assert.equal(await analyseLogoColourMode(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#f00" d="M0 0h5v10H0z"/><path fill="#00f" d="M5 0h5v10H5z"/></svg>')), "multicolour");
assert.equal(await analyseLogoColourMode(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#f00" d="M0 0h10v10H0z"/></svg>')), "monochrome");
assert.equal(await analyseLogoColourMode(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#20231e" d="M0 0h10v10H0z"/></svg>')), "monochrome");
assert.equal(await analyseLogoColourMode(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#e13" d="M0 0h10v10H0z"/><defs><linearGradient id="unused"><stop stop-color="#111"/><stop offset="1" stop-color="#050509"/></linearGradient></defs></svg>')), "monochrome");
assert.equal(await analyseLogoColourMode(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#900" d="M0 0h5v10H0z"/><path fill="#f33" d="M5 0h5v10H5z"/></svg>')), "tonal");

const crt = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><path fill="#c30012" d="M0 0h18v20H0z"/><path fill="#f28d0f" d="M21 0h18v20H21z"/><path fill="#288821" d="M42 0h18v20H42z"/></svg>');
const rgb = (value) => ({ r: Number.parseInt(value.slice(1, 3), 16), g: Number.parseInt(value.slice(3, 5), 16), b: Number.parseInt(value.slice(5, 7), 16) });
const correctedCrt = await correctLogoContrast(crt, "svg", "#f28d0f", { wordmark: true });
assert.equal(correctedCrt.kind, "selective-paint");
assert.ok(correctedCrt.adjustments.some((adjustment) => adjustment.from === "#f28d0f"));
assert.ok(correctedCrt.adjustments.every((adjustment) => (
  contrastRatio(rgb(adjustment.to), logoContrastBackground("#f28d0f")) >= 3
)));
assert.match(correctedCrt.bytes.toString("utf8"), /fill="#[0-9a-f]{6}" d="M21/i);
assert.doesNotMatch(correctedCrt.bytes.toString("utf8"), /fill="#f28d0f" d="M21/i);
const adjustedCrtPaint = correctedCrt.adjustments.find((adjustment) => adjustment.from === "#f28d0f").to;
assert.ok(contrastRatio(rgb(adjustedCrtPaint), logoContrastBackground("#f28d0f")) >= 3);

const badge = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><circle fill="#f28d0f" cx="28" cy="28" r="24"/><path fill="#fff" d="M20 20h16v16H20z"/></svg>');
const correctedBadge = await correctLogoContrast(badge, "svg", "#f28d0f");
assert.equal(correctedBadge.kind, "none");
assert.equal(correctedBadge.preserveOriginal, true);

const lightPanel = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><circle fill="#f0f3fa" cx="28" cy="28" r="28"/><path fill="url(#brand)" d="M12 12h32v32H12z"/><defs><linearGradient id="brand"><stop stop-color="#0457a9"/><stop offset="1" stop-color="#00a0e9"/></linearGradient></defs></svg>');
const correctedLightPanel = await correctLogoContrast(lightPanel, "svg", "#0457a9");
assert.equal(correctedLightPanel.kind, "none");
assert.equal(correctedLightPanel.preserveOriginal, true);

const tonalWordmark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><path fill="#9d006e" d="M0 0h18v20H0z"/><path fill="#ce0171" d="M21 0h18v20H21z"/><path fill="#ef0278" d="M42 0h18v20H42z"/></svg>');
const correctedTonalWordmark = await correctLogoContrast(tonalWordmark, "svg", "#9d006e", { wordmark: true });
assert.equal(correctedTonalWordmark.kind, "selective-paint");
assert.ok(correctedTonalWordmark.adjustments.length > 0);
assert.ok(correctedTonalWordmark.adjustments.every((adjustment) => (
  contrastRatio(rgb(adjustment.to), logoContrastBackground("#9d006e")) >= 3
)));

const longTonalWordmark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"><path fill="#97036d" d="M0 0h18v20H0z"/><path fill="#9e006e" d="M20 0h18v20H20z"/><path fill="#ce0171" d="M40 0h18v20H40z"/><path fill="#ef0278" d="M60 0h18v20H60z"/><path fill="#f0017f" d="M80 0h18v20H80z"/></svg>');
const correctedLongTonalWordmark = await correctLogoContrast(longTonalWordmark, "svg", "#9d006e", { wordmark: true });
assert.equal(correctedLongTonalWordmark.kind, "selective-paint");
assert.ok(correctedLongTonalWordmark.adjustments.length > 0);

const rinkoWordmark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><path fill="#004ea2" d="M0 8h18v4H0z"/><path fill="#004ea2" d="M21 8h18v4H21z"/><path fill="#004ea2" d="M42 8h18v4H42z"/><path fill="#e60012" d="M20 2h3v3h-3z"/></svg>');
const correctedRinkoWordmark = await correctLogoContrast(rinkoWordmark, "svg", "#004ea2", { wordmark: true });
assert.equal(correctedRinkoWordmark.kind, "selective-paint");
assert.ok(contrastRatio(rgb(correctedRinkoWordmark.adjustments[0].to), logoContrastBackground("#004ea2")) >= 3);

const iovaWordmark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20"><path fill="#033c5a" d="M0 5h60v10H0z"/><path fill="#82bd41" d="M4 7h6v6H4z"/></svg>');
const correctedIovaWordmark = await correctLogoContrast(iovaWordmark, "svg", "#033c5a", { wordmark: true });
assert.equal(correctedIovaWordmark.kind, "selective-paint");
assert.ok(correctedIovaWordmark.adjustments.every((adjustment) => (
  contrastRatio(rgb(adjustment.to), logoContrastBackground("#033c5a")) >= 3
)));
assert.ok(correctedIovaWordmark.adjustments.every((adjustment) => (
  rgb(adjustment.to).g < rgb(adjustment.from).g
)));
assert.doesNotMatch(correctedIovaWordmark.bytes.toString("utf8"), /fill="#82bd41"/i);
assert.match(correctedIovaWordmark.bytes.toString("utf8"), /fill="#033c5a"/i);
assert.ok(contrastRatio(rgb("#033c5a"), logoContrastBackground("#033c5a")) >= 3);

const complexMark = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">${Array.from({ length: 9 }, (_, index) => `<path fill="#${(0x97036d + index * 0x020001).toString(16)}" d="M${index * 10} 0h8v20h-8z"/>`).join("")}</svg>`);
const correctedComplexMark = await correctLogoContrast(complexMark, "svg", "#9d006e", { wordmark: true });
assert.equal(correctedComplexMark.kind, "selective-paint");
assert.equal(correctedComplexMark.adjustments.length, 9);
assert.doesNotMatch(correctedComplexMark.bytes.toString("utf8"), /hudi-logo-contrast-outline/);

const defaultBlackMark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0h20v20H0z"/></svg>');
const correctedDefaultBlackMark = await correctLogoContrast(defaultBlackMark, "svg", "#fade4b");
assert.equal(correctedDefaultBlackMark.kind, "none");
assert.equal(correctedDefaultBlackMark.preserveOriginal, true);

const allWhiteMark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="#fff" d="M0 0h20v20H0z"/></svg>');
const correctedAllWhiteMark = await correctLogoContrast(allWhiteMark, "svg", "#fade4b");
assert.equal(correctedAllWhiteMark.kind, "none");
assert.equal(correctedAllWhiteMark.preserveOriginal, true);

const wharfEmblem = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><rect fill="#004b88" x="11" y="16" width="34" height="24"/><path fill="#ec1b2e" d="M11 16l17 12-17 12zM45 16L28 28l17 12z"/></svg>');
const correctedWharfEmblem = await correctLogoContrast(wharfEmblem, "svg", "#004b88");
assert.equal(correctedWharfEmblem.kind, "selective-paint");
assert.match(correctedWharfEmblem.bytes.toString("utf8"), /<rect fill="#004b88"/);
assert.doesNotMatch(correctedWharfEmblem.bytes.toString("utf8"), /<path fill="#ec1b2e"/);

const exposedDetailEmblem = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><circle fill="#c7010b" cx="25" cy="28" r="16"/><path fill="#043477" d="M18 40l22-24-8 24z"/><path fill="#c7010b" d="M44 20l1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2h3z"/><path fill="#c7010b" d="M48 32l1 2h2l-2 1 1 2-2-1-2 1 1-2-2-1h2z"/></svg>');
const correctedExposedDetailEmblem = await correctLogoContrast(exposedDetailEmblem, "svg", "#c7010b");
assert.equal(correctedExposedDetailEmblem.kind, "selective-paint");
assert.match(correctedExposedDetailEmblem.bytes.toString("utf8"), /<circle fill="#c7010b"/);
assert.doesNotMatch(correctedExposedDetailEmblem.bytes.toString("utf8"), /<path fill="#c7010b" d="M44/);

const hsbcBadge = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path fill="#fff" d="M16 16h24v24H16z"/><path fill="#e71d1c" d="M4 28l12-12v24zM52 28L40 16v24z"/></svg>');
const correctedHsbcBadge = await correctLogoContrast(hsbcBadge, "svg", "#e71d1c", { wordmark: true });
assert.equal(correctedHsbcBadge.kind, "none");
assert.equal(correctedHsbcBadge.preserveOriginal, true);

const compactWordmark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path fill="#ed1c24" d="M28 23h20v10H28z"/><path fill="#ed1c24" d="M4 23h20v10H4z"/></svg>');
const correctedCompactWordmark = await correctLogoContrast(compactWordmark, "svg", "#ed1c24", { wordmark: true });
assert.equal(correctedCompactWordmark.kind, "selective-paint");

const spectrumMark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path fill="#fabe00" d="M12 12h5v5h-5z"/><path fill="url(#spectrum)" d="M18 18h26v26H18z"/><defs><linearGradient id="spectrum"><stop stop-color="#ee7300"/><stop offset="1" stop-color="#ea5803"/></linearGradient></defs></svg>');
const correctedSpectrumMark = await correctLogoContrast(spectrumMark, "svg", "#ea5505");
assert.equal(correctedSpectrumMark.kind, "selective-paint");
assert.doesNotMatch(correctedSpectrumMark.bytes.toString("utf8"), /stop-color="#ee7300"/);

const edgeFixture = Buffer.alloc(100 * 100 * 4, 255);
for (let y = 0; y < 2; y += 1) edgeFixture.fill(20, y * 100 * 4, (y + 1) * 100 * 4);
assert.deepEqual(canvasEdgeLineInsets(edgeFixture, 100, 100, 4), { left: 0, top: 2, right: 0, bottom: 0 });
const sideFixture = Buffer.alloc(100 * 100 * 4, 255);
for (let y = 0; y < 100; y += 1) sideFixture.fill(80, y * 100 * 4, y * 100 * 4 + 3 * 4);
assert.deepEqual(canvasEdgeLineInsets(sideFixture, 100, 100, 4), { left: 3, top: 0, right: 0, bottom: 0 });
const extractedFixture = Buffer.alloc(100 * 100 * 4, 255);
const extractedMask = new Uint8Array(100 * 100);
for (let y = 0; y < 100; y += 1) extractedMask[y * 100 + 50] = 1;
for (let y = 98; y < 100; y += 1) extractedMask.fill(1, y * 100, (y + 1) * 100);
assert.deepEqual(stripExtractedCanvasEdgeLines(extractedFixture, extractedMask, 100, 100), { left: 0, top: 0, right: 0, bottom: 2 });
assert.equal(extractedMask[97 * 100 + 50], 1);
assert.equal(extractedMask[99 * 100 + 50], 0);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pngAdjustments = JSON.parse(await readFile(path.join(root, "data/png-logo-adjustments.json"), "utf8"));
assert.equal(pngAdjustments.version, 1);
assert.equal(new Set(pngAdjustments.adjustments.map((item) => item.sourceSha256)).size, pngAdjustments.adjustments.length);
for (const adjustment of pngAdjustments.adjustments) {
  assert.match(adjustment.sourceSha256, /^[0-9a-f]{64}$/);
  assert.ok(adjustment.processing?.sourceCrop
    || adjustment.processing?.excludeRegions
    || adjustment.processing?.backgroundTolerance
    || adjustment.processing?.lightPixelThreshold
    || adjustment.processing?.stripCanvasEdgeLines);
  if (adjustment.orbColour) assert.match(adjustment.orbColour, /^#[0-9a-f]{6}$/i);
}

const catalog = JSON.parse(await readFile(path.join(root, "public/logos/catalog/manifest.json"), "utf8"));
const catalogEntries = new Map(catalog.entries.map((entry) => [entry.id, entry]));
const reviewedFilledBadges = [
  "NYSE:SECZ",
  "NYSE:EVEX-WT",
  "NASDAQ:AEAQW",
  "HKEX:8341",
  "NASDAQ:PRTH",
  "NASDAQ:QUMSR",
  "NASDAQ:PONOR",
  "HKEX:1310",
];
for (const id of reviewedFilledBadges) {
  assert.equal(catalogEntries.get(id)?.logo?.logoTreatment, "original", `${id} must retain internal badge detail`);
}
assert.equal(catalogEntries.get("NASDAQ:PRTH")?.logo?.provider, "manual-review");
assert.ok(catalogEntries.get("HKEX:1310")?.logo?.crop?.width > 0.4, "HKBN must retain its full blue emblem");
assert.equal(catalogEntries.get("HKEX:0029")?.logo?.logoTreatment, "light", "DYNAMIC HOLD must remain white");
assert.equal(catalogEntries.get("HKEX:0002")?.logo?.logoTreatment, "light", "CLP HOLDINGS must remain white");
for (const id of ["HKEX:0018", "HKEX:0168"]) {
  assert.equal(catalogEntries.get(id)?.logo?.logoContrastAdjustment, undefined, `${id} must keep its reviewed original artwork`);
}

console.log("Logo vector preservation and brand-colour resolution checks passed.");
