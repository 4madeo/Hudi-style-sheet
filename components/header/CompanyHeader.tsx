"use client";

import type { Ref } from "react";
import { LogoOrb, type LogoTreatment, type OrbPalette, type OrbStyle } from "@/components/orb";
import "./company-header.css";

export type CompanyHeaderStat = {
  label: string;
  value: string;
};

export type CompanyHeaderProps = {
  company: string;
  market: string;
  logoUrl: string;
  logoTreatment?: LogoTreatment;
  logoScale?: number;
  logoOffsetY?: number;
  palette: OrbPalette;
  price: string;
  change: string;
  changePercent: string;
  changePositive?: boolean;
  stats: CompanyHeaderStat[];
  pickerOpen?: boolean;
  pickerButtonRef?: Ref<HTMLButtonElement>;
  onOpenPicker: () => void;
};

const headerOrbStyle: OrbStyle = {
  "--hudi-orb-ring-width": "1.25px",
  "--hudi-orb-ring-depth": "2.5px",
};

export function CompanyHeader({
  company,
  market,
  logoUrl,
  logoTreatment,
  logoScale,
  logoOffsetY,
  palette,
  price,
  change,
  changePercent,
  changePositive = true,
  stats,
  pickerOpen = false,
  pickerButtonRef,
  onOpenPicker,
}: CompanyHeaderProps) {
  return (
    <section className="company-header" data-change={changePositive ? "positive" : "negative"} aria-label={`${company} market header`}>
      <div className="company-header__orb" aria-hidden="true" style={{ color: palette.base }}>
        <LogoOrb
          company={company}
          logoUrl={logoUrl}
          logoTreatment={logoTreatment}
          logoScale={logoScale}
          logoOffsetY={logoOffsetY}
          palette={palette}
          size={48}
          compact
          decorative
          style={headerOrbStyle}
        />
      </div>

      <div className="company-header__identity">
        <div className="company-header__name-row">
          <h1 className="company-header__name">{company}</h1>
          <button
            className="company-header__picker-button"
            ref={pickerButtonRef}
            type="button"
            aria-label={`Choose a ticker. Currently ${company}`}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            aria-controls="header-ticker-selector"
            onClick={onOpenPicker}
          >
            <span aria-hidden="true" />
          </button>
        </div>
        <div className="company-header__tags" aria-label={`${market}, market open`}>
          <span className="company-header__tag">{market}</span>
          <span className="company-header__tag company-header__tag--status">
            <i aria-hidden="true" />
            OPEN
          </span>
        </div>
      </div>

      <div className="company-header__quote">
        <strong>{price}</strong>
        <div className="company-header__change">
          <span>{change}</span>
          <span className="company-header__change-pill">{changePercent}</span>
        </div>
      </div>

      <dl className="company-header__stats">
        {stats.map((stat) => (
          <div className="company-header__stat" key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
