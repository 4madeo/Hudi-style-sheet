// Exchange-qualified assets explicitly approved during visual catalog review.
// Keep the original review files separate from the importer source cache so a
// later catalog refresh can deterministically restore the approved mark.
export const manualLogoOverrides = new Map([
  ["SZSE:301669", {
    assetPath: "public/logos/manual-review/szse/301669.png",
    brandBackground: {
      colour: "#243953",
      sourceRef: "official-site-header",
      sourceUrl: "https://www.china-gold.com/",
    },
    processing: {
      autoCropEmblem: true,
      excludeRegions: [{ left: 0.78, top: 0, width: 0.22, height: 0.26 }],
    },
  }],
  ["NASDAQ:AIXC", {
    assetPath: "public/logos/manual-review/nasdaq/aixc.png",
    preserveFullMark: true,
  }],
  ["HKEX:1712", {
    assetPath: "public/logos/manual-review/hkex/1712.png",
    processing: {
      sourceCrop: { left: 0, top: 0, width: 1, height: 0.87 },
    },
  }],
  ["NASDAQ:SGMT", {
    assetPath: "public/logos/manual-review/nasdaq/sgmt.png",
    preserveFullMark: true,
  }],
  ["TSE:3096", {
    assetPath: "public/logos/manual-review/tse/3096.png",
    preserveFullMark: true,
    processing: {
      sourceCrop: { left: 0, top: 0, width: 0.16, height: 0.48 },
    },
  }],
  ["NASDAQ:CLRB", {
    assetPath: "public/logos/manual-review/nasdaq/clrb.png",
    preserveFullMark: true,
  }],
  ["TSE:3537", {
    assetPath: "public/logos/manual-review/tse/3537.png",
    preserveFullMark: true,
  }],
  ["TSE:4968", {
    assetPath: "public/logos/manual-review/tse/4968.png",
    preserveFullMark: true,
  }],
  ["NYSE:TWN", {
    assetPath: "public/logos/manual-review/nyse/twn.png",
    preserveFullMark: true,
  }],
  ["NYSE:EVN", {
    assetPath: "public/logos/manual-review/nyse/evn.png",
    preserveFullMark: true,
  }],
]);
