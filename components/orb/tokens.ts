export const ORB_TOKENS = {
  fallbackColour: "#ff00aa",
  palette: {
    achromaticHue: 196,
    achromaticSaturation: 0.48,
    sheenHueTarget: 55,
    sheenHueShift: 0.21,
    sheenMinimumSaturation: 0.28,
    sheenMaximumSaturation: 0.96,
    sheenSaturationMultiplier: 0.9,
    sheenSaturationOffset: 0.1,
    sheenLightnessOffset: 0.3,
    sheenMaximumLightness: 0.88,
    sheenFinalSaturationMultiplier: 1.16,
    sheenFinalSaturationOffset: 0.06,
    shadowHueTarget: 235,
    shadowHueShift: 0.12,
    shadowSaturationMultiplier: 1.36,
    shadowSaturationOffset: 0.14,
    shadowMinimumLightness: 0.2,
    shadowMaximumLightness: 0.48,
    shadowLightnessMultiplier: 0.66,
    neighbourhoodMinimumSaturation: 0.25,
    neighbourhoods: [
      { colour: "#fade4b", base: "#fade4b", sheen: "#fdf18b", shadow: "#ef8b34", radius: 38 },
      { colour: "#eb5128", base: "#ea3323", sheen: "#eb4034", shadow: "#bb271d", radius: 42 },
      { colour: "#ea33e3", base: "#ea33e3", sheen: "#f0a0cd", shadow: "#c90062", radius: 46 },
    ],
  },
  presentation: {
    contrastReference: "#506868",
    minimumContrast: 3,
    shadowOpacity: 0.4,
    numberDarken: 0.18,
    lightInkTint: 0.1,
    yellowGreenInkRange: [35, 115] as const,
    cyanInkMaximumHue: 200,
    navyInk: "#10264f",
    cyanInk: "#063a43",
    neutralInk: "#141923",
    tickerMinimumScale: 0.72,
    tickerMaximumScale: 1.68,
    compactTickerMaximumScale: 1.38,
    tickerTargetCharacters: 5,
  },
} as const;

export const ORB_MARKET_COLOURS = {
  HK: ["#ff003d", "#ff2a00", "#ff5a00", "#ff006e", "#ff0099"],
  KR: ["#00f0ff", "#00ffd5", "#00ffb2", "#00ff66", "#9dff00", "#00d8ff"],
  JP: ["#fff000", "#ffd000", "#ffb800", "#ffe600", "#ffcf00"],
} as const;

export type OrbMarket = keyof typeof ORB_MARKET_COLOURS;
export type OrbMarketPalettes = Readonly<Record<string, readonly string[]>>;

export const ORB_CSS_VARIABLES = {
  size: "--hudi-orb-size",
  base: "--hudi-orb-base",
  sheen: "--hudi-orb-sheen",
  shadow: "--hudi-orb-shadow",
  darkRing: "--hudi-orb-dark-ring",
  lightRing: "--hudi-orb-light-ring",
  ringWidth: "--hudi-orb-ring-width",
  ringDepth: "--hudi-orb-ring-depth",
  glowStrength: "--hudi-orb-glow-strength",
  glowRadius: "--hudi-orb-glow-radius",
  displayFont: "--hudi-orb-display-font",
  readoutFont: "--hudi-orb-readout-font",
} as const;
