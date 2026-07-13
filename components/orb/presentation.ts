import { contrastRatio, hexToRgb, mixRgb, rgbToHex, rgbToHsl } from "./color";
import { ORB_TOKENS } from "./tokens";
import type { OrbPalette } from "./types";

function tickerInk(base: string) {
  const tokens = ORB_TOKENS.presentation;
  const baseRgb = hexToRgb(base);
  const hue = rgbToHsl(baseRgb).h;
  const usesNavy = hue >= tokens.yellowGreenInkRange[0] && hue <= tokens.yellowGreenInkRange[1];
  const anchor = usesNavy
    ? hexToRgb(tokens.navyInk)
    : hue > tokens.yellowGreenInkRange[1] && hue <= tokens.cyanInkMaximumHue
      ? hexToRgb(tokens.cyanInk)
      : hexToRgb(tokens.neutralInk);
  return {
    top: rgbToHex(mixRgb(anchor, baseRgb, usesNavy ? 0.16 : 0.32)),
    bottom: rgbToHex(mixRgb(anchor, baseRgb, usesNavy ? 0.1 : 0.24)),
  };
}

export function getOrbPresentation(palette: OrbPalette, ticker: string, compact: boolean) {
  const tokens = ORB_TOKENS.presentation;
  const whiteText = Math.min(
    contrastRatio(palette.base, tokens.contrastReference),
    contrastRatio(palette.sheen, tokens.contrastReference),
  ) < tokens.minimumContrast;
  const tickerScale = Math.max(
    tokens.tickerMinimumScale,
    Math.min(
      compact ? tokens.compactTickerMaximumScale : tokens.tickerMaximumScale,
      tokens.tickerTargetCharacters / Math.max(1, ticker.trim().length),
    ),
  );
  const shadow = hexToRgb(palette.shadow);

  return {
    whiteText,
    tickerScale,
    shadow: `rgba(${shadow.r}, ${shadow.g}, ${shadow.b}, ${tokens.shadowOpacity})`,
    numberColour: rgbToHex(mixRgb(hexToRgb(palette.base), { r: 0, g: 0, b: 0 }, tokens.numberDarken)),
    darkInk: tickerInk(palette.base),
    lightInk: rgbToHex(mixRgb({ r: 255, g: 255, b: 255 }, hexToRgb(palette.base), tokens.lightInkTint)),
  };
}

