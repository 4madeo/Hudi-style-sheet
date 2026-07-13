import type { CSSProperties } from "react";

export type OrbTheme = "light" | "dark" | "inherit";

export type OrbPalette = {
  colour: string;
  base: string;
  sheen: string;
  shadow: string;
};

export type OrbPaletteToken = keyof OrbPalette;

export type OrbStyle = CSSProperties & Partial<Record<`--hudi-orb-${string}`, string | number>>;

export type OrbDefinition = {
  ticker: string;
  number: string;
  palette: OrbPalette;
};

export type OrbDefinitionInput = {
  ticker: string;
  number: string | number;
  colour?: string;
  palette?: OrbPalette;
};

export type TickerOrbProps = OrbDefinitionInput & {
  size?: number | string;
  compact?: boolean;
  theme?: OrbTheme;
  glow?: boolean;
  className?: string;
  style?: OrbStyle;
  ariaLabel?: string;
  decorative?: boolean;
};
