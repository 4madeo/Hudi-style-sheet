import { hexToRgb, mixRgb, rgbToHex } from "./color";
import { getOrbPresentation } from "./presentation";
import type { OrbPalette } from "./types";

export type OrbExportScalePreset = Readonly<{
  size: number;
  compact: boolean;
  ringWidth: number;
  ringDepth: number;
}>;

export const ORB_EXPORT_SCALES = {
  generator: {
    size: 460,
    compact: false,
    ringWidth: 2.76,
    ringDepth: 5.52,
  },
  "ticker-page": {
    size: 136,
    compact: true,
    ringWidth: 2.75,
    ringDepth: 5.5,
  },
  blotter: {
    size: 24,
    compact: true,
    ringWidth: 0.875,
    ringDepth: 1.75,
  },
} as const satisfies Record<string, OrbExportScalePreset>;

export type OrbExportScaleName = keyof typeof ORB_EXPORT_SCALES;
export type OrbExportTheme = "light" | "dark";

export type OrbExportFonts = Readonly<{
  displayDataUri: string;
  readoutDataUri: string;
}>;

export type CreateOrbSvgOptions = {
  fonts?: OrbExportFonts;
  title?: string;
  theme?: OrbExportTheme;
};

const XML_CHARACTERS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&apos;",
};

function escapeXml(value: string | number) {
  return String(value).replace(/[&<>"']/g, (character) => XML_CHARACTERS[character]);
}

/**
 * Creates one self-contained, editable-text SVG. Static IDs are safe because
 * each export is a separate SVG document.
 */
export function createOrbSvg(
  ticker: string | number,
  number: string | number,
  palette: OrbPalette,
  scaleName: OrbExportScaleName,
  options: CreateOrbSvgOptions = {},
) {
  const scale = ORB_EXPORT_SCALES[scaleName];
  if (!scale) throw new TypeError(`Unknown orb export scale: ${String(scaleName)}`);

  const resolvedTicker = String(ticker);
  const resolvedNumber = String(number);
  const presentation = getOrbPresentation(palette, resolvedTicker, scale.compact);
  const size = scale.size;
  const radius = size / 2;
  const depthShadowOffset = size * -0.061625;
  const depthShadowDeviation = size * 0.643984 / 2;
  const edgeSheenDeviation = size * 0.09 / 2;
  const tickerFontSize = 18.48 * presentation.tickerScale;
  const chipOffset = presentation.whiteText
    ? (scale.compact ? -0.8 : -0.5)
    : (scale.compact ? 0.8 : 0.5);
  const chipColour = presentation.whiteText ? "#000000" : "#ffffff";
  const chipOpacity = scale.compact
    ? (presentation.whiteText ? 0.4 : 0.42)
    : 0.25;

  const shadow = hexToRgb(palette.shadow);
  const darkRingAlpha = 0.4 * 0.75 + 0.42 * 0.25;
  const darkRingShadowWeight = 0.4 * 0.75 / darkRingAlpha;
  const darkRing = rgbToHex(mixRgb(
    { r: 0, g: 0, b: 0 },
    shadow,
    darkRingShadowWeight,
  ));
  const lightRing = rgbToHex(mixRgb(
    hexToRgb(palette.sheen),
    { r: 255, g: 255, b: 255 },
    0.38,
  ));
  const darkTheme = options.theme === "dark";
  const outerRing = darkTheme ? lightRing : darkRing;
  const outerRingOpacity = darkTheme ? 0.72 : darkRingAlpha;
  const innerRing = darkTheme ? darkRing : lightRing;
  const innerRingOpacity = darkTheme ? darkRingAlpha : 0.72;

  const title = escapeXml(options.title ?? `${resolvedTicker} ${resolvedNumber}`);
  const safeTicker = escapeXml(resolvedTicker);
  const safeNumber = escapeXml(resolvedNumber);
  const safeBase = escapeXml(palette.base);
  const safeSheen = escapeXml(palette.sheen);
  const safeShadow = escapeXml(palette.shadow);
  const safeNumberColour = escapeXml(presentation.numberColour);
  const safeDarkInkTop = escapeXml(presentation.darkInk.top);
  const safeDarkInkBottom = escapeXml(presentation.darkInk.bottom);
  const safeLightInk = escapeXml(presentation.lightInk);
  const safeOuterRing = escapeXml(outerRing);
  const safeInnerRing = escapeXml(innerRing);
  const embeddedFontFaces = options.fonts ? `
      @font-face {
        font-family: "Hudi Export Diatype Expanded";
        src: url("${options.fonts.displayDataUri}") format("opentype");
        font-style: normal;
        font-weight: 700;
      }
      @font-face {
        font-family: "Hudi Export OCR";
        src: url("${options.fonts.readoutDataUri}") format("opentype");
        font-style: normal;
        font-weight: 400;
      }` : "";
  const displayFontFamily = options.fonts
    ? '"Hudi Export Diatype Expanded", "Diatype Expanded", "Arial Black", sans-serif'
    : '"Diatype Expanded", "Arial Black", sans-serif';
  const readoutFontFamily = options.fonts
    ? '"Hudi Export OCR", "OCRA Fixed", ui-monospace, monospace'
    : '"OCRA Fixed", ui-monospace, monospace';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="orb-title">
  <title id="orb-title">${title}</title>
  <defs>
    <clipPath id="orb-clip" clipPathUnits="userSpaceOnUse">
      <circle cx="${radius}" cy="${radius}" r="${radius}" />
    </clipPath>
    <linearGradient id="orb-body-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="${safeSheen}" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <filter id="orb-body-inner-shadows" x="${-size}" y="${-size}" width="${size * 3}" height="${size * 3}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feComponentTransfer in="SourceAlpha" result="inverse-alpha">
        <feFuncA type="table" tableValues="1 0" />
      </feComponentTransfer>
      <feGaussianBlur in="inverse-alpha" stdDeviation="${depthShadowDeviation}" result="depth-blur" />
      <feOffset in="depth-blur" dy="${depthShadowOffset}" result="depth-offset" />
      <feComposite in="depth-offset" in2="SourceAlpha" operator="in" result="depth-mask" />
      <feFlood flood-color="${safeShadow}" flood-opacity="0.4" result="depth-colour" />
      <feComposite in="depth-colour" in2="depth-mask" operator="in" result="depth-shadow" />
      <feGaussianBlur in="inverse-alpha" stdDeviation="${edgeSheenDeviation}" result="edge-blur" />
      <feComposite in="edge-blur" in2="SourceAlpha" operator="in" result="edge-mask" />
      <feFlood flood-color="${safeSheen}" flood-opacity="0.58" result="edge-colour" />
      <feComposite in="edge-colour" in2="edge-mask" operator="in" result="edge-sheen" />
      <feMerge>
        <feMergeNode in="edge-sheen" />
        <feMergeNode in="depth-shadow" />
      </feMerge>
    </filter>
    <linearGradient id="orb-wide-highlight" x1="0.5" y1="1" x2="0.5" y2="0" gradientTransform="rotate(-0.58 0.5 0.5)">
      <stop offset="0.5%" stop-color="#ffffff" stop-opacity="0" />
      <stop offset="99.5%" stop-color="#ffffff" />
    </linearGradient>
    <radialGradient id="orb-top-highlight" cx="0.5" cy="0.5" r="0.5158">
      <stop stop-color="#ffffff" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.14" />
    </radialGradient>
    <filter id="orb-number-inner" x="-15%" y="-45%" width="130%" height="190%" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="background" />
      <feBlend in="SourceGraphic" in2="background" result="shape" />
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hard-alpha" />
      <feOffset dy="0.45" />
      <feGaussianBlur stdDeviation="0.38" />
      <feComposite in2="hard-alpha" operator="arithmetic" k2="-1" k3="1" result="inner-alpha" />
      <feFlood flood-color="#000000" flood-opacity="0.22" result="inner-tint" />
      <feComposite in="inner-tint" in2="inner-alpha" operator="in" result="inner-shadow" />
      <feBlend in="inner-shadow" in2="shape" />
    </filter>
    <linearGradient id="orb-ticker-gradient" x1="50" y1="12" x2="50" y2="28" gradientUnits="userSpaceOnUse">
      <stop stop-color="${safeDarkInkTop}" />
      <stop offset="1" stop-color="${safeDarkInkBottom}" />
    </linearGradient>
    <style>
${embeddedFontFaces}
      .orb-number-text {
        font-family: ${readoutFontFamily};
        font-size: 15px;
        letter-spacing: 0.06em;
      }
      .orb-ticker-text {
        font-family: ${displayFontFamily};
        font-size: ${tickerFontSize}px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
    </style>
  </defs>
  <g clip-path="url(#orb-clip)">
    <circle cx="${radius}" cy="${radius}" r="${radius}" fill="${safeBase}" />
    <circle cx="${radius}" cy="${radius}" r="${radius}" fill="url(#orb-body-sheen)" />
    <circle cx="${radius}" cy="${radius}" r="${radius}" fill="#ffffff" filter="url(#orb-body-inner-shadows)" />
    <ellipse cx="50.6%" cy="26.8%" rx="32%" ry="23%" fill="url(#orb-wide-highlight)" />
    <ellipse cx="50.22%" cy="10.13%" rx="18.17%" ry="9.03%" fill="url(#orb-top-highlight)" />
    <svg x="22%" y="0" width="56%" height="28%" viewBox="0 0 100 32" overflow="visible" opacity="0.75">
      <path id="number-curve" d="M 18 26 A 200 200 0 0 1 82 26" fill="none" />
      <text class="orb-number-text" fill="${safeNumberColour}" text-anchor="middle" filter="url(#orb-number-inner)">
        <textPath href="#number-curve" startOffset="50%">${safeNumber}</textPath>
      </text>
    </svg>
    <svg x="0" y="37.5%" width="100%" height="34%" viewBox="0 0 100 38" overflow="visible">
      <text class="orb-ticker-text" x="50" y="19" dy="${chipOffset}" text-anchor="middle" dominant-baseline="middle" fill="${chipColour}" fill-opacity="${chipOpacity}">${safeTicker}</text>
      <text class="orb-ticker-text" x="50" y="19" text-anchor="middle" dominant-baseline="middle" fill="${presentation.whiteText ? safeLightInk : "url(#orb-ticker-gradient)"}">${safeTicker}</text>
    </svg>
  </g>
  <circle cx="${radius}" cy="${radius}" r="${radius - scale.ringDepth / 2}" fill="none" stroke="${safeInnerRing}" stroke-opacity="${innerRingOpacity}" stroke-width="${scale.ringDepth}" />
  <circle cx="${radius}" cy="${radius}" r="${radius - scale.ringWidth / 2}" fill="none" stroke="${safeOuterRing}" stroke-opacity="${outerRingOpacity}" stroke-width="${scale.ringWidth}" />
</svg>`;
}
