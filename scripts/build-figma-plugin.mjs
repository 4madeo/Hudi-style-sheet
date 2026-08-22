import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(root, "figma-plugin");
const sourceRoot = path.join(pluginRoot, "src");
const outputRoot = path.join(pluginRoot, "dist");

await mkdir(outputRoot, { recursive: true });

const logoManifest = JSON.parse(
  await readFile(path.join(root, "public", "logos", "manifest.json"), "utf8"),
);
const logoAssets = Object.fromEntries(await Promise.all(
  Object.entries(logoManifest).map(async ([symbol, asset]) => {
    const bytes = await readFile(path.join(root, "public", asset.path.replace(/^\//, "")));
    const mimeType = asset.format === "svg" ? "image/svg+xml" : "image/png";
    return [symbol, `data:${mimeType};base64,${bytes.toString("base64")}`];
  }),
));

await build({
  entryPoints: [path.join(sourceRoot, "code.ts")],
  outfile: path.join(outputRoot, "code.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  logLevel: "info",
});

const uiBuild = await build({
  entryPoints: [path.join(sourceRoot, "ui.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  write: false,
  define: {
    "__HUDI_LOGO_ASSETS__": JSON.stringify(logoAssets),
    "process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN": JSON.stringify(process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN ?? ""),
    "process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT": JSON.stringify(process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT ?? "svg"),
  },
  logLevel: "info",
});

const uiJavaScript = uiBuild.outputFiles[0];
if (!uiJavaScript) throw new Error("The Figma UI bundle was not produced");

const template = await readFile(path.join(sourceRoot, "ui.html"), "utf8");
const safeJavaScript = uiJavaScript.text.replace(/<\/script/gi, "<\\/script");
const html = template.replace("<!-- APP_SCRIPT -->", `<script>${safeJavaScript}</script>`);
await writeFile(path.join(outputRoot, "ui.html"), html, "utf8");

console.log(`Figma plugin built at ${outputRoot}`);
