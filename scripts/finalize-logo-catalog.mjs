import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifiedLogoFamilies, verifiedLogoFamilyByListing } from "./catalog-logo-families.mjs";
import {
  EXACT_TICKER_LOGO_RESOLUTION_FLOOR,
  measureLogoResolution,
  resolutionFailureMessage,
} from "./logo-resolution.mjs";
import { prepareVectorLogo } from "./svg-logo-processing.mjs";
import { correctLogoContrast } from "./logo-contrast.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"))
  ?? "public/logos/catalog/manifest.json";
const manifestPath = path.resolve(root, manifestArgument);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function parseHex(value) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value ?? "");
  return match ? { r: Number.parseInt(match[1], 16), g: Number.parseInt(match[2], 16), b: Number.parseInt(match[3], 16) } : undefined;
}

function relativeLuminance(colour) {
  const channels = [colour.r, colour.g, colour.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(left, right) {
  const values = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function hueAndSaturation({ r, g, b }) {
  const [red, green, blue] = [r, g, b].map((value) => value / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (!delta) return { hue: 0, saturation: 0 };
  const lightness = (maximum + minimum) / 2;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const rawHue = maximum === red
    ? 60 * (((green - blue) / delta) % 6)
    : maximum === green
      ? 60 * ((blue - red) / delta + 2)
      : 60 * ((red - green) / delta + 4);
  return { hue: (rawHue + 360) % 360, saturation };
}

function svgArtworkStructure(source) {
  const definitions = [...source.matchAll(/<defs\b[\s\S]*?<\/defs\s*>/gi)].map((match) => match[0]).join("");
  const visibleSource = source.replace(/<defs\b[\s\S]*?<\/defs\s*>/gi, "");
  const paintMatches = [...visibleSource.matchAll(/(?:fill|stroke)\s*=\s*["'](#[0-9a-f]{3,8})["']/gi)];
  for (const reference of visibleSource.matchAll(/(?:fill|stroke)\s*=\s*["']url\(\s*#([^)\s]+)\s*\)["']/gi)) {
    const escapedId = reference[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const gradient = new RegExp(`<(?:linearGradient|radialGradient)\\b[^>]*\\bid=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/(?:linearGradient|radialGradient)\\s*>`, "i").exec(definitions)?.[1] ?? "";
    paintMatches.push(...gradient.matchAll(/stop-color\s*=\s*["'](#[0-9a-f]{3,8})["']/gi));
  }
  const paints = paintMatches
    .map((match) => {
      const hex = match[1].slice(1);
      const expanded = hex.length === 3
        ? [...hex].map((digit) => digit + digit).join("")
        : hex.slice(0, 6);
      return parseHex(`#${expanded}`);
    })
    .filter(Boolean);
  const hasLightDetail = paints.some(({ r, g, b }) => r >= 235 && g >= 235 && b >= 235);
  const hasChromaticArtwork = paints.some((colour) => {
    const { saturation } = hueAndSaturation(colour);
    return saturation >= 0.25 && relativeLuminance(colour) < 0.75;
  });
  const chromaticPaints = paints.filter((colour) => {
    const { saturation } = hueAndSaturation(colour);
    return saturation >= 0.25 && relativeLuminance(colour) < 0.75;
  });
  let maximumPaintContrast = 1;
  let maximumHueSeparation = 0;
  for (let left = 0; left < chromaticPaints.length; left += 1) {
    for (let right = left + 1; right < chromaticPaints.length; right += 1) {
      maximumPaintContrast = Math.max(maximumPaintContrast, contrastRatio(chromaticPaints[left], chromaticPaints[right]));
      const leftHue = hueAndSaturation(chromaticPaints[left]).hue;
      const rightHue = hueAndSaturation(chromaticPaints[right]).hue;
      maximumHueSeparation = Math.max(maximumHueSeparation, Math.min(Math.abs(leftHue - rightHue), 360 - Math.abs(leftHue - rightHue)));
    }
  }
  let lightWeight = 0;
  let chromaticWeight = 0;
  const chromaticPaintWeights = new Map();
  let hasColourContainer = false;
  let hasLightContainer = false;
  for (const match of source.matchAll(/<(path|circle|rect|ellipse|polygon|polyline)\b[^>]*>/gi)) {
    const [, tag] = match;
    const markup = match[0];
    const paintMatch = /(?:fill|stroke)\s*=\s*["'](#[0-9a-f]{3,8})["']/i.exec(markup);
    if (!paintMatch) continue;
    const hex = paintMatch[1].slice(1);
    const expanded = hex.length === 3
      ? [...hex].map((digit) => digit + digit).join("")
      : hex.slice(0, 6);
    const colour = parseHex(`#${expanded}`);
    if (!colour) continue;
    const pathData = /\bd\s*=\s*["']([^"']+)/i.exec(markup)?.[1];
    const pathWeight = pathData?.length;
    const weight = Math.max(24, pathWeight ?? markup.length);
    const isLight = colour.r >= 235 && colour.g >= 235 && colour.b >= 235;
    const isChromatic = hueAndSaturation(colour).saturation >= 0.25 && relativeLuminance(colour) < 0.75;
    const tagName = tag.toLowerCase();
    const simpleRectangularPath = tagName === "path"
      && pathData
      && pathData.length < 80
      && /[Hh]/.test(pathData)
      && /[Vv]/.test(pathData)
      && /[Zz]\s*$/.test(pathData);
    const simpleEllipticalPath = tagName === "path"
      && pathData
      && pathData.length < 130
      && /[Aa]/.test(pathData)
      && /[Zz]\s*$/.test(pathData);
    const isSimpleContainer = ["circle", "rect", "ellipse"].includes(tagName)
      || simpleRectangularPath
      || simpleEllipticalPath;
    if (isLight) lightWeight += weight;
    if (isLight && isSimpleContainer) hasLightContainer = true;
    if (isChromatic) {
      chromaticWeight += weight;
      const paintKey = `#${expanded.toLowerCase()}`;
      chromaticPaintWeights.set(paintKey, (chromaticPaintWeights.get(paintKey) ?? 0) + weight);
      if (isSimpleContainer) hasColourContainer = true;
    }
  }
  return {
    preserveLightDetail: hasLightDetail && hasChromaticArtwork,
    lightGeometryShare: lightWeight / Math.max(1, lightWeight + chromaticWeight),
    hasColourContainer,
    hasLightContainer,
    containerDefinesInternalContrast: hasColourContainer
      && (maximumPaintContrast >= 1.5 || maximumHueSeparation >= 50),
    preserveChromaticDetail: chromaticPaints.length >= 2
      && (maximumPaintContrast >= 1.5 || maximumHueSeparation >= 25),
    chromaticPaintWeights: [...chromaticPaintWeights].map(([colour, weight]) => ({ colour, weight })),
    chromaticPaintColours: chromaticPaints,
    dominantChromaticColour: [...chromaticPaintWeights]
      .sort((left, right) => right[1] - left[1])[0]?.[0],
  };
}

function adjustedBrightness(colour, multiplier) {
  return {
    r: Math.min(255, Math.round(colour.r * multiplier)),
    g: Math.min(255, Math.round(colour.g * multiplier)),
    b: Math.min(255, Math.round(colour.b * multiplier)),
  };
}

function adjustedLift(colour) {
  return {
    r: Math.min(255, Math.round(colour.r * 0.16 + 255 * 0.8)),
    g: Math.min(255, Math.round(colour.g * 0.16 + 255 * 0.8)),
    b: Math.min(255, Math.round(colour.b * 0.16 + 255 * 0.8)),
  };
}

function adjustedTint(colour) {
  return {
    r: Math.min(255, Math.round(colour.r * 0.4 + 255 * 0.55)),
    g: Math.min(255, Math.round(colour.g * 0.4 + 255 * 0.55)),
    b: Math.min(255, Math.round(colour.b * 0.4 + 255 * 0.55)),
  };
}

function readableOriginalTreatment(logo, artworkStructure = {}) {
  const restored = {
    ...logo,
    orbColour: logo.orbColourSeed ?? logo.orbColour,
  };
  delete restored.orbColourAdjustment;
  if (logo.orbColourSource === "removed-background") {
    // When the source canvas supplied the orb colour, retain distinct light
    // and chromatic logo elements instead of washing the whole mark toward
    // white. Rectangular light containers remain eligible for knockout.
    if (logo.logoColourMode === "multicolour"
      && !artworkStructure.hasLightContainer
      && (artworkStructure.preserveLightDetail || artworkStructure.preserveChromaticDetail)) {
      restored.logoTreatment = "original";
      restored.orbColourAdjustment = "preserved-source-background-contrast";
    }
    return restored;
  }
  const removedBackground = parseHex(artworkStructure.removedBackgroundColour);
  if (artworkStructure.preserveLightDetail && removedBackground) {
    const { saturation } = hueAndSaturation(removedBackground);
    if (saturation >= 0.18 && contrastRatio(removedBackground, { r: 255, g: 255, b: 255 }) >= 3) {
      restored.orbColour = artworkStructure.removedBackgroundColour;
      restored.orbColourSeed = artworkStructure.removedBackgroundColour;
      restored.orbColourSource = "removed-background";
      delete restored.orbColourSourceRef;
      delete restored.orbColourSourceUrl;
    }
  }
  const seed = parseHex(restored.orbColour);
  if (logo.logoColourMode === "multicolour") {
    if (artworkStructure.containerDefinesInternalContrast) {
      restored.logoTreatment = "original";
      restored.orbColourAdjustment = "preserved-container-contrast";
      return restored;
    }
    if (artworkStructure.preserveChromaticDetail) {
      const paintWeights = artworkStructure.chromaticPaintWeights ?? [];
      const totalPaintWeight = paintWeights.reduce((total, paint) => total + paint.weight, 0);
      const contrastingPaintWeight = paintWeights.reduce((total, paint) => {
        const colour = parseHex(paint.colour);
        return total + (colour && seed && contrastRatio(seed, colour) >= 1.5 ? paint.weight : 0);
      }, 0);
      if (contrastingPaintWeight / Math.max(1, totalPaintWeight) >= 0.25) {
        restored.logoTreatment = "original";
        restored.orbColourAdjustment = "preserved-chromatic-detail";
        return restored;
      }
    }
    restored.logoTreatment = "original";
    const mark = parseHex(logo.logoColour ?? logo.orbColourSeed ?? logo.orbColour);
    if (seed && mark && contrastRatio(seed, mark) < 3) {
      const colouredTreatment = relativeLuminance(seed) >= 0.32
        ? "deepen"
        : logo.logoColour ? "lift" : "tint";
      const adjustedMark = colouredTreatment === "deepen"
        ? adjustedBrightness(mark, 0.48)
        : colouredTreatment === "lift"
          ? adjustedLift(mark)
          : adjustedTint(mark);
      restored.logoTreatment = colouredTreatment;
      restored.orbColourAdjustment = contrastRatio(seed, adjustedMark) >= 3
        ? "multicolour-logo-contrast"
        : "multicolour-logo-contrast-closest";
    }
    return restored;
  }
  if (logo.logoColourMode === "tonal" && seed) {
    if (artworkStructure.containerDefinesInternalContrast) {
      restored.logoTreatment = "original";
      restored.orbColourAdjustment = "preserved-container-contrast";
      return restored;
    }
    if (artworkStructure.preserveLightDetail) {
      restored.logoTreatment = !artworkStructure.hasLightContainer || artworkStructure.lightGeometryShare >= 0.55
        ? "original"
        : relativeLuminance(seed) > 0.55 ? "deepen" : "knockout";
      if (restored.orbColourSource !== "removed-background" && parseHex(logo.logoColour)) {
        restored.orbColour = logo.logoColour;
        restored.orbColourSeed = logo.logoColour;
        restored.orbColourSource = "logo-derived";
        delete restored.orbColourSourceRef;
        delete restored.orbColourSourceUrl;
      }
      restored.orbColourAdjustment = "preserved-internal-contrast";
      return restored;
    }
    if (artworkStructure.preserveChromaticDetail) {
      const paintWeights = artworkStructure.chromaticPaintWeights ?? [];
      const totalPaintWeight = paintWeights.reduce((total, paint) => total + paint.weight, 0);
      const contrastingPaintWeight = paintWeights.reduce((total, paint) => {
        const colour = parseHex(paint.colour);
        return total + (colour && contrastRatio(seed, colour) >= 1.5 ? paint.weight : 0);
      }, 0);
      const gradientHasContrast = totalPaintWeight === 0
        && (artworkStructure.chromaticPaintColours ?? []).some((colour) => contrastRatio(seed, colour) >= 2);
      restored.logoTreatment = gradientHasContrast || contrastingPaintWeight / Math.max(1, totalPaintWeight) >= 0.25
        ? "original"
        : relativeLuminance(seed) < 0.18 ? "tint" : "deepen";
      restored.orbColourAdjustment = "preserved-chromatic-detail";
      return restored;
    }
    const white = { r: 255, g: 255, b: 255 };
    const needsCleanWhiteMark = relativeLuminance(seed) < 0.2 && contrastRatio(seed, white) >= 4.5;
    restored.logoTreatment = needsCleanWhiteMark
      ? "light"
      : relativeLuminance(seed) < 0.3 ? "lift" : "deepen";
    restored.orbColourAdjustment = needsCleanWhiteMark ? "logo-contrast" : "tonal-logo-contrast";
    return restored;
  }
  const hasOriginalMarkColour = Boolean(artworkStructure.dominantChromaticColour)
    || Boolean(logo.logoColour)
    || logo.orbColourSource === "logo-derived";
  if (hasOriginalMarkColour) restored.logoTreatment = "original";
  const mark = hasOriginalMarkColour
    ? parseHex(artworkStructure.dominantChromaticColour ?? logo.logoColour ?? logo.orbColourSeed ?? logo.orbColour)
    : logo.logoTreatment === "light"
      ? { r: 255, g: 255, b: 255 }
      : logo.logoTreatment === "dark"
        ? { r: 0, g: 0, b: 0 }
        : parseHex(logo.logoColour ?? logo.orbColourSeed ?? logo.orbColour);
  if (!seed || !mark) return restored;
  if (contrastRatio(seed, mark) < 3) {
    const black = { r: 0, g: 0, b: 0 };
    const { hue, saturation } = hueAndSaturation(seed);
    const redOrBlue = saturation >= 0.25 && (hue <= 30 || hue >= 330 || (hue >= 185 && hue <= 260));
    const brightEnoughForBlack = relativeLuminance(seed) >= 0.32 && contrastRatio(seed, black) >= 4.5;
    const deepenedMark = adjustedBrightness(mark, 0.48);
    restored.logoTreatment = redOrBlue || !brightEnoughForBlack
      ? "light"
      : contrastRatio(seed, deepenedMark) >= 3 ? "deepen" : "dark";
    restored.orbColourAdjustment = "logo-contrast";
  }
  return restored;
}

function isWordmarkLogo(logo) {
  return logo.crop?.width / Math.max(0.001, logo.crop?.height ?? 0) >= 2.25;
}

manifest.entries = await Promise.all(manifest.entries.map(async (entry) => {
  if (!entry.logo) return entry;
  const sourceLogo = { ...entry.logo };
  if (sourceLogo.logoContrastSourcePath) {
    sourceLogo.path = sourceLogo.logoContrastSourcePath;
    delete sourceLogo.logoContrastSourcePath;
    delete sourceLogo.logoContrastAdjustment;
    delete sourceLogo.logoPaintAdjustments;
  }
  let artworkStructure = {};
  if (sourceLogo.assetFormat === "svg" && sourceLogo.path) {
    try {
      const logoPath = path.join(root, "public", sourceLogo.path.replace(/^\//, ""));
      artworkStructure = svgArtworkStructure(await readFile(logoPath, "utf8"));
      if (sourceLogo.sourcePath) {
        const sourcePath = path.join(root, "public", sourceLogo.sourcePath.replace(/^\//, ""));
        const preparedSource = prepareVectorLogo(await readFile(sourcePath), { stripCanvasBackground: true });
        const removedBackgroundColour = preparedSource?.removedBackgroundColours
          .map((colour) => {
            const match = /^#([0-9a-f]{6})$/i.exec(colour);
            return match ? `#${match[1].toLowerCase()}` : undefined;
          })
          .find(Boolean);
        if (removedBackgroundColour) artworkStructure.removedBackgroundColour = removedBackgroundColour;
      }
    } catch {
      artworkStructure = {};
    }
  }
  let logo = readableOriginalTreatment(sourceLogo, artworkStructure);
  if (logo.provider === "logo.dev"
    && logo.lookup === "cached"
    && logo.sourcePath) {
    const sourcePath = path.join(root, "public", logo.sourcePath.replace(/^\//, ""));
    const sourceHeader = (await readFile(sourcePath)).subarray(0, 24).toString("utf8");
    if (sourceHeader.startsWith("<!-- by TradingView")) {
      logo = {
        ...logo,
        provider: "tradingview",
        lookup: "exchange-ticker",
        query: entry.id,
      };
    }
  }
  const cleanEntry = { ...entry, logo };
  delete cleanEntry.logoCandidate;
  return cleanEntry;
}));

const reviewedTreatmentOverrides = new Map([
  ["TSE:8802", "light"],
  ["TSE:9869", "light"],
  ["NASDAQ:BMRA", "light"],
  ["HKEX:0002", "light"],
  ["HKEX:0005", "knockout"],
  ["NYSE:HSBC", "knockout"],
  // Filled badges must keep their internal colour separation. A light/dark
  // CSS treatment flattens each of these approved marks into a plain disc.
  ["NYSE:SECZ", "original"],
  ["NYSE:EVEX-WT", "original"],
  ["NASDAQ:AEAQW", "original"],
  ["HKEX:8341", "original"],
  ["NASDAQ:PRTH", "original"],
  ["NASDAQ:QUMSR", "original"],
  ["NASDAQ:PONOR", "original"],
  ["HKEX:1310", "original"],
]);
const reviewedOrbColourOverrides = new Map([
  // HKBN's emblem is a blue square with transparent/white internal detail.
  // Reusing that same blue as the orb surface makes the square disappear.
  ["HKEX:1310", "#f0f3fa"],
]);
const reviewedOriginalArtworkIds = new Set([
  "HKEX:0018", // ORIENTAL M G already has sufficient internal/exterior contrast.
  "HKEX:0168", // TSINGTAO BREW already has sufficient internal/exterior contrast.
]);
function applyReviewedTreatmentOverride(entry) {
  const treatment = reviewedTreatmentOverrides.get(entry.id);
  const orbColour = reviewedOrbColourOverrides.get(entry.id);
  if ((!treatment && !orbColour) || !entry.logo) return entry;
  return {
    ...entry,
    logo: {
      ...entry.logo,
      ...(treatment ? { logoTreatment: treatment } : {}),
      ...(orbColour ? {
        orbColour,
        orbColourSeed: orbColour,
        orbColourSource: "removed-background",
      } : {}),
      orbColourAdjustment: "reviewed-logo-contrast",
    },
  };
}
manifest.entries = manifest.entries.map(applyReviewedTreatmentOverride);

function normalizedName(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function providerScore(entry) {
  if (entry.logo?.provider === "mvp-reference") return 5;
  if (entry.logo?.provider === "tradingview") return 4;
  if (entry.logo?.lookup === "wikidata-ticker") return 4;
  if (entry.logo?.lookup === "ticker") return 3;
  if (entry.logo?.lookup === "name") return 2;
  return 1;
}

const resolvedByName = new Map();
for (const entry of manifest.entries) {
  if (!entry.logo) continue;
  const name = normalizedName(entry.company);
  if (name.length < 5) continue;
  const key = `${entry.exchange}:${name}`;
  const current = resolvedByName.get(key);
  if (!current || providerScore(entry) > providerScore(current)) resolvedByName.set(key, entry);
}

let aliases = manifest.entries.filter((entry) => entry.logo?.provider === "catalog-alias").length;
manifest.entries = manifest.entries.map((entry) => {
  const name = normalizedName(entry.company);
  const match = resolvedByName.get(`${entry.exchange}:${name}`);
  if (entry.logo?.provider === "catalog-alias" && match && match.id !== entry.id) {
    return {
      ...entry,
      logo: {
        ...readableOriginalTreatment(match.logo),
        provider: "catalog-alias",
        matchedId: match.id,
      },
    };
  }
  if (entry.logo) return entry;
  if (entry.logoStatus === "duplicate-review" || name.length < 5) return entry;
  if (!match) return entry;
  aliases += 1;
  const cleanEntry = { ...entry };
  delete cleanEntry.logoStatus;
  delete cleanEntry.logoError;
  return {
    ...cleanEntry,
    logo: {
      ...readableOriginalTreatment(match.logo),
      provider: "catalog-alias",
      matchedId: match.id,
    },
  };
});

const colourSourcePriority = {
  "manual-override": 4,
  "simple-icons-brand": 3,
  "logo-derived": 2,
  "verified-family": 1,
  "neutral-fallback": 0,
};
const familyColourByListing = new Map();
for (const family of verifiedLogoFamilies) {
  const candidates = manifest.entries
    .filter((entry) => family.members.includes(entry.id) && entry.logo)
    .filter((entry) => entry.logo.orbColourSource !== "neutral-fallback")
    .sort((left, right) => (
      (colourSourcePriority[right.logo.orbColourSource] ?? 1)
      - (colourSourcePriority[left.logo.orbColourSource] ?? 1)
    ));
  const anchor = candidates[0];
  if (!anchor) continue;
  for (const id of family.members) {
    familyColourByListing.set(id, { anchor, family });
  }
}
manifest.entries = manifest.entries.map((entry) => {
  const familyMatch = familyColourByListing.get(entry.id);
  if (!entry.logo || !familyMatch || entry.logo.orbColourSource !== "neutral-fallback") return entry;
  return {
    ...entry,
    logo: {
      ...entry.logo,
      orbColour: familyMatch.anchor.logo.orbColour,
      orbColourSeed: familyMatch.anchor.logo.orbColourSeed ?? familyMatch.anchor.logo.orbColour,
      orbColourSource: "verified-family",
      orbColourSourceRef: familyMatch.anchor.id,
      orbColourSourceUrl: familyMatch.family.source,
      orbColourFamily: familyMatch.family.id,
    },
  };
});

const companyStopWords = new Set([
  "acquisition", "ag", "and", "bank", "class", "co", "company", "corp", "corporation",
  "development", "enterprise", "enterprises", "etf", "fund", "group", "holding", "holdings",
  "inc", "international", "intl", "investment", "investments", "limited", "ltd", "ordinary",
  "partners", "plc", "shares", "technology", "technologies", "trust", "unit", "units", "warrant",
  "warrants", "china", "chinese", "beijing", "chongqing", "fujian", "guangdong", "guangzhou",
  "hangzhou", "jiangsu", "nanjing", "ningbo", "shandong", "shanghai", "shenzhen", "zhejiang",
  "the", "of", "ii", "iii", "iv", "incorporated",
]);

function significantTokens(value) {
  return new Set(normalizedName(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !companyStopWords.has(token)));
}

// A prior finalization may already have quarantined a shared mark. Restore it
// when every repeated candidate can now be explained by an explicitly verified
// family; this makes newly verified families effective without redownloading.
const verifiedCandidateGroups = new Map();
for (const entry of manifest.entries) {
  if (entry.logo || entry.logoStatus !== "duplicate-review" || !entry.logoCandidate) continue;
  if (!verifiedLogoFamilyByListing.has(entry.id)) continue;
  const logoPath = path.join(root, "public", entry.logoCandidate.path.replace(/^\//, ""));
  const hash = createHash("sha1").update(await readFile(logoPath)).digest("hex");
  const group = verifiedCandidateGroups.get(hash) ?? [];
  group.push(entry);
  verifiedCandidateGroups.set(hash, group);
}

const restoredVerifiedIds = new Set();
for (const group of verifiedCandidateGroups.values()) {
  const companies = [...new Map(group.map((entry) => [normalizedName(entry.company), entry])).values()];
  if (companies.length < 2) continue;
  const families = new Set(companies.map((entry) => verifiedLogoFamilyByListing.get(entry.id)?.id));
  if (families.size !== 1 || families.has(undefined)) continue;
  group.forEach((entry) => restoredVerifiedIds.add(entry.id));
}

manifest.entries = manifest.entries.map((entry) => {
  if (!restoredVerifiedIds.has(entry.id)) return entry;
  const restored = { ...entry, logo: entry.logoCandidate };
  delete restored.logoCandidate;
  delete restored.logoStatus;
  delete restored.logoError;
  return restored;
});

// Finalization is the last enforcement boundary. Check every retained provider
// here so aliases, verified-family candidates, and later source integrations
// cannot bypass importer validation or restore a quarantined source.
const finalizerResolutionFailures = new Map();
const finalizerMeasurements = new Map();
const finalizerCandidates = manifest.entries.filter((entry) => entry.logo);
let nextFinalizerCandidate = 0;
async function finalizerResolutionWorker() {
  while (nextFinalizerCandidate < finalizerCandidates.length) {
    const entry = finalizerCandidates[nextFinalizerCandidate];
    nextFinalizerCandidate += 1;
    const sourcePath = path.join(root, "public", entry.logo.sourcePath.replace(/^\//, ""));
    const cacheKey = `${sourcePath}:${JSON.stringify(entry.logo.crop ?? null)}`;
    let measurementPromise = finalizerMeasurements.get(cacheKey);
    if (!measurementPromise) {
      const floor = entry.logo.provider === "wikimedia-commons" && entry.logo.lookup === "wikidata-ticker"
        ? EXACT_TICKER_LOGO_RESOLUTION_FLOOR
        : undefined;
      measurementPromise = measureLogoResolution(sourcePath, entry.logo.crop, floor);
      finalizerMeasurements.set(cacheKey, measurementPromise);
    }
    try {
      const measurement = await measurementPromise;
      if (!measurement.passes) finalizerResolutionFailures.set(entry.id, measurement);
    } catch (error) {
      finalizerResolutionFailures.set(entry.id, {
        width: 0,
        height: 0,
        sharpness: null,
        translucentPixelShare: null,
        reasons: ["unreadable"],
        error: error.message,
      });
    }
  }
}
await Promise.all(Array.from(
  { length: Math.min(32, finalizerCandidates.length) },
  finalizerResolutionWorker,
));

manifest.entries = manifest.entries.map((entry) => {
  const measurement = finalizerResolutionFailures.get(entry.id);
  if (!measurement) return entry;
  const withoutLogo = { ...entry };
  delete withoutLogo.logo;
  return {
    ...withoutLogo,
    logo: null,
    logoStatus: "low-resolution",
    logoError: `${resolutionFailureMessage(measurement)} Finalizer candidate was not restored.`,
  };
});

const pathHashes = new Map();
const duplicateGroups = new Map();
for (const entry of manifest.entries) {
  if (!entry.logo || entry.logo.provider === "mvp-reference") continue;
  const logoPath = path.join(root, "public", entry.logo.path.replace(/^\//, ""));
  let hash = pathHashes.get(logoPath);
  if (!hash) {
    hash = createHash("sha1").update(await readFile(logoPath)).digest("hex");
    pathHashes.set(logoPath, hash);
  }
  const group = duplicateGroups.get(hash) ?? [];
  group.push(entry);
  duplicateGroups.set(hash, group);
}

const duplicateReviewIds = new Set();
let verifiedSharedLogos = 0;
for (const group of duplicateGroups.values()) {
  const companies = [...new Map(group.map((entry) => [normalizedName(entry.company), entry])).values()];
  if (companies.length < 4) continue;
  const verifiedFamilyCounts = new Map();
  for (const entry of companies) {
    const family = verifiedLogoFamilyByListing.get(entry.id);
    if (family) verifiedFamilyCounts.set(family.id, (verifiedFamilyCounts.get(family.id) ?? 0) + 1);
  }
  const verifiedFamily = [...verifiedFamilyCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .find(([, occurrences]) => occurrences / companies.length >= 0.55)?.[0];
  const tokenCounts = new Map();
  for (const entry of companies) {
    for (const token of significantTokens(entry.company)) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }
  const family = verifiedFamily ?? [...tokenCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .find(([, occurrences]) => occurrences / companies.length >= 0.55)?.[0];
  for (const entry of group) {
    const belongsToFamily = verifiedFamily
      ? verifiedLogoFamilyByListing.get(entry.id)?.id === verifiedFamily
      : Boolean(family && significantTokens(entry.company).has(family));
    if (belongsToFamily) {
      if (verifiedFamily) verifiedSharedLogos += 1;
    } else {
      duplicateReviewIds.add(entry.id);
    }
  }
}

manifest.entries = manifest.entries.map((entry) => {
  if (!duplicateReviewIds.has(entry.id)) return entry;
  const withoutLogo = { ...entry };
  const logoCandidate = withoutLogo.logo;
  delete withoutLogo.logo;
  return {
    ...withoutLogo,
    logo: null,
    logoCandidate,
    logoStatus: "duplicate-review",
    logoError: "Rendered mark is shared by unrelated company names and needs source verification.",
  };
});

const rejectedLogoSources = new Map([
  ["NASDAQ:PASW", "Cached asset is unrelated to Ping An Biomedical; use a verified fallback until a current company mark is available."],
]);
manifest.entries = manifest.entries.map((entry) => {
  const reason = rejectedLogoSources.get(entry.id);
  if (!reason || !entry.logo) return entry;
  const withoutLogo = { ...entry };
  const logoCandidate = withoutLogo.logo;
  delete withoutLogo.logo;
  return {
    ...withoutLogo,
    logo: null,
    logoCandidate,
    logoStatus: "wrong-source",
    logoError: reason,
  };
});

function contrastAssetPublicPath(entry, format, bytes) {
  const exchange = entry.exchange.toLocaleLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const symbol = entry.symbol.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "logo";
  const suffix = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  return `/logos/catalog/contrast/${exchange}/${symbol}-${suffix}.${format}`;
}

const contrastCounts = { selectivePaint: 0, silhouetteUnderlay: 0 };
const contrastCandidates = manifest.entries.filter((entry) => (
  entry.logo?.path
  && ["svg", "png"].includes(entry.logo.assetFormat)
  && entry.logo.logoTreatment !== "light"
  && !reviewedOriginalArtworkIds.has(entry.id)
));
let nextContrastCandidate = 0;
async function contrastWorker() {
  while (nextContrastCandidate < contrastCandidates.length) {
    const entry = contrastCandidates[nextContrastCandidate];
    nextContrastCandidate += 1;
    const sourcePublicPath = entry.logo.logoContrastSourcePath ?? entry.logo.path;
    const sourcePath = path.join(root, "public", sourcePublicPath.replace(/^\/+/, ""));
    try {
      const wordmark = isWordmarkLogo(entry.logo);
      const result = await correctLogoContrast(
        await readFile(sourcePath),
        entry.logo.assetFormat,
        entry.logo.orbColour,
        { wordmark },
      );
      if (result.kind === "none") {
        entry.logo.path = sourcePublicPath;
        if (result.preserveOriginal) {
          entry.logo.logoTreatment = "original";
          entry.logo.orbColourAdjustment = "preserved-container-contrast";
        }
        delete entry.logo.logoContrastSourcePath;
        delete entry.logo.logoContrastAdjustment;
        delete entry.logo.logoPaintAdjustments;
        continue;
      }
      const outputPublicPath = contrastAssetPublicPath(entry, entry.logo.assetFormat, result.bytes);
      const outputPath = path.join(root, "public", outputPublicPath.replace(/^\/+/, ""));
      await mkdir(path.dirname(outputPath), { recursive: true });
      const temporaryPath = `${outputPath}.process`;
      await writeFile(temporaryPath, result.bytes);
      await rename(temporaryPath, outputPath);
      entry.logo.path = outputPublicPath;
      entry.logo.logoContrastSourcePath = sourcePublicPath;
      entry.logo.logoContrastAdjustment = result.kind;
      entry.logo.logoTreatment = "original";
      entry.logo.orbColourAdjustment = result.kind === "selective-paint"
        ? "selective-logo-contrast"
        : "silhouette-logo-contrast";
      if (result.adjustments.length) entry.logo.logoPaintAdjustments = result.adjustments;
      else delete entry.logo.logoPaintAdjustments;
      if (result.kind === "selective-paint") contrastCounts.selectivePaint += 1;
      else contrastCounts.silhouetteUnderlay += 1;
    } catch (error) {
      console.warn(`Contrast correction skipped for ${entry.id}: ${error.message}`);
    }
  }
}
await Promise.all(Array.from(
  { length: Math.min(8, contrastCandidates.length) },
  contrastWorker,
));
manifest.entries = manifest.entries.map(applyReviewedTreatmentOverride);

const missing = manifest.entries.filter((entry) => entry.logoStatus === "missing").length;
const failed = manifest.entries.filter((entry) => entry.logoStatus === "failed").length;
const wrongSource = manifest.entries.filter((entry) => entry.logoStatus === "wrong-source").length;
const lowResolution = manifest.entries.filter((entry) => entry.logoStatus === "low-resolution").length;
const duplicateReview = manifest.entries.filter((entry) => entry.logoStatus === "duplicate-review").length;
const sourceReviewCount = manifest.entries.filter((entry) => !entry.logo).length;
const orbColourSources = {};
for (const entry of manifest.entries) {
  if (!entry.logo) continue;
  const source = entry.logo.orbColourSource ?? "legacy-unrecorded";
  orbColourSources[source] = (orbColourSources[source] ?? 0) + 1;
}
manifest.summary = {
  ...manifest.summary,
  aliases,
  missing,
  failed,
  wrongSource,
  lowResolution,
  finalizerResolutionReview: finalizerResolutionFailures.size,
  duplicateReview,
  verifiedSharedLogos,
  logoContrastAdjustments: contrastCounts,
  sourceReview: sourceReviewCount,
  orbColourSources,
};
manifest.finalizedAt = new Date().toISOString();

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function googleLogoSearchUrl(entry) {
  const query = `"${entry.company}" company logo ${entry.exchange} ${entry.symbol}`;
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

const sourceReview = manifest.entries.filter((entry) => !entry.logo);
const sourceReviewCsv = [
  ["exchange", "symbol", "company", "status", "error", "google_image_search"],
  ...sourceReview.map((entry) => [
    entry.exchange,
    entry.symbol,
    entry.company,
    entry.logoStatus,
    entry.logoError ?? "",
    googleLogoSearchUrl(entry),
  ]),
].map((row) => row.map(csvCell).join(",")).join("\n");

const temporaryPath = `${manifestPath}.finalize`;
await writeFile(temporaryPath, `${JSON.stringify(manifest)}\n`, "utf8");
await rename(temporaryPath, manifestPath);
await writeFile(path.join(path.dirname(manifestPath), "source-review.csv"), `${sourceReviewCsv}\n`, "utf8");
console.log(`Linked ${aliases} unresolved listings to an exact-name logo on the same exchange.`);
console.log(`Accepted ${verifiedSharedLogos} logos from explicitly verified corporate families.`);
console.log(`Rejected ${finalizerResolutionFailures.size} retained logos below the resolution floor.`);
console.log(`Quarantined ${duplicateReview} suspicious repeated marks.`);
console.log(`Adjusted ${contrastCounts.selectivePaint} chromatic logos selectively and added ${contrastCounts.silhouetteUnderlay} silhouette underlays.`);
console.log(`Remaining source review: ${sourceReviewCount} (${missing} missing, ${failed} failed, ${wrongSource} wrong source, ${lowResolution} below resolution floor, ${duplicateReview} duplicates).`);
