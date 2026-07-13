export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

export function normaliseHexColour(hex: string) {
  const value = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return `#${value.split("").map((channel) => channel + channel).join("")}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(value)) return `#${value.toLowerCase()}`;
  throw new TypeError(`Orb colours must use #RGB or #RRGGBB format. Received: ${hex}`);
}

export function hexToRgb(hex: string): RGB {
  const value = normaliseHexColour(hex).slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB) {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function mixRgb(a: RGB, b: RGB, amount: number): RGB {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r
    ? (g - b) / d + (g < b ? 6 : 0)
    : max === g
      ? (b - r) / d + 2
      : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  };
}

export function hslToHex(hsl: HSL) {
  return rgbToHex(hslToRgb(hsl));
}

export function shiftHueToward(hue: number, target: number, amount: number) {
  const delta = ((((target - hue) % 360) + 540) % 360) - 180;
  return hue + delta * amount;
}

export function hueDistance(a: number, b: number) {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

export function relativeLuminance({ r, g, b }: RGB) {
  const linear = (value: number) => {
    value /= 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return linear(r) * 0.2126 + linear(g) * 0.7152 + linear(b) * 0.0722;
}

export function contrastRatio(a: string, b: string) {
  const first = relativeLuminance(hexToRgb(a));
  const second = relativeLuminance(hexToRgb(b));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function stableColourIndex(key: string | number, length: number) {
  if (length <= 0) return 0;
  if (typeof key === "number") return Math.abs(Math.trunc(key)) % length;
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

