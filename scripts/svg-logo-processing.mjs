const dangerousElementPattern = /<(script|foreignObject|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi;
const dangerousSelfClosingPattern = /<(script|foreignObject|iframe|object|embed)\b[^>]*\/?\s*>/gi;

function attribute(markup, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(markup);
  return match?.[2];
}

function finiteNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanNumber(value) {
  return Number(value.toFixed(5));
}

function safeRootPresentation(attributes) {
  const names = ["fill", "stroke", "color", "fill-rule", "clip-rule", "stroke-linecap", "stroke-linejoin"];
  return names.flatMap((name) => {
    const value = attribute(attributes, name);
    if (!value || /[<>]/.test(value)) return [];
    return [`${name}=${JSON.stringify(value)}`];
  }).join(" ");
}

function sanitizeInnerMarkup(markup) {
  return markup
    .replace(dangerousElementPattern, "")
    .replace(dangerousSelfClosingPattern, "")
    .replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\s+(?:href|xlink:href)\s*=\s*(["'])(?!#)[\s\S]*?\1/gi, "")
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/url\(\s*["']?(?:https?:|data:)[^)]+\)/gi, "none");
}

function normalizedPathData(tag) {
  return (attribute(tag, "d") ?? "").toLowerCase().replace(/[\s,]+/g, "");
}

function axisAlignedPathBounds(tag) {
  const pathData = attribute(tag, "d") ?? "";
  const tokens = pathData.match(/[a-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? [];
  const residue = pathData.replace(/[a-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi, "");
  if (!tokens.length || /[^\s,]/.test(residue)) return undefined;

  let command;
  let x = 0;
  let y = 0;
  let start;
  const points = [];
  let index = 0;

  function number() {
    const value = Number(tokens[index]);
    if (!Number.isFinite(value)) return undefined;
    index += 1;
    return value;
  }

  function lineTo(nextX, nextY) {
    if (nextX !== x && nextY !== y) return false;
    x = nextX;
    y = nextY;
    const previous = points.at(-1);
    if (!previous || previous.x !== x || previous.y !== y) points.push({ x, y });
    return true;
  }

  while (index < tokens.length) {
    if (/^[a-z]$/i.test(tokens[index])) command = tokens[index++];
    if (!command) return undefined;
    const relative = command === command.toLowerCase();
    switch (command.toLowerCase()) {
      case "m": {
        if (start) return undefined;
        const nextX = number();
        const nextY = number();
        if (nextX == null || nextY == null) return undefined;
        x = relative ? x + nextX : nextX;
        y = relative ? y + nextY : nextY;
        start = { x, y };
        points.push(start);
        command = relative ? "l" : "L";
        break;
      }
      case "l": {
        const nextX = number();
        const nextY = number();
        if (nextX == null || nextY == null) return undefined;
        if (!lineTo(relative ? x + nextX : nextX, relative ? y + nextY : nextY)) return undefined;
        break;
      }
      case "h": {
        const nextX = number();
        if (nextX == null || !lineTo(relative ? x + nextX : nextX, y)) return undefined;
        break;
      }
      case "v": {
        const nextY = number();
        if (nextY == null || !lineTo(x, relative ? y + nextY : nextY)) return undefined;
        break;
      }
      case "z":
        if (!start || !lineTo(start.x, start.y)) return undefined;
        command = undefined;
        break;
      default:
        return undefined;
    }
  }

  if (!start || points.length !== 5 || points.at(-1).x !== start.x || points.at(-1).y !== start.y) return undefined;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

function isCanvasRect(tag, viewBox) {
  if (!/^<rect\b/i.test(tag)) return false;
  const x = finiteNumber(attribute(tag, "x"), 0);
  const y = finiteNumber(attribute(tag, "y"), 0);
  const width = finiteNumber(attribute(tag, "width"), Number.NaN);
  const height = finiteNumber(attribute(tag, "height"), Number.NaN);
  const tolerance = Math.max(viewBox.width, viewBox.height) * 0.002;
  return Math.abs(x - viewBox.x) <= tolerance
    && Math.abs(y - viewBox.y) <= tolerance
    && Math.abs(width - viewBox.width) <= tolerance
    && Math.abs(height - viewBox.height) <= tolerance;
}

function isCanvasPath(tag, viewBox) {
  if (!/^<path\b/i.test(tag)) return false;
  const bounds = axisAlignedPathBounds(tag);
  if (bounds) {
    const tolerance = Math.max(viewBox.width, viewBox.height) * 0.02;
    return Math.abs(bounds.left - viewBox.x) <= tolerance
      && Math.abs(bounds.top - viewBox.y) <= tolerance
      && Math.abs(bounds.right - (viewBox.x + viewBox.width)) <= tolerance
      && Math.abs(bounds.bottom - (viewBox.y + viewBox.height)) <= tolerance;
  }
  const x = cleanNumber(viewBox.x);
  const y = cleanNumber(viewBox.y);
  const width = cleanNumber(viewBox.width);
  const height = cleanNumber(viewBox.height);
  const right = cleanNumber(x + width);
  const bottom = cleanNumber(y + height);
  const d = normalizedPathData(tag);
  const starts = [
    `m${x}${y}`,
    `m${right}${y}`,
    `m${x}${bottom}`,
    `m${right}${bottom}`,
  ];
  if (!starts.some((start) => d.startsWith(start))) return false;
  return [
    `m${x}${y}h${right}v${bottom}h${x}z`,
    `m${x}${y}h${right}v${bottom}h${x}v${y}z`,
    `m${x}${y}h${width}v${height}h-${width}z`,
    `m${x}${y}h${width}v${height}h-${width}v-${height}z`,
    `m${right}${y}h${x}v${height}h${width}v${y}z`,
  ].map((value) => value.replace(/[\s,]+/g, "").toLowerCase()).includes(d);
}

function stripVisibleElementIndexes(markup, indexes = []) {
  const selected = new Set(indexes);
  if (!selected.size) return markup;
  const definitions = [];
  let elementIndex = 0;
  return markup
    .replace(/<defs\b[\s\S]*?<\/defs\s*>/gi, (value) => {
      const token = `HUDI_SVG_DEFINITIONS_${definitions.length}`;
      definitions.push(value);
      return token;
    })
    .replace(/<(?:path|circle|rect|ellipse|polygon|polyline)\b[^>]*\/?\s*>(?:\s*<\/(?:path|circle|rect|ellipse|polygon|polyline)\s*>)?/gi, (tag) => (
      selected.has(elementIndex++) ? "" : tag
    ))
    .replace(/HUDI_SVG_DEFINITIONS_(\d+)/g, (_, index) => definitions[Number(index)]);
}

function stripCanvasBackgrounds(markup, viewBox) {
  let removed = 0;
  const colours = [];
  const definitions = [];
  const visibleMarkup = markup.replace(/<defs\b[\s\S]*?<\/defs\s*>/gi, (value) => {
    const token = `HUDI_SVG_DEFINITIONS_${definitions.length}`;
    definitions.push(value);
    return token;
  });
  const cleaned = visibleMarkup.replace(/<(?:rect|path)\b[^>]*\/?\s*>(?:\s*<\/(?:rect|path)\s*>)?/gi, (tag) => {
    if (!isCanvasRect(tag, viewBox) && !isCanvasPath(tag, viewBox)) return tag;
    const styleFill = /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(attribute(tag, "style") ?? "")?.[1]?.trim();
    const fill = attribute(tag, "fill") ?? styleFill;
    const paintId = /^url\(\s*#([^)\s]+)\s*\)$/i.exec(fill ?? "")?.[1];
    if (paintId) {
      const escapedId = paintId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const paint = new RegExp(`<(?:linearGradient|radialGradient)\\b[^>]*\\bid=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/(?:linearGradient|radialGradient)\\s*>`, "i").exec(markup)?.[1] ?? "";
      for (const stop of paint.matchAll(/<stop\b[^>]*>/gi)) {
        const stopStyle = /(?:^|;)\s*stop-color\s*:\s*([^;]+)/i.exec(attribute(stop[0], "style") ?? "")?.[1]?.trim();
        const stopColour = attribute(stop[0], "stop-color") ?? stopStyle;
        if (stopColour) colours.push(stopColour);
      }
    } else if (fill && fill !== "none") colours.push(fill);
    removed += 1;
    return "";
  }).replace(/HUDI_SVG_DEFINITIONS_(\d+)/g, (_, index) => definitions[Number(index)]);
  return { colours, markup: cleaned, removed };
}

export function isSvgBytes(bytes) {
  const prefix = Buffer.from(bytes).subarray(0, 4096).toString("utf8").replace(/^\uFEFF/, "");
  return /<svg\b/i.test(prefix);
}

export function prepareVectorLogo(bytes, options = {}) {
  if (!isSvgBytes(bytes)) return undefined;
  const source = Buffer.from(bytes).toString("utf8")
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!doctype[\s\S]*?>/gi, "");
  const match = /<svg\b([^>]*)>([\s\S]*?)<\/svg\s*>/i.exec(source);
  if (!match) throw new Error("SVG source has no complete root element");
  const rootAttributes = match[1];
  const viewBoxValues = (attribute(rootAttributes, "viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = finiteNumber(attribute(rootAttributes, "width"), 100);
  const height = finiteNumber(attribute(rootAttributes, "height"), 100);
  const viewBox = viewBoxValues.length === 4 && viewBoxValues.every(Number.isFinite)
    ? { x: viewBoxValues[0], y: viewBoxValues[1], width: viewBoxValues[2], height: viewBoxValues[3] }
    : { x: 0, y: 0, width, height };
  if (viewBox.width <= 0 || viewBox.height <= 0) throw new Error("SVG source has an invalid viewBox");

  let inner = sanitizeInnerMarkup(match[2]);
  let backgroundElementsRemoved = 0;
  let removedBackgroundColours = [];
  if (options.stripCanvasBackground) {
    const stripped = stripCanvasBackgrounds(inner, viewBox);
    inner = stripped.markup;
    backgroundElementsRemoved = stripped.removed;
    removedBackgroundColours = stripped.colours;
  }
  inner = stripVisibleElementIndexes(inner, options.stripVisibleElementIndexes);
  const presentation = safeRootPresentation(rootAttributes);
  const analysisSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"${presentation ? ` ${presentation}` : ""}>${inner}</svg>`;
  return {
    analysisBytes: Buffer.from(analysisSvg),
    backgroundElementsRemoved,
    removedBackgroundColours,
    inner,
    presentation,
    viewBox,
  };
}

export function buildIsolatedVectorLogo(prepared, crop, options = {}) {
  const size = Math.max(16, options.size ?? 512);
  const paddingRatio = Math.max(0, Math.min(0.2, options.paddingRatio ?? 0.06));
  const left = Math.max(0, Math.min(1, crop.left));
  const top = Math.max(0, Math.min(1, crop.top));
  const widthRatio = Math.max(0.0001, Math.min(1 - left, crop.width));
  const heightRatio = Math.max(0.0001, Math.min(1 - top, crop.height));
  const cropBox = {
    x: prepared.viewBox.x + left * prepared.viewBox.width,
    y: prepared.viewBox.y + top * prepared.viewBox.height,
    width: widthRatio * prepared.viewBox.width,
    height: heightRatio * prepared.viewBox.height,
  };
  const available = size * (1 - paddingRatio * 2);
  const scale = available / Math.max(cropBox.width, cropBox.height);
  const renderedWidth = cropBox.width * scale;
  const renderedHeight = cropBox.height * scale;
  const translateX = (size - renderedWidth) / 2 - cropBox.x * scale;
  const translateY = (size - renderedHeight) / 2 - cropBox.y * scale;
  const transform = `translate(${cleanNumber(translateX)} ${cleanNumber(translateY)}) scale(${cleanNumber(scale)})`;
  const source = options.source ? ` data-hudi-source=${JSON.stringify(options.source)}` : "";
  return Buffer.from(
    `<!-- HUDI isolated vector mark --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"${source}><g transform="${transform}"${prepared.presentation ? ` ${prepared.presentation}` : ""}>${prepared.inner}</g></svg>`,
  );
}
