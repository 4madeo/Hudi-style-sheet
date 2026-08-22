import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import opentype from "opentype.js";

const { parse: parseOpenType } = opentype;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const virtualEntry = `
  export { createOrbSvg, ORB_EXPORT_SCALES } from "./components/orb/svg.ts";
  export { createMarketOrbDefinition } from "./components/orb/palette.ts";
  export { listings } from "./app/listings.ts";
  export { createZipBlob } from "./lib/zip.ts";
`;
const bundled = await build({
  stdin: {
    contents: virtualEntry,
    loader: "ts",
    resolveDir: root,
    sourcefile: "orb-svg-validation-entry.ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  write: false,
  logLevel: "silent",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`;
const {
  createMarketOrbDefinition,
  createOrbSvg,
  createZipBlob,
  listings,
  ORB_EXPORT_SCALES,
} = await import(moduleUrl);

function fontArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

const [displayData, readoutData] = await Promise.all([
  readFile(path.join(root, "public/fonts/diatype-expanded-bold.otf")),
  readFile(path.join(root, "public/fonts/ocra-fixed.otf")),
]);
const fonts = {
  display: parseOpenType(fontArrayBuffer(displayData)),
  readout: parseOpenType(fontArrayBuffer(readoutData)),
};

const scales = Object.keys(ORB_EXPORT_SCALES);
const entries = scales.flatMap((scale) => listings.map((listing) => {
  const number = listing.exchangeTicker.padStart(4, "0").slice(-4);
  const palette = createMarketOrbDefinition({
    ticker: listing.ticker,
    number,
    market: listing.market,
    stableKey: listing.exchangeTicker,
  }).palette;
  const svg = createOrbSvg(listing.ticker, number, palette, scale, {
    fonts,
    title: `${listing.company} ${scale} orb`,
  });

  if (/<text(?:\s|>)/i.test(svg) || /<textPath(?:\s|>)/i.test(svg)) {
    throw new Error(`${listing.ticker} ${scale} still contains editable SVG text`);
  }
  if (/font-family|@font-face|data:font/i.test(svg)) {
    throw new Error(`${listing.ticker} ${scale} still contains a font dependency`);
  }
  if ((svg.match(/<path\b/g) ?? []).length < 6) {
    throw new Error(`${listing.ticker} ${scale} is missing outlined glyph paths`);
  }
  const size = ORB_EXPORT_SCALES[scale].size;
  if (!svg.includes(`width="${size}" height="${size}"`)) {
    throw new Error(`${listing.ticker} ${scale} has the wrong dimensions`);
  }

  return {
    name: `${scale}/${listing.market}-${listing.exchangeTicker}-${listing.ticker}.svg`,
    data: svg,
  };
}));

const outputRoot = path.join("/tmp", "hudi-orb-svg-validation");
await mkdir(outputRoot, { recursive: true });
for (const scale of scales) {
  const sample = entries.find((entry) => entry.name.startsWith(`${scale}/`));
  await writeFile(path.join(outputRoot, `${scale}.svg`), sample.data, "utf8");
}
const zip = createZipBlob(entries);
await writeFile(path.join(outputRoot, "hudi-orbs.zip"), Buffer.from(await zip.arrayBuffer()));

console.log(`Validated ${entries.length} outlined SVGs across ${scales.length} scales.`);
console.log(pathToFileURL(outputRoot).pathname);
