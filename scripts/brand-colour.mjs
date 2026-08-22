import sharp from "sharp";

const neutralFallback = { r: 57, g: 65, b: 80 };

function hexColour(colour) {
  return `#${[colour.r, colour.g, colour.b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function dominantChromaticColour(data, mask, width, bounds) {
  const buckets = new Map();
  for (let y = bounds.top; y < bounds.bottom; y += 2) {
    for (let x = bounds.left; x < bounds.right; x += 2) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      const offset = pixel * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const maximum = Math.max(r, g, b);
      const minimum = Math.min(r, g, b);
      const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
      if ((maximum > 242 && minimum > 230) || maximum < 24 || saturation < 0.12) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  const mode = [...buckets.values()].sort((left, right) => right.count - left.count)[0];
  if (!mode) {
    return {
      colour: neutralFallback,
      hex: hexColour(neutralFallback),
      source: "neutral-fallback",
    };
  }
  const colour = {
    r: Math.round(mode.r / mode.count),
    g: Math.round(mode.g / mode.count),
    b: Math.round(mode.b / mode.count),
  };
  return { colour, hex: hexColour(colour), source: "logo-derived" };
}

export async function deriveBrandColourFromLogo(input) {
  const { data, info } = await sharp(input, { density: 384 })
    .resize(256, 256, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  let visiblePixels = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (data[pixel * 4 + 3] <= 24) continue;
    mask[pixel] = 1;
    visiblePixels += 1;
  }
  if (!visiblePixels) {
    return { colour: neutralFallback, hex: hexColour(neutralFallback), source: "neutral-fallback" };
  }
  return dominantChromaticColour(data, mask, info.width, {
    left: 0,
    top: 0,
    right: info.width,
    bottom: info.height,
  });
}

function colourModeFromColours(significant) {
  const hues = significant.flatMap(([r, g, b]) => {
    const maximum = Math.max(r, g, b) / 255;
    const minimum = Math.min(r, g, b) / 255;
    const delta = maximum - minimum;
    const lightness = (maximum + minimum) / 2;
    const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
    if (saturation < 0.18) return [];
    const [red, green, blue] = [r, g, b].map((value) => value / 255);
    const rawHue = maximum === red
      ? 60 * (((green - blue) / delta) % 6)
      : maximum === green
        ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);
    return [(rawHue + 360) % 360];
  });
  for (let left = 0; left < hues.length; left += 1) {
    for (let right = left + 1; right < hues.length; right += 1) {
      const distance = Math.min(Math.abs(hues[left] - hues[right]), 360 - Math.abs(hues[left] - hues[right]));
      if (distance >= 35) return "multicolour";
    }
  }
  return significant.length > 1 ? "tonal" : "monochrome";
}

export function detectLogoColourMode(data, mask, width, bounds) {
  const buckets = new Map();
  let visible = 0;
  for (let y = bounds.top; y < bounds.bottom; y += 2) {
    for (let x = bounds.left; x < bounds.right; x += 2) {
      const pixel = y * width + x;
      if (!mask[pixel]) continue;
      visible += 1;
      const offset = pixel * 4;
      const key = `${data[offset] >> 4},${data[offset + 1] >> 4},${data[offset + 2] >> 4}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  const significant = [...buckets.entries()]
    .filter(([, count]) => count >= Math.max(8, visible * 0.04))
    .map(([key]) => key.split(",").map((value) => Number(value) * 16 + 8));
  return colourModeFromColours(significant);
}

function svgColourMode(input) {
  const source = input.toString("utf8");
  if (!source.includes("<svg")) return undefined;
  const artwork = source.replace(/<defs\b[\s\S]*?<\/defs>/gi, "");
  const referencedGradientIds = [...artwork.matchAll(/url\(#([^)]+)\)/gi)].map((match) => match[1]);
  const referencedGradients = referencedGradientIds.map((id) => {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return source.match(new RegExp(`<(?:linear|radial)Gradient\\b[^>]*id=["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/(?:linear|radial)Gradient>`, "i"))?.[0] ?? "";
  }).join("");
  const colours = [...`${artwork}${referencedGradients}`.matchAll(/(?:fill|stroke|stop-color)\s*=\s*["']#([0-9a-f]{3,8})["']/gi)]
    .map((match) => {
      const hex = match[1];
      const expanded = hex.length === 3
        ? [...hex].map((digit) => digit + digit).join("")
        : hex.slice(0, 6);
      return expanded.match(/../g).map((channel) => Number.parseInt(channel, 16));
    });
  const unique = [...new Map(colours.map((colour) => [colour.join(","), colour])).values()];
  return unique.length ? colourModeFromColours(unique) : undefined;
}

export async function analyseLogoColourMode(input) {
  const vectorMode = svgColourMode(input);
  if (vectorMode) return vectorMode;
  const { data, info } = await sharp(input, { density: 256 })
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (data[pixel * 4 + 3] > 96) mask[pixel] = 1;
  }
  return detectLogoColourMode(data, mask, info.width, { left: 0, top: 0, right: info.width, bottom: info.height });
}
