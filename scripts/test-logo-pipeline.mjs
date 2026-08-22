import assert from "node:assert/strict";
import sharp from "sharp";
import { analyseLogoColourMode, deriveBrandColourFromLogo } from "./brand-colour.mjs";
import { findSimpleIconsBrandColourCandidates } from "./simple-icons-logo-source.mjs";
import { buildIsolatedVectorLogo, isSvgBytes, prepareVectorLogo } from "./svg-logo-processing.mjs";

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

console.log("Logo vector preservation and brand-colour resolution checks passed.");
