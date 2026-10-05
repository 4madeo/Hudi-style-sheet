// Exchange-qualified assets explicitly approved during visual catalog review.
// Keep the original review files separate from the importer source cache so a
// later catalog refresh can deterministically restore the approved mark.
export const manualLogoOverrides = new Map([
  ["INDEX:NIKKEI", {
    assetPath: "public/logos/manual-review/index/nikkei.svg",
    brandBackground: {
      colour: "#f2f5f4",
      sourceRef: "hudi-nikkei-225-white-material-v1",
    },
    orbMaterial: {
      colour: "#f2f5f4",
      base: "#e2e8e7",
      sheen: "#ffffff",
      shadow: "#8fa2a6",
    },
    preserveFullMark: true,
  }],
  ["FX:USDJPY", {
    assetPath: "public/logos/manual-review/fx/usdjpy.svg",
    brandBackground: {
      colour: "#275dad",
      sourceRef: "hudi-fx-pair-glyph-v1",
    },
    preserveFullMark: true,
  }],
  ["CMDTY:XAU", {
    assetPath: "public/logos/manual-review/cmdty/xau.svg",
    brandBackground: {
      colour: "#d2a72c",
      sourceRef: "hudi-instrument-glyph-v1",
    },
    preserveFullMark: true,
  }],
  ["CMDTY:XAG", {
    assetPath: "public/logos/manual-review/cmdty/xag.svg",
    brandBackground: {
      colour: "#8d9aa7",
      sourceRef: "hudi-instrument-glyph-v1",
    },
    preserveFullMark: true,
  }],
  ["CMDTY:BRENT", {
    assetPath: "public/logos/manual-review/cmdty/brent.svg",
    brandBackground: {
      colour: "#175f72",
      sourceRef: "hudi-instrument-glyph-v1",
    },
    preserveFullMark: true,
  }],
  ["CMDTY:WTI", {
    assetPath: "public/logos/manual-review/cmdty/wti.svg",
    brandBackground: {
      colour: "#7a4524",
      sourceRef: "hudi-instrument-glyph-v1",
    },
    preserveFullMark: true,
  }],
  ["NASDAQ:PRTH", {
    assetPath: "public/logos/manual-review/nasdaq/prth.png",
    brandBackground: {
      colour: "#01271a",
      sourceRef: "official-2024-rebrand",
      sourceUrl: "https://prioritycommerce.com/resource-center/priority-rebrand-2024/",
    },
    preserveFullMark: true,
    processing: {
      // The reviewed source is Priority's complete horizontal lockup. The orb
      // uses the standalone gradient emblem at the left of that lockup.
      sourceCrop: { left: 0, top: 0, width: 0.285, height: 1 },
    },
  }],
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
