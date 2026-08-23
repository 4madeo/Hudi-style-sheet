import sharp from "sharp";

export const LOGO_CONTRAST_TRIGGER = 3;
export const LOGO_CONTRAST_TARGET = 3.2;
export const LOGO_GRADIENT_CONTRAST_TARGET = 3.2;

const ORB_SURFACE_TOKENS = {
  baseSaturationMultiplier: 1.08,
  baseSaturationOffset: 0.02,
  baseLightnessOffset: 0.04,
  baseMaximumLightness: 0.74,
  sheenHueTarget: 55,
  sheenHueShift: 0.21,
  sheenMinimumSaturation: 0.28,
  sheenMaximumSaturation: 0.96,
  sheenSaturationMultiplier: 0.9,
  sheenSaturationOffset: 0.1,
  sheenLightnessOffset: 0.3,
  sheenMaximumLightness: 0.88,
  sheenFinalSaturationMultiplier: 1.16,
  sheenFinalSaturationOffset: 0.06,
  neighbourhoodMinimumSaturation: 0.25,
  neighbourhoods: [
    { colour: "#fade4b", sheen: "#fdf18b", radius: 38 },
    { colour: "#eb5128", sheen: "#eb4034", radius: 42 },
    { colour: "#ea33e3", sheen: "#f0a0cd", radius: 46 },
  ],
};

function parseHex(value) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value ?? "");
  if (!match) return undefined;
  const hex = match[1].length === 3
    ? [...match[1]].map((digit) => digit + digit).join("")
    : match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function hexColour({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(colour) {
  const channels = [colour.r, colour.g, colour.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(left, right) {
  const values = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function mixRgb(left, right, amount) {
  return {
    r: left.r + (right.r - left.r) * amount,
    g: left.g + (right.g - left.g) * amount,
    b: left.b + (right.b - left.b) * amount,
  };
}

function hueDistance(left, right) {
  return Math.abs(((((left - right) % 360) + 540) % 360) - 180);
}

function shiftHueToward(hue, target, amount) {
  const delta = ((((target - hue) % 360) + 540) % 360) - 180;
  return hue + delta * amount;
}

function anchoredSheen(input, anchorInput, anchorOutput) {
  const from = rgbToHsl(parseHex(anchorInput));
  const to = rgbToHsl(parseHex(anchorOutput));
  const hueDelta = ((((input.h - from.h) % 360) + 540) % 360) - 180;
  return hslToRgb({
    h: to.h + hueDelta,
    s: Math.max(0, Math.min(1, to.s + input.s - from.s)),
    l: Math.max(0.05, Math.min(0.95, to.l + input.l - from.l)),
  });
}

// Match the visible centre of the glossy orb, where catalog logos sit. The
// previous check used only the dark base layer and ignored the opaque-to-clear
// sheen above it. On blue orbs such as IOVA, that made the correction choose a
// lighter cyan logo even though the rendered surface behind it is bright cyan.
export function logoContrastBackground(orbColour) {
  const colour = typeof orbColour === "string" ? parseHex(orbColour) : orbColour;
  if (!colour) return undefined;
  const hsl = rgbToHsl(colour);
  const tokens = ORB_SURFACE_TOKENS;
  const achromatic = hsl.s <= 0.03;
  const sourceHue = hsl.s > 0.03 ? hsl.h : 196;
  const sourceSaturation = Math.max(hsl.s, hsl.s > 0.03 ? hsl.s : 0.48);
  const base = hsl.s > 0.03 ? hslToRgb({
    h: hsl.h,
    s: Math.min(1, hsl.s * tokens.baseSaturationMultiplier + tokens.baseSaturationOffset),
    l: Math.min(tokens.baseMaximumLightness, hsl.l + tokens.baseLightnessOffset),
  }) : colour;
  let sheen = hslToRgb({
    h: shiftHueToward(sourceHue, tokens.sheenHueTarget, tokens.sheenHueShift),
    s: Math.max(tokens.sheenMinimumSaturation, Math.min(
      tokens.sheenMaximumSaturation,
      sourceSaturation * tokens.sheenSaturationMultiplier + tokens.sheenSaturationOffset,
    )),
    l: Math.min(tokens.sheenMaximumLightness, hsl.l + tokens.sheenLightnessOffset),
  });
  if (achromatic) {
    sheen = hslToRgb({ h: 0, s: 0, l: Math.min(0.82, hsl.l + 0.42) });
  } else {
    if (hsl.s > tokens.neighbourhoodMinimumSaturation) {
      for (const neighbourhood of tokens.neighbourhoods) {
        const anchor = rgbToHsl(parseHex(neighbourhood.colour));
        const proximity = Math.max(0, 1 - hueDistance(hsl.h, anchor.h) / neighbourhood.radius);
        const weight = proximity * proximity * (3 - 2 * proximity);
        if (weight > 0) sheen = mixRgb(sheen, anchoredSheen(hsl, neighbourhood.colour, neighbourhood.sheen), weight);
      }
    }
    const sheenHsl = rgbToHsl(sheen);
    sheen = hslToRgb({
      ...sheenHsl,
      s: Math.min(1, sheenHsl.s * tokens.sheenFinalSaturationMultiplier + tokens.sheenFinalSaturationOffset),
    });
  }
  return mixRgb(base, sheen, 0.5);
}

function rgbToHsl({ r, g, b }) {
  const [red, green, blue] = [r, g, b].map((value) => value / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (!delta) return { h: 0, s: 0, l: lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const rawHue = maximum === red
    ? 60 * (((green - blue) / delta) % 6)
    : maximum === green
      ? 60 * ((blue - red) / delta + 2)
      : 60 * ((red - green) / delta + 4);
  return { h: (rawHue + 360) % 360, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = ((h % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const channels = segment < 1 ? [chroma, secondary, 0]
    : segment < 2 ? [secondary, chroma, 0]
      : segment < 3 ? [0, chroma, secondary]
        : segment < 4 ? [0, secondary, chroma]
          : segment < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const offset = l - chroma / 2;
  return { r: (channels[0] + offset) * 255, g: (channels[1] + offset) * 255, b: (channels[2] + offset) * 255 };
}

function colourDistance(left, right) {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

function preferredContrastDirection(background) {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  return contrastRatio(background, black) >= contrastRatio(background, white) ? -1 : 1;
}

export function adjustedLogoColour(colour, background, target = LOGO_CONTRAST_TARGET) {
  return adjustedLogoColours([colour], background, target, target)[0];
}

function adjustedLogoColours(colours, background, target, trigger) {
  const hslColours = colours.map(rgbToHsl);
  const failingIndexes = new Set(colours.map((colour, index) => (
    contrastRatio(colour, background) < trigger ? index : undefined
  )).filter((index) => index !== undefined));
  if (!failingIndexes.size) return colours;
  const preferredDirection = preferredContrastDirection(background);
  for (const direction of [preferredDirection, -preferredDirection]) {
    for (let step = 0; step <= 100; step += 1) {
      const amount = step / 100;
      const adjusted = hslColours.map((colour, index) => {
        if (!failingIndexes.has(index)) return colours[index];
        const lightness = direction < 0
          ? colour.l * (1 - amount)
          : colour.l + (1 - colour.l) * amount;
        return hslToRgb({ ...colour, l: lightness });
      });
      if (adjusted.every((colour, index) => (
        !failingIndexes.has(index) || contrastRatio(colour, background) >= target
      ))) return adjusted;
    }
  }
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  const fallback = contrastRatio(background, black) >= contrastRatio(background, white) ? black : white;
  return colours.map((colour, index) => failingIndexes.has(index) ? fallback : colour);
}

function adjustedGradientColours(colours, background, target = LOGO_CONTRAST_TARGET, trigger = LOGO_CONTRAST_TRIGGER) {
  return adjustedLogoColours(colours, background, target, trigger);
}

function visibleHexPaints(source) {
  const visible = source.replace(/<defs\b[\s\S]*?<\/defs\s*>/gi, "");
  const paints = new Map();
  for (const match of visible.matchAll(/(?:fill|stroke)\s*=\s*["'](#[0-9a-f]{3}(?:[0-9a-f]{3})?)["']/gi)) {
    const colour = parseHex(match[1]);
    if (colour) paints.set(hexColour(colour), colour);
  }
  return [...paints.values()];
}

function visibleGradientGroups(source) {
  const visible = source.replace(/<defs\b[\s\S]*?<\/defs\s*>/gi, "");
  const referencedIds = new Set([...visible.matchAll(/(?:fill|stroke)\s*=\s*["']url\(#([^)]+)\)["']/gi)]
    .map((match) => match[1]));
  const groups = [];
  for (const match of source.matchAll(/<(?:linearGradient|radialGradient)\b([^>]*)>([\s\S]*?)<\/(?:linearGradient|radialGradient)\s*>/gi)) {
    const id = /\bid\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1];
    if (!id || !referencedIds.has(id)) continue;
    const colours = [];
    for (const stop of match[2].matchAll(/stop-color\s*=\s*["'](#[0-9a-f]{3}(?:[0-9a-f]{3})?)["']/gi)) {
      const colour = parseHex(stop[1]);
      if (colour) colours.push(colour);
    }
    if (colours.length) groups.push({ id, colours });
  }
  return groups;
}

function leadingContainerPaint(source) {
  const visible = source.replace(/<defs\b[\s\S]*?<\/defs\s*>/gi, "");
  const tags = [...visible.matchAll(/<(path|circle|rect|ellipse|polygon|polyline)\b[^>]*>/gi)].map((match) => match[0]);
  const firstPaintedIndex = tags.findIndex((tag) => /(?:fill|stroke)\s*=\s*["'](?:#[0-9a-f]{3,6}|url\()/i.test(tag));
  if (firstPaintedIndex < 0) return undefined;
  const tag = tags[firstPaintedIndex];
  const colour = parseHex(/fill\s*=\s*["'](#[0-9a-f]{3}(?:[0-9a-f]{3})?)["']/i.exec(tag)?.[1]);
  if (!colour) return undefined;
  const tagName = /^<([a-z]+)/i.exec(tag)?.[1]?.toLocaleLowerCase();
  const pathData = /\bd\s*=\s*["']([^"']+)/i.exec(tag)?.[1];
  const simpleContainer = ["circle", "rect", "ellipse"].includes(tagName)
    || (tagName === "path"
      && (pathData?.match(/[Mm]/g)?.length ?? 0) === 1
      && (pathData?.match(/[Zz]/g)?.length ?? 0) === 1);
  const containerHex = hexColour(colour);
  const hasInternalPaint = tags.slice(firstPaintedIndex + 1)
    .some((candidate) => {
      if (/(?:fill|stroke)\s*=\s*["']url\(/i.test(candidate)) return true;
      const candidateColour = parseHex(/(?:fill|stroke)\s*=\s*["'](#[0-9a-f]{3}(?:[0-9a-f]{3})?)["']/i.exec(candidate)?.[1]);
      return candidateColour && hexColour(candidateColour) !== containerHex;
    });
  return simpleContainer && hasInternalPaint ? colour : undefined;
}

function pixelColour(data, offset) {
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
}

function touchesTransparency(data, width, height, channels, x, y, radius = 2) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return true;
      if (data[(nextY * width + nextX) * channels + 3] < 48) return true;
    }
  }
  return false;
}

async function exposedSvgPaints(bytes, paints) {
  const { data, info } = await sharp(bytes, { density: 192 })
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stats = paints.map((colour) => ({ colour, pixels: 0, exposed: 0 }));
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset + 3] < 160) continue;
      const rendered = pixelColour(data, offset);
      const match = stats.map((entry) => ({ entry, distance: colourDistance(entry.colour, rendered) }))
        .sort((left, right) => left.distance - right.distance)[0];
      if (!match || match.distance > 22) continue;
      match.entry.pixels += 1;
      if (touchesTransparency(data, info.width, info.height, info.channels, x, y)) match.entry.exposed += 1;
    }
  }
  return stats;
}

function replaceSvgPaints(source, adjustments, protectedContainerPaint) {
  let protectedContainerSkipped = false;
  const shapesAdjusted = source.replace(/<(?:path|circle|rect|ellipse|polygon|polyline)\b[^>]*>/gi, (tag) => {
    const tagPaints = [...tag.matchAll(/(?:fill|stroke)\s*=\s*["'](#[0-9a-f]{3}(?:[0-9a-f]{3})?)["']/gi)]
      .map((match) => parseHex(match[1]))
      .filter(Boolean)
      .map(hexColour);
    if (!protectedContainerSkipped && protectedContainerPaint && tagPaints.includes(protectedContainerPaint)) {
      protectedContainerSkipped = true;
      return tag;
    }
    return tag.replace(/((?:fill|stroke)\s*=\s*["'])(#[0-9a-f]{3}(?:[0-9a-f]{3})?)(["'])/gi, (match, before, value, after) => {
      const parsed = parseHex(value);
      const replacement = parsed && adjustments.get(hexColour(parsed));
      return replacement ? `${before}${replacement}${after}` : match;
    });
  });
  return shapesAdjusted.replace(/<stop\b[^>]*>/gi, (tag) => tag.replace(/(stop-color\s*=\s*["'])(#[0-9a-f]{3}(?:[0-9a-f]{3})?)(["'])/gi, (match, before, value, after) => {
    const parsed = parseHex(value);
    const replacement = parsed && adjustments.get(hexColour(parsed));
    return replacement ? `${before}${replacement}${after}` : match;
  }));
}

function shapePaintOccurrences(source, paint) {
  return [...source.matchAll(/<(?:path|circle|rect|ellipse|polygon|polyline)\b[^>]*>/gi)]
    .filter((match) => [...match[0].matchAll(/(?:fill|stroke)\s*=\s*["'](#[0-9a-f]{3}(?:[0-9a-f]{3})?)["']/gi)]
      .some((paintMatch) => {
        const colour = parseHex(paintMatch[1]);
        return colour && hexColour(colour) === paint;
      }))
    .length;
}

function boundaryContrastShare(data, width, height, channels, background, threshold = LOGO_CONTRAST_TRIGGER) {
  let boundary = 0;
  let failing = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      if (data[offset + 3] < 160 || !touchesTransparency(data, width, height, channels, x, y, 1)) continue;
      boundary += 1;
      if (contrastRatio(pixelColour(data, offset), background) < threshold) failing += 1;
    }
  }
  return failing / Math.max(1, boundary);
}

function quantizedKey(colour) {
  return `${colour.r >> 4},${colour.g >> 4},${colour.b >> 4}`;
}

function rasterClusters(data, width, height, channels) {
  const clusters = new Map();
  let opaquePixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      if (data[offset + 3] < 160) continue;
      opaquePixels += 1;
      const colour = pixelColour(data, offset);
      const key = quantizedKey(colour);
      const cluster = clusters.get(key) ?? { key, pixels: 0, exposed: 0, r: 0, g: 0, b: 0 };
      cluster.pixels += 1;
      cluster.r += colour.r;
      cluster.g += colour.g;
      cluster.b += colour.b;
      if (touchesTransparency(data, width, height, channels, x, y)) cluster.exposed += 1;
      clusters.set(key, cluster);
    }
  }
  const sorted = [...clusters.values()].sort((left, right) => right.pixels - left.pixels);
  for (const cluster of sorted) {
    cluster.colour = { r: cluster.r / cluster.pixels, g: cluster.g / cluster.pixels, b: cluster.b / cluster.pixels };
    cluster.share = cluster.pixels / Math.max(1, opaquePixels);
  }
  let covered = 0;
  let significant = 0;
  for (const cluster of sorted) {
    if (covered >= 0.92) break;
    covered += cluster.share;
    significant += 1;
  }
  return { clusters: sorted, flat: significant <= 10 && covered >= 0.92 };
}

async function correctPng(bytes, background, options) {
  const trigger = LOGO_CONTRAST_TRIGGER;
  const sample = await sharp(bytes)
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const boundaryFailure = boundaryContrastShare(sample.data, sample.info.width, sample.info.height, sample.info.channels, background, trigger);
  if (boundaryFailure < 0.04) return { bytes, kind: "none", adjustments: [] };
  const { clusters, flat } = rasterClusters(sample.data, sample.info.width, sample.info.height, sample.info.channels);
  const hasProtectedInterior = clusters.some((cluster) => cluster.share >= 0.02 && cluster.exposed / cluster.pixels < 0.002);
  const container = !options.wordmark && hasProtectedInterior
    ? clusters.find((cluster) => cluster.share >= 0.4 && cluster.exposed > 0)?.key
    : undefined;
  const corrections = flat ? clusters
    .filter((cluster) => cluster.key !== container && cluster.share >= 0.01 && cluster.exposed >= 2)
    .filter((cluster) => contrastRatio(cluster.colour, background) < trigger)
    .map((cluster) => ({ from: cluster.colour, to: adjustedLogoColour(cluster.colour, background) })) : [];
  if (container && !corrections.length) return { bytes, kind: "none", adjustments: [], preserveOriginal: true };
  if (!corrections.length || corrections.length > 4) return { bytes, kind: "none", adjustments: [] };
  const original = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(original.data);
  for (let offset = 0; offset < output.length; offset += 4) {
    if (output[offset + 3] === 0) continue;
    const colour = pixelColour(output, offset);
    const closest = corrections.map((correction) => ({ correction, distance: colourDistance(colour, correction.from) }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (!closest || closest.distance > 30) continue;
    const weight = Math.max(0, 1 - closest.distance / 30);
    output[offset] = Math.round(colour.r + (closest.correction.to.r - colour.r) * weight);
    output[offset + 1] = Math.round(colour.g + (closest.correction.to.g - colour.g) * weight);
    output[offset + 2] = Math.round(colour.b + (closest.correction.to.b - colour.b) * weight);
  }
  return {
    bytes: await sharp(output, { raw: { width: original.info.width, height: original.info.height, channels: 4 } })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer(),
    kind: "selective-paint",
    adjustments: corrections.map(({ from, to }) => ({ from: hexColour(from), to: hexColour(to) })),
  };
}

export async function correctLogoContrast(bytes, format, orbColour, options = {}) {
  const seedBackground = parseHex(orbColour);
  const background = logoContrastBackground(seedBackground);
  const trigger = LOGO_CONTRAST_TRIGGER;
  if (!seedBackground || !background) return { bytes, kind: "none", adjustments: [], preserveOriginal: false };
  if (format === "png") return correctPng(bytes, background, options);
  if (format !== "svg") return { bytes, kind: "none", adjustments: [], preserveOriginal: false };
  const source = Buffer.from(bytes).toString("utf8");
  const structuralContainer = leadingContainerPaint(source);
  const preserveOriginal = Boolean(structuralContainer
    && structuralContainer.r >= 235
    && structuralContainer.g >= 235
    && structuralContainer.b >= 235);
  const gradientGroups = visibleGradientGroups(source);
  const gradientPaints = [...new Map(gradientGroups.flatMap((group) => group.colours)
    .map((colour) => [hexColour(colour), colour])).values()];
  const gradientPaintHexes = new Set(gradientPaints.map(hexColour));
  const paints = [...new Map([...visibleHexPaints(source), ...gradientPaints]
    .map((colour) => [hexColour(colour), colour])).values()];
  if (!paints.length) {
    const defaultPaint = { r: 0, g: 0, b: 0 };
    if (contrastRatio(defaultPaint, background) >= LOGO_CONTRAST_TARGET) {
      return { bytes, kind: "none", adjustments: [], preserveOriginal: true };
    }
    const adjustedDefault = hexColour(adjustedLogoColour(defaultPaint, background));
    const adjustedSource = source.replace(/<svg\b/i, `<svg fill="${adjustedDefault}"`);
    return {
      bytes: Buffer.from(adjustedSource),
      kind: "selective-paint",
      adjustments: [{ from: "#000000", to: adjustedDefault }],
      preserveOriginal: true,
    };
  }
  if (paints.every((paint) => paint.r >= 235 && paint.g >= 235 && paint.b >= 235)) {
    return { bytes, kind: "none", adjustments: [], preserveOriginal: true };
  }
  if (preserveOriginal) return { bytes, kind: "none", adjustments: [], preserveOriginal: true };
  const stats = await exposedSvgPaints(bytes, paints);
  const totalPixels = stats.reduce((total, entry) => total + entry.pixels, 0);
  const hasProtectedInterior = stats.some((entry) => entry.pixels / Math.max(1, totalPixels) >= 0.02 && entry.exposed / Math.max(1, entry.pixels) < 0.002);
  const container = (!options.wordmark ? structuralContainer : undefined) ?? (!options.wordmark && hasProtectedInterior
    ? stats.find((entry) => entry.pixels / Math.max(1, totalPixels) >= 0.4 && entry.exposed > 0)?.colour
    : undefined);
  const adjustmentMap = new Map();
  const paintCandidates = options.wordmark
    ? paints.map((colour) => ({ colour, pixels: 2, exposed: 2 }))
    : stats.map((entry) => gradientPaintHexes.has(hexColour(entry.colour))
      ? { ...entry, pixels: Math.max(2, entry.pixels), exposed: Math.max(2, entry.exposed) }
      : entry);
  const failingPaints = paintCandidates
    .filter((entry) => entry.pixels >= 2 && entry.exposed >= 2)
    .map((entry) => entry.colour)
    .filter((colour) => contrastRatio(colour, background) < trigger);
  const adjustedPaints = adjustedLogoColours(failingPaints, background, LOGO_CONTRAST_TARGET, trigger);
  failingPaints.forEach((colour, index) => {
    adjustmentMap.set(hexColour(colour), hexColour(adjustedPaints[index]));
  });
  for (const group of gradientGroups) {
    if (group.colours.every((colour) => contrastRatio(colour, background) >= trigger)) continue;
    const adjusted = adjustedGradientColours(group.colours, background, LOGO_GRADIENT_CONTRAST_TARGET, trigger);
    if (!adjusted) continue;
    group.colours.forEach((colour, index) => {
      if (hexColour(colour) !== hexColour(adjusted[index])) adjustmentMap.set(hexColour(colour), hexColour(adjusted[index]));
    });
  }
  const containerHex = container && hexColour(container);
  if (containerHex
    && shapePaintOccurrences(source, containerHex) <= 2
    && contrastRatio(container, background) >= LOGO_CONTRAST_TARGET) adjustmentMap.delete(containerHex);
  if (adjustmentMap.size > 0) {
    const adjusted = replaceSvgPaints(source, adjustmentMap, containerHex);
    if (adjusted === source) return { bytes, kind: "none", adjustments: [], preserveOriginal: Boolean(container) || preserveOriginal };
    return {
      bytes: Buffer.from(adjusted),
      kind: "selective-paint",
      adjustments: [...adjustmentMap].map(([from, to]) => ({ from, to })),
      preserveOriginal: true,
    };
  }
  if (container) return { bytes, kind: "none", adjustments: [], preserveOriginal: true };
  const sample = await sharp(bytes, { density: 192 }).resize(128, 128).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (boundaryContrastShare(sample.data, sample.info.width, sample.info.height, sample.info.channels, background, trigger) < 0.04) {
    return { bytes, kind: "none", adjustments: [], preserveOriginal: true };
  }
  return { bytes, kind: "none", adjustments: [], preserveOriginal: true };
}
