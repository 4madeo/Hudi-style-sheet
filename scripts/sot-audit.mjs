#!/usr/bin/env node
/**
 * sot-audit - deterministic Source-of-Truth audit for the Hudi stylesheet.
 *
 * The current repo is a static component reference. The canonical token source is
 * the first :root block under "[SOURCE OF TRUTH] - Design Tokens" in
 * kitchen-sink.html. This audit reports violations only; it does not rewrite CSS.
 *
 * Usage:
 *   node scripts/sot-audit.mjs
 *   node scripts/sot-audit.mjs --max 200
 *   node scripts/sot-audit.mjs --json
 */

import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const DEFAULT_CONFIG = {
  canonicalFile: "kitchen-sink.html",
  sourceMarker: /SOURCE OF TRUTH[\s\S]*?Design Tokens/,
  reportLimit: 80,
  spacingProps: [
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "padding-inline",
    "padding-block",
    "padding-inline-start",
    "padding-inline-end",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "margin-inline",
    "margin-block",
    "gap",
    "row-gap",
    "column-gap",
    "inset",
    "top",
    "right",
    "bottom",
    "left",
  ],
  externalTokens: [],
};

const DEF_RE = /(?<!var\()(--[\w-]+)\s*:\s*([^;{}]+)/g;
const VAR_RE = /var\(\s*(--[\w-]+)/g;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_FN_RE = /\b(?:rgb|rgba|hsl|hsla)\(/g;
const BARE_PX_RE = /(?<![\w-])([1-9]\d*(?:\.\d+)?)px\b/;
const INVALID_TOKENIZED_NUMBER_RE = /(?:^|[^\w-])[-+]?\.\s*var\(/;

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function stripInlineComments(line) {
  return line.replace(/\/\*.*?\*\//g, "");
}

function extractStyle(html, file) {
  const match = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
  if (!match || match.index === undefined) {
    throw new Error(`${file}: missing <style> block`);
  }

  const styleStart = match.index + match[0].indexOf(match[1]);
  return {
    css: match[1],
    startIndex: styleStart,
    startLine: lineAt(html, styleStart),
  };
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findSourceRoot(css, config) {
  const marker = css.search(config.sourceMarker);
  if (marker === -1) {
    throw new Error("missing [SOURCE OF TRUTH] Design Tokens marker");
  }

  const rootMatch = /:root\s*\{/.exec(css.slice(marker));
  if (!rootMatch) {
    throw new Error("missing :root block after Source-of-Truth marker");
  }

  const selectorStart = marker + rootMatch.index;
  const open = css.indexOf("{", selectorStart);
  const close = findMatchingBrace(css, open);
  if (close === -1) {
    throw new Error("unclosed Source-of-Truth :root block");
  }

  return { selectorStart, open, close };
}

function parseDefinitions(css, absoluteLineOffset) {
  const defs = [];
  const lines = css.split("\n");
  let charOffset = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const code = stripInlineComments(raw);
    const codeStart = charOffset + raw.indexOf(code);

    for (const match of code.matchAll(DEF_RE)) {
      defs.push({
        name: match[1],
        value: match[2].trim(),
        line: absoluteLineOffset + i,
        index: codeStart + match.index,
      });
    }

    charOffset += raw.length + 1;
  }

  return defs;
}

function parseReferences(source, absoluteLineOffset) {
  const refs = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const code = stripInlineComments(lines[i]);
    for (const match of code.matchAll(VAR_RE)) {
      refs.push({
        name: match[1],
        line: absoluteLineOffset + i,
        hasFallback: hasFallback(code, match.index),
      });
    }
  }

  return refs;
}

function hasFallback(source, varIndex) {
  const open = source.indexOf("(", varIndex);
  if (open === -1) return false;

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return false;
    } else if (char === "," && depth === 1) {
      return true;
    }
  }

  return false;
}

function declarationParts(line) {
  return stripInlineComments(line)
    .replace(/var\([^)]*\)/g, "var()")
    .split(";")
    .map((decl) => decl.match(/^\s*([\w-]+)\s*:(.*)$/))
    .filter(Boolean)
    .map((match) => ({ prop: match[1], value: match[2] }));
}

function auditSourceOfTruth(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const root = resolve(options.root ?? process.cwd());
  const file = resolve(root, config.canonicalFile);
  const relFile = relative(root, file) || config.canonicalFile;

  if (!existsSync(file)) {
    throw new Error(`missing canonical file: ${config.canonicalFile}`);
  }

  const html = readFileSync(file, "utf8");
  const { css, startIndex, startLine } = extractStyle(html, relFile);
  const sourceRoot = findSourceRoot(css, config);
  const rootStartLine = startLine + lineAt(css, sourceRoot.selectorStart) - 1;
  const rootEndLine = startLine + lineAt(css, sourceRoot.close) - 1;
  const definitions = parseDefinitions(css, startLine);
  const htmlDefinitions = parseDefinitions(html, 1);
  const references = [
    ...parseReferences(css, startLine),
    ...parseReferences(html.slice(startIndex + css.length), startLine + css.split("\n").length),
  ];

  const violations = [];
  const add = (type, line, fix) => {
    violations.push({ type, location: `${relFile}:${line}`, fix });
  };

  const inSourceRoot = (index) => index >= sourceRoot.open && index <= sourceRoot.close;
  const sourceDefs = definitions.filter((def) => inSourceRoot(def.index));
  const sourceNames = new Set(sourceDefs.map((def) => def.name));
  const allNames = new Set([
    ...definitions.map((def) => def.name),
    ...htmlDefinitions.map((def) => def.name),
    ...config.externalTokens,
  ]);
  const sourceDefCount = new Map();

  for (const def of sourceDefs) {
    sourceDefCount.set(def.name, (sourceDefCount.get(def.name) ?? 0) + 1);
  }

  for (const [name, count] of sourceDefCount) {
    if (count > 1) {
      const duplicateLines = sourceDefs
        .filter((def) => def.name === name)
        .map((def) => `${relFile}:${def.line}`)
        .join(" + ");
      violations.push({
        type: "duplicate source token",
        location: duplicateLines,
        fix: `keep exactly one ${name} definition in the Source-of-Truth :root`,
      });
    }
  }

  for (const def of definitions) {
    if (!inSourceRoot(def.index) && sourceNames.has(def.name)) {
      add(
        "source token redefined",
        def.line,
        `remove this ${def.name} override or add a distinct local token name`,
      );
    }
  }

  for (const ref of references) {
    if (ref.hasFallback) continue;
    if (!allNames.has(ref.name)) {
      add("dangling token reference", ref.line, `${ref.name} is referenced but never defined`);
    }
  }

  const spacingPropRe = new RegExp(
    `^(${config.spacingProps.map((prop) => prop.replace(/-/g, "\\-")).join("|")})$`,
  );

  const cssLines = css.split("\n");
  for (let i = 0; i < cssLines.length; i += 1) {
    const lineNo = startLine + i;
    if (lineNo >= rootStartLine && lineNo <= rootEndLine) continue;

    const code = stripInlineComments(cssLines[i]).replace(/var\([^)]*\)/g, "var()");
    if (INVALID_TOKENIZED_NUMBER_RE.test(code)) {
      add("invalid tokenized number", lineNo, "use calc(var(--space-x) * -0.5) or a complete token value");
    }

    if (HEX_RE.test(code) || COLOR_FN_RE.test(code)) {
      add("orphan color literal", lineNo, "move the value to the Source-of-Truth :root and consume it with var(...)");
    }

    HEX_RE.lastIndex = 0;
    COLOR_FN_RE.lastIndex = 0;

    for (const { prop, value } of declarationParts(cssLines[i])) {
      if (spacingPropRe.test(prop) && BARE_PX_RE.test(value)) {
        add("orphan spacing literal", lineNo, "prefer an existing spacing token or add one to the Source-of-Truth :root");
      }
    }
  }

  return {
    canonicalFile: relFile,
    sourceRoot: `${relFile}:${rootStartLine}-${rootEndLine}`,
    sourceTokenCount: sourceDefs.length,
    definitionCount: definitions.length,
    referenceCount: references.length,
    violations,
  };
}

function formatTable(rows, limit) {
  const shown = rows.slice(0, limit);
  const cols = ["type", "location", "fix"];
  const widths = cols.map((col) =>
    Math.max(col.length, ...shown.map((row) => String(row[col]).length)),
  );
  const fmt = (row) => cols.map((col, i) => String(row[col]).padEnd(widths[i])).join("  |  ");
  const divider = widths.map((width) => "-".repeat(width)).join("--|--");

  return [fmt({ type: "TYPE", location: "LOCATION", fix: "FIX" }), divider, ...shown.map(fmt)].join("\n");
}

function parseCliArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--max") {
      const max = Number(argv[i + 1]);
      if (Number.isFinite(max) && max > 0) options.reportLimit = max;
      i += 1;
    } else if (arg.startsWith("--max=")) {
      const max = Number(arg.slice("--max=".length));
      if (Number.isFinite(max) && max > 0) options.reportLimit = max;
    }
  }
  return options;
}

function runCli() {
  const { json, ...options } = parseCliArgs(process.argv.slice(2));
  const result = auditSourceOfTruth(options);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`sot-audit - ${result.canonicalFile}`);
    console.log(`Source root: ${result.sourceRoot}`);
    console.log(
      `Scanned ${result.sourceTokenCount} source token(s), ${result.definitionCount} total definition(s), ${result.referenceCount} reference(s).`,
    );

    if (result.violations.length === 0) {
      console.log("Clean: no source-of-truth violations.");
    } else {
      console.log("");
      console.log(formatTable(result.violations, options.reportLimit ?? DEFAULT_CONFIG.reportLimit));
      if (result.violations.length > (options.reportLimit ?? DEFAULT_CONFIG.reportLimit)) {
        console.log(
          `\nShowing ${options.reportLimit ?? DEFAULT_CONFIG.reportLimit} of ${result.violations.length} violation(s). Use --max ${result.violations.length} to print all.`,
        );
      }
      console.log(`\nFound ${result.violations.length} violation(s).`);
    }
  }

  process.exitCode = result.violations.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(`sot-audit error: ${error.message}`);
    process.exitCode = 1;
  }
}

export { auditSourceOfTruth };
