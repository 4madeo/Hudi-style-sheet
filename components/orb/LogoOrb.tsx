"use client";

import { useId, useMemo, useState } from "react";
import { deriveOrbPalette } from "./palette";
import { getOrbPresentation } from "./presentation";
import { ORB_TOKENS } from "./tokens";
import type { LogoOrbProps, OrbStyle } from "./types";
import "./orb.css";

const COMPANY_SUFFIXES = new Set([
  "acquisition", "ag", "and", "class", "co", "company", "corp", "corporation",
  "fund", "group", "holding", "holdings", "inc", "international", "investment",
  "investments", "limited", "ltd", "ordinary", "plc", "shares", "the", "trust",
  "unit", "units", "warrant", "warrants",
]);

function graphemes(value: string) {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)]
    .map((segment) => segment.segment);
}

export function companyMonogram(company: string, fallbackKey = company) {
  const words = (company.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => !COMPANY_SUFFIXES.has(word.toLocaleLowerCase()));
  const meaningful = words.length ? words : (fallbackKey.match(/[\p{L}\p{N}]+/gu) ?? []);
  if (!meaningful.length) return "?";
  if (meaningful.length >= 2) {
    return meaningful.slice(0, 2).map((word) => graphemes(word)[0]).join("").toLocaleUpperCase();
  }
  return graphemes(meaningful[0]).slice(0, 2).join("").toLocaleUpperCase();
}

export function LogoOrb({
  company,
  logoUrl,
  fallbackKey = company,
  colour = ORB_TOKENS.fallbackColour,
  palette,
  logoTreatment = "original",
  logoScale = 0.58,
  logoOffsetY = 0,
  size,
  compact = false,
  theme = "inherit",
  glow = true,
  className = "",
  style,
  ariaLabel,
  decorative = false,
}: LogoOrbProps) {
  const [loadedLogoUrl, setLoadedLogoUrl] = useState<string>();
  const instanceId = useId().replace(/:/g, "");
  const monogramGradientId = `orb-monogram-gradient-${instanceId}`;
  const liftFilterId = `orb-logo-lift-${instanceId}`;
  const tintFilterId = `orb-logo-tint-${instanceId}`;
  const knockoutFilterId = `orb-logo-knockout-${instanceId}`;
  const logoLoaded = Boolean(logoUrl && loadedLogoUrl === logoUrl);
  const fallbackMonogram = useMemo(
    () => companyMonogram(company, fallbackKey),
    [company, fallbackKey],
  );
  const resolvedPalette = palette ?? deriveOrbPalette(colour);
  const presentation = getOrbPresentation(resolvedPalette, fallbackMonogram, compact);
  const classes = [
    "hudi-orb",
    "logo-orb",
    presentation.whiteText && "is-auto-white",
    compact && "is-compact",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const resolvedSize = typeof size === "number" ? `${size}px` : size;
  const resolvedLogoScale = Math.max(0.36, Math.min(0.72, logoScale));
  const resolvedLogoOffsetY = Math.max(-0.12, Math.min(0.12, logoOffsetY));
  const orbStyle = {
    "--hudi-orb-base": resolvedPalette.base,
    "--hudi-orb-sheen": resolvedPalette.sheen,
    "--hudi-orb-shadow": presentation.shadow,
    "--hudi-orb-logo-scale": resolvedLogoScale,
    "--hudi-orb-logo-offset-y": `${resolvedLogoOffsetY * 100}%`,
    ...(resolvedSize ? { "--hudi-orb-size": resolvedSize } : {}),
    ...style,
  } as OrbStyle;

  return (
    <div
      className={classes}
      style={orbStyle}
      data-logo-treatment={logoTreatment}
      data-logo-state={logoLoaded ? "loaded" : "fallback"}
      data-orb-theme={theme}
      data-orb-glow={glow ? "true" : "false"}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : (ariaLabel ?? `${company} logo orb`)}
    >
      <span className="hudi-orb__rings orb-rings" aria-hidden="true" />
      <span className="hudi-orb__logo-safe-zone" aria-hidden="true">
        <svg
          className="hudi-orb__fallback-monogram"
          viewBox="0 0 100 100"
          data-length={graphemes(fallbackMonogram).length}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={monogramGradientId} x1="50" y1="28" x2="50" y2="72" gradientUnits="userSpaceOnUse">
              <stop stopColor={presentation.darkInk.top} />
              <stop offset="1" stopColor={presentation.darkInk.bottom} />
            </linearGradient>
            <filter id={liftFilterId} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="linear" slope=".16" intercept=".8" />
                <feFuncG type="linear" slope=".16" intercept=".8" />
                <feFuncB type="linear" slope=".16" intercept=".8" />
              </feComponentTransfer>
            </filter>
            <filter id={tintFilterId} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="linear" slope=".4" intercept=".55" />
                <feFuncG type="linear" slope=".4" intercept=".55" />
                <feFuncB type="linear" slope=".4" intercept=".55" />
              </feComponentTransfer>
            </filter>
            <filter id={knockoutFilterId} colorInterpolationFilters="sRGB">
              <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -.2126 -.7152 -.0722 1 0" />
              <feComponentTransfer>
                <feFuncA type="discrete" tableValues="0 1 1 1 1" />
              </feComponentTransfer>
            </filter>
          </defs>
          <text
            className="hudi-orb__ticker-chip hudi-orb__fallback-chip"
            x="50"
            y="51"
            dy={presentation.whiteText ? (compact ? "-1.4" : "-1") : (compact ? "1.4" : "1")}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {fallbackMonogram}
          </text>
          <text
            className="hudi-orb__fallback-face"
            x="50"
            y="51"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={presentation.whiteText ? presentation.lightInk : `url(#${monogramGradientId})`}
          >
            {fallbackMonogram}
          </text>
        </svg>
      </span>
      {logoUrl ? (
        // Logo.dev and local catalog assets share this vector/raster image contract.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="hudi-orb__logo"
          src={logoUrl}
          alt=""
          draggable={false}
          style={logoTreatment === "lift"
            ? { filter: `url(#${liftFilterId})` }
            : logoTreatment === "tint" ? { filter: `url(#${tintFilterId})` }
            : logoTreatment === "knockout" ? { filter: `url(#${knockoutFilterId})` } : undefined}
          onLoad={() => setLoadedLogoUrl(logoUrl)}
          onError={() => setLoadedLogoUrl(undefined)}
        />
      ) : null}
    </div>
  );
}
