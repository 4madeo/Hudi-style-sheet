#!/usr/bin/env node

/**
 * button-contour-audit - deterministic audit for Hudi pill highlight contours.
 *
 * The button maker source of truth combines width and scale: width drags the
 * right cap, while scale changes cap/handle size so curves keep their ratio.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const htmlPath = path.join(repoRoot, "kitchen-sink.html");
const source = fs.readFileSync(htmlPath, "utf8");
const liveSource = source.replace(/<script id="css-snippets" type="application\/json">[\s\S]*?<\/script>/, "");

function lineAt(index) {
  return source.slice(0, index).split("\n").length;
}

function report(type, message, index = 0) {
  return {
    type,
    file: `kitchen-sink.html:${lineAt(index)}`,
    message,
  };
}

const issues = [];
const contourSvgPattern = /<svg\b[^>]*class="[^"]*(?:pill-top-contour|hudi-side-toggle__top-contour)[^"]*"[^>]*>/g;
const contourSvgs = [...liveSource.matchAll(contourSvgPattern)];

for (const match of contourSvgs) {
  const tag = match[0];
  if (!tag.includes('preserveAspectRatio="none"')) {
    issues.push(report("missing preserveAspectRatio", "Top contour SVGs must use preserveAspectRatio=\"none\" before the runtime path rebuild.", match.index));
  }
  const localMarkup = source.slice(match.index, match.index + 1400);
  if (!localMarkup.includes("<path")) {
    issues.push(report("missing path", "Top contour SVG has no path for the shared resize rule to rebuild.", match.index));
  }
}

const topContourCssRules = [
  ...liveSource.matchAll(/\.hudi-trade-button \.pill-top-contour\s*\{[^{}]*\}/g),
  ...liveSource.matchAll(/\.hudi-percent-pill \.pill-top-contour\s*\{[^{}]*\}/g),
  ...liveSource.matchAll(/\.hudi-side-toggle__top-contour\s*\{[^{}]*\}/g),
];

for (const match of topContourCssRules) {
  const rule = match[0];
  if (
    rule.includes("width:")
    && !rule.includes("width: var(--pill-top-contour-width)")
  ) {
    issues.push(report("bad contour trim", "Top contour CSS must use the shared button-maker contour width variable.", match.index));
  }
  if (
    rule.includes("height:")
    && !rule.includes("height: var(--pill-top-contour-height)")
  ) {
    issues.push(report("bad contour height", "Top contour CSS must use the shared button-maker contour height variable.", match.index));
  }
  if (rule.includes("mix-blend-mode") && !rule.includes("mix-blend-mode: screen")) {
    issues.push(report("bad contour blend", "Top contour CSS must keep the source-of-truth screen blend.", match.index));
  }
}

const requiredRuntimeContracts = [
  ["buildPillTopContourPath", "shared path rebuild function"],
  ["function buildPillTopContourPath(width, scale = 1)", "combined width/scale path builder"],
  ["const sourceWidth = 151 * scale", "scaled source width"],
  ["const delta = width - sourceWidth", "width stretch delta"],
  ["const leftX = (value) => formatPathNumber(value * scale)", "scaled left cap handles"],
  ["const rightX = (value) => formatPathNumber((value * scale) + delta)", "stretched right cap handles"],
  ["Width drags the right cap; scale changes the cap/handle size", "combined contour resize comment"],
  ["getPillTopContourFallbackWidth", "owner-width fallback trim"],
  ["getPillTopContourTargetWidth", "rendered-width contour width source"],
  ["getPillTopContourScale", "contour height scale source"],
  ["svg.dataset.contourWidth", "rendered contour width marker"],
  ["svg.dataset.contourScale", "rendered contour scale marker"],
  ["pendingPillTopContourRoots", "post-layout contour queue"],
  ["requestAnimationFrame(flushPillTopContourQueue)", "deferred contour rebuild"],
  ["collectPillTopContours", "root-inclusive contour collection"],
  ["collectPillTopContourOwners", "root-inclusive owner collection"],
  ["installPillTopContourMutationObserver", "dynamic mount/class observer"],
];

const requiredCssContracts = [
  ["--pill-top-contour-x: calc(var(--space-1) * -0.5)", "default contour x offset"],
  ["--pill-top-contour-y: calc(var(--space-1) * -0.5)", "default contour y offset"],
  ["--pill-top-contour-width: calc(100% - 7.5px)", "default contour width"],
  ["--pill-top-contour-height: 75.4%", "default contour height"],
  ["width: var(--pill-top-contour-width)", "contour width token usage"],
  ["height: var(--pill-top-contour-height)", "contour height token usage"],
];

const requiredOwnerContracts = [
  [".hudi-trade-button", "trade buttons"],
  [".hudi-percent-pill", "percent pills"],
  [".hudi-side-toggle__pill", "side-toggle active pills"],
];

function rulesForSelector(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...liveSource.matchAll(new RegExp(`(?:^|[\\n\\r\`])${escaped}\\s*\\{[^{}]*\\}`, "g"))];
}

for (const [selector, label] of requiredOwnerContracts) {
  const rules = rulesForSelector(selector);
  if (!rules.length) {
    issues.push(report("missing contour owner", `Missing ${label} contour owner rule: ${selector}`));
    continue;
  }
  const compliantRule = rules.find((match) => {
    const rule = match[0];
    return ["--pill-top-contour-x", "--pill-top-contour-y", "--pill-top-contour-width", "--pill-top-contour-height"].every((property) => rule.includes(property));
  });
  if (!compliantRule) {
    issues.push(report("missing owner contour token", `${label} must expose all --pill-top-contour-* variables so the post-layout resize rule propagates.`, rules[0].index));
  }
}

for (const [needle, label] of requiredCssContracts) {
  if (!liveSource.includes(needle)) {
    issues.push(report("missing css contract", `Missing ${label}: ${needle}`));
  }
}

for (const [needle, label] of requiredRuntimeContracts) {
  if (!liveSource.includes(needle)) {
    issues.push(report("missing runtime contract", `Missing ${label}: ${needle}`));
  }
}

const targetWidthFunction = liveSource.match(/function getPillTopContourTargetWidth\(svg\) \{[\s\S]*?\n    \}/)?.[0] || "";
if (!targetWidthFunction) {
  issues.push(report("missing layout-width rule", "Top contour runtime must calculate from final CSS layout width after layout."));
} else {
  const cssBranch = targetWidthFunction.indexOf("parseFloat(getComputedStyle(svg).width)");
  const renderedBranch = targetWidthFunction.indexOf("svg.getBoundingClientRect().width");
  const ownerFallback = targetWidthFunction.indexOf("getPillTopContourFallbackWidth(ownerWidth)");
  if (cssBranch === -1 || renderedBranch === -1 || ownerFallback === -1 || cssBranch > renderedBranch || renderedBranch > ownerFallback) {
    issues.push(report("bad layout-width order", "Top contour runtime must use CSS layout width before transformed rendered width and owner fallback."));
  }
}

const summary = {
  contourSvgCount: contourSvgs.length,
  topContourCssRuleCount: topContourCssRules.length,
  issueCount: issues.length,
};

if (issues.length) {
  console.log(`button-contour-audit - ${path.relative(repoRoot, htmlPath)}`);
  console.log(JSON.stringify(summary, null, 2));
  for (const issue of issues) {
    console.log(`${issue.file} [${issue.type}] ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`button-contour-audit - ${path.relative(repoRoot, htmlPath)}`);
  console.log(`Clean: ${summary.contourSvgCount} contour SVG(s), ${summary.topContourCssRuleCount} contour CSS rule(s), no contour contract violations.`);
}
