import sharp from "sharp";

export const LOGO_RESOLUTION_FLOOR = Object.freeze({
  minimumRasterDimension: 256,
  minimumRasterShortDimension: 64,
  analysisSize: 128,
  minimumSharpness: 4,
  maximumTranslucentPixelShare: 0.35,
  maximumSoftVisiblePixelShare: 0.65,
});

export const EXACT_TICKER_LOGO_RESOLUTION_FLOOR = Object.freeze({
  ...LOGO_RESOLUTION_FLOOR,
  minimumRasterDimension: 96,
  minimumRasterShortDimension: 30,
});

function safeCrop(crop, width, height) {
  if (!crop) return undefined;
  const left = Math.max(0, Math.min(width - 1, Math.floor(crop.left * width)));
  const top = Math.max(0, Math.min(height - 1, Math.floor(crop.top * height)));
  const right = Math.max(left + 1, Math.min(width, Math.ceil((crop.left + crop.width) * width)));
  const bottom = Math.max(top + 1, Math.min(height, Math.ceil((crop.top + crop.height) * height)));
  return { left, top, width: right - left, height: bottom - top };
}

function compositedGreyscale(data, size) {
  let weightedLuminance = 0;
  let alphaTotal = 0;
  for (let index = 0; index < size * size; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3] / 255;
    const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    weightedLuminance += luminance * alpha;
    alphaTotal += alpha;
  }
  const background = alphaTotal && weightedLuminance / alphaTotal > 192 ? 0 : 255;
  const greyscale = new Float32Array(size * size);
  for (let index = 0; index < greyscale.length; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3] / 255;
    const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    greyscale[index] = luminance * alpha + background * (1 - alpha);
  }
  return greyscale;
}

function laplacianSharpness(data, size) {
  let squared = 0;
  let samples = 0;
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const index = y * size + x;
      const laplacian = 4 * data[index]
        - data[index - 1]
        - data[index + 1]
        - data[index - size]
        - data[index + size];
      squared += laplacian * laplacian;
      samples += 1;
    }
  }
  return Math.sqrt(squared / Math.max(1, samples));
}

function alphaIntegrity(data, size) {
  let translucent = 0;
  let opaque = 0;
  let visible = 0;
  for (let index = 0; index < size * size; index += 1) {
    const alpha = data[index * 4 + 3];
    if (alpha > 5) visible += 1;
    if (alpha > 5 && alpha < 250) translucent += 1;
    else if (alpha >= 250) opaque += 1;
  }
  return {
    translucentPixelShare: translucent / (size * size),
    opaquePixelShare: opaque / (size * size),
    softVisiblePixelShare: translucent / Math.max(1, visible),
  };
}

export async function measureLogoResolution(filename, crop, floor = LOGO_RESOLUTION_FLOOR) {
  const metadata = await sharp(filename).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const vector = metadata.format === "svg";

  if (vector) {
    return {
      passes: true,
      format: metadata.format,
      width,
      height,
      vector: true,
      sharpness: null,
      translucentPixelShare: null,
      opaquePixelShare: null,
      softVisiblePixelShare: null,
      reasons: [],
    };
  }

  let image = sharp(filename);
  const extraction = width && height ? safeCrop(crop, width, height) : undefined;
  if (extraction) image = image.extract(extraction);
  const { data } = await image
    .resize(floor.analysisSize, floor.analysisSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sharpness = laplacianSharpness(compositedGreyscale(data, floor.analysisSize), floor.analysisSize);
  const alpha = alphaIntegrity(data, floor.analysisSize);
  const reasons = [];
  if (Math.max(width, height) < floor.minimumRasterDimension
    || Math.min(width, height) < floor.minimumRasterShortDimension) {
    reasons.push("dimensions");
  }
  if (sharpness < floor.minimumSharpness) reasons.push("effective-resolution");
  if (alpha.translucentPixelShare > floor.maximumTranslucentPixelShare
    && alpha.softVisiblePixelShare > floor.maximumSoftVisiblePixelShare) {
    reasons.push("soft-alpha");
  }

  return {
    passes: reasons.length === 0,
    format: metadata.format ?? "unknown",
    width,
    height,
    vector: false,
    sharpness: Number(sharpness.toFixed(3)),
    translucentPixelShare: Number(alpha.translucentPixelShare.toFixed(3)),
    opaquePixelShare: Number(alpha.opaquePixelShare.toFixed(3)),
    softVisiblePixelShare: Number(alpha.softVisiblePixelShare.toFixed(3)),
    reasons,
  };
}

export function resolutionFailureMessage(measurement, floor = LOGO_RESOLUTION_FLOOR) {
  const dimensions = `${measurement.width}x${measurement.height}`;
  const sharpness = measurement.sharpness == null ? "unavailable" : measurement.sharpness.toFixed(3);
  const softAlpha = measurement.translucentPixelShare == null
    ? "unavailable"
    : `${(measurement.translucentPixelShare * 100).toFixed(1)}%`;
  return `Source is below the logo resolution floor (${dimensions}, sharpness ${sharpness}, soft alpha ${softAlpha}; requires at least ${floor.minimumRasterDimension}px on the long edge, ${floor.minimumRasterShortDimension}px on the short edge, ${floor.minimumSharpness.toFixed(2)} sharpness, and no interpolation-heavy alpha).`;
}
