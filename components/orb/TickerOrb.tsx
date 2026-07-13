"use client";

import { useId } from "react";
import { deriveOrbPalette } from "./palette";
import { getOrbPresentation } from "./presentation";
import { ORB_TOKENS } from "./tokens";
import type { OrbStyle, TickerOrbProps } from "./types";
import "./orb.css";

export function TickerOrb({
  ticker,
  number,
  colour = ORB_TOKENS.fallbackColour,
  palette,
  size,
  compact = false,
  theme = "inherit",
  glow = true,
  className = "",
  style,
  ariaLabel,
  decorative = false,
}: TickerOrbProps) {
  const instanceId = useId().replace(/:/g, "");
  const numberFilterId = `orb-number-inner-${instanceId}`;
  const numberCurveId = `number-curve-${instanceId}`;
  const tickerGradientId = `orb-ticker-gradient-${instanceId}`;
  const resolvedTicker = String(ticker);
  const resolvedNumber = String(number);
  const resolvedPalette = palette ?? deriveOrbPalette(colour);
  const presentation = getOrbPresentation(resolvedPalette, resolvedTicker, compact);
  const classes = [
    "hudi-orb",
    "ticker-orb",
    presentation.whiteText && "is-auto-white",
    compact && "is-compact",
    className,
  ].filter(Boolean).join(" ");
  const resolvedSize = typeof size === "number" ? `${size}px` : size;
  const orbStyle = {
    "--hudi-orb-base": resolvedPalette.base,
    "--hudi-orb-sheen": resolvedPalette.sheen,
    "--hudi-orb-shadow": presentation.shadow,
    "--hudi-orb-number-colour": presentation.numberColour,
    "--hudi-orb-ticker-scale": presentation.tickerScale,
    "--hudi-orb-number-filter": `url(#${numberFilterId})`,
    ...(resolvedSize ? { "--hudi-orb-size": resolvedSize } : {}),
    ...style,
  } as OrbStyle;

  return (
    <div
      className={classes}
      style={orbStyle}
      data-orb-theme={theme}
      data-orb-glow={glow ? "true" : "false"}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : (ariaLabel ?? `${resolvedTicker} ${resolvedNumber}`)}
    >
      <span className="hudi-orb__rings orb-rings" aria-hidden="true" />
      <svg className="hudi-orb__number orb-number" viewBox="0 0 100 32" aria-hidden="true">
        <defs>
          <filter id={numberFilterId} x="-15%" y="-45%" width="130%" height="190%" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="background" />
            <feBlend in="SourceGraphic" in2="background" result="shape" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy=".45" />
            <feGaussianBlur stdDeviation=".38" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" result="innerAlpha" />
            <feFlood floodColor="#000" floodOpacity=".22" result="innerTint" />
            <feComposite in="innerTint" in2="innerAlpha" operator="in" result="innerShadow" />
            <feBlend in="innerShadow" in2="shape" />
          </filter>
        </defs>
        <path id={numberCurveId} d="M 18 26 A 200 200 0 0 1 82 26" fill="none" />
        <text textAnchor="middle">
          <textPath href={`#${numberCurveId}`} startOffset="50%">{resolvedNumber}</textPath>
        </text>
      </svg>

      <svg className="hudi-orb__ticker orb-ticker" viewBox="0 0 100 38" aria-hidden="true">
        <defs>
          <linearGradient id={tickerGradientId} x1="50" y1="12" x2="50" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor={presentation.darkInk.top} />
            <stop offset="1" stopColor={presentation.darkInk.bottom} />
          </linearGradient>
        </defs>
        <text
          className="hudi-orb__ticker-chip orb-ticker-chip"
          x="50"
          y="19"
          dy={presentation.whiteText ? (compact ? "-.8" : "-.5") : (compact ? ".8" : ".5")}
          textAnchor="middle"
          dominantBaseline="middle"
        >{resolvedTicker}</text>
        <text
          className="hudi-orb__ticker-face orb-ticker-face"
          x="50"
          y="19"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={presentation.whiteText ? presentation.lightInk : `url(#${tickerGradientId})`}
        >{resolvedTicker}</text>
      </svg>
    </div>
  );
}
