import {
  hexToRgb,
  hslToRgb,
  hueDistance,
  mixRgb,
  normaliseHexColour,
  rgbToHex,
  rgbToHsl,
  shiftHueToward,
  stableColourIndex,
  type HSL,
} from "./color";
import { ORB_MARKET_COLOURS, ORB_TOKENS, type OrbMarketPalettes } from "./tokens";
import type { OrbDefinition, OrbDefinitionInput, OrbPalette } from "./types";

function anchoredColour(input: HSL, anchorInput: string, anchorOutput: string) {
  const from = rgbToHsl(hexToRgb(anchorInput));
  const to = rgbToHsl(hexToRgb(anchorOutput));
  const hueDelta = ((((input.h - from.h) % 360) + 540) % 360) - 180;
  return hslToRgb({
    h: to.h + hueDelta,
    s: Math.max(0, Math.min(1, to.s + input.s - from.s)),
    l: Math.max(0.05, Math.min(0.95, to.l + input.l - from.l)),
  });
}

export function deriveOrbPalette(inputColour: string): OrbPalette {
  const colour = normaliseHexColour(inputColour);
  const tokens = ORB_TOKENS.palette;
  const hsl = rgbToHsl(hexToRgb(colour));
  const sourceHue = hsl.s > 0.03 ? hsl.h : tokens.achromaticHue;
  const sourceSaturation = Math.max(hsl.s, hsl.s > 0.03 ? hsl.s : tokens.achromaticSaturation);
  let base = hexToRgb(colour);
  let sheen = hslToRgb({
    h: shiftHueToward(sourceHue, tokens.sheenHueTarget, tokens.sheenHueShift),
    s: Math.max(
      tokens.sheenMinimumSaturation,
      Math.min(tokens.sheenMaximumSaturation, sourceSaturation * tokens.sheenSaturationMultiplier + tokens.sheenSaturationOffset),
    ),
    l: Math.min(tokens.sheenMaximumLightness, hsl.l + tokens.sheenLightnessOffset),
  });
  let shadow = hslToRgb({
    h: shiftHueToward(sourceHue, tokens.shadowHueTarget, tokens.shadowHueShift),
    s: Math.min(1, sourceSaturation * tokens.shadowSaturationMultiplier + tokens.shadowSaturationOffset),
    l: Math.max(
      tokens.shadowMinimumLightness,
      Math.min(tokens.shadowMaximumLightness, hsl.l * tokens.shadowLightnessMultiplier),
    ),
  });

  if (hsl.s > tokens.neighbourhoodMinimumSaturation) {
    for (const neighbourhood of tokens.neighbourhoods) {
      const anchor = rgbToHsl(hexToRgb(neighbourhood.colour));
      const proximity = Math.max(0, 1 - hueDistance(hsl.h, anchor.h) / neighbourhood.radius);
      const weight = proximity * proximity * (3 - 2 * proximity);
      if (weight === 0) continue;
      base = mixRgb(base, anchoredColour(hsl, neighbourhood.colour, neighbourhood.base), weight);
      sheen = mixRgb(sheen, anchoredColour(hsl, neighbourhood.colour, neighbourhood.sheen), weight);
      shadow = mixRgb(shadow, anchoredColour(hsl, neighbourhood.colour, neighbourhood.shadow), weight);
    }
  }

  const sheenHsl = rgbToHsl(sheen);
  sheen = hslToRgb({
    ...sheenHsl,
    s: Math.min(1, sheenHsl.s * tokens.sheenFinalSaturationMultiplier + tokens.sheenFinalSaturationOffset),
  });

  return { colour, base: rgbToHex(base), sheen: rgbToHex(sheen), shadow: rgbToHex(shadow) };
}

export function colourForMarket(
  market: string,
  stableKey: string | number,
  marketPalettes: OrbMarketPalettes = ORB_MARKET_COLOURS,
) {
  const colours = marketPalettes[market];
  if (!colours?.length) throw new TypeError(`No orb colour space is configured for market: ${market}`);
  return colours[stableColourIndex(`${market}:${stableKey}`, colours.length)];
}

export function createOrbDefinition(input: OrbDefinitionInput): OrbDefinition {
  return {
    ticker: String(input.ticker),
    number: String(input.number),
    palette: input.palette ?? deriveOrbPalette(input.colour ?? ORB_TOKENS.fallbackColour),
  };
}

export function createMarketOrbDefinition(
  input: Omit<OrbDefinitionInput, "colour"> & {
    market: string;
    colour?: string;
    stableKey?: string | number;
    marketPalettes?: OrbMarketPalettes;
  },
): OrbDefinition {
  const { market, stableKey, marketPalettes, ...orbInput } = input;
  return createOrbDefinition({
    ...orbInput,
    colour: input.colour ?? colourForMarket(
      market,
      stableKey ?? `${input.ticker}:${input.number}`,
      marketPalettes,
    ),
  });
}
