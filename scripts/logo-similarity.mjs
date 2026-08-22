import sharp from "sharp";

export async function logoSignature(input) {
  const initial = sharp(input, { density: 384, failOn: "none" })
    .resize(128, 128, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha();
  const { data, info } = await initial.raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha <= 12) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("image has no visible foreground");

  const width = right - left + 1;
  const height = bottom - top + 1;
  const normalized = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({ left, top, width, height })
    .resize(64, 64, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .blur(1.1)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const signature = new Float32Array(64 * 64);
  for (let pixel = 0; pixel < signature.length; pixel += 1) {
    signature[pixel] = normalized[pixel * 4 + 3] / 255;
  }
  return signature;
}

export function logoSimilarity(left, right) {
  let intersection = 0;
  let union = 0;
  let dot = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < left.length; index += 1) {
    intersection += Math.min(left[index], right[index]);
    union += Math.max(left[index], right[index]);
    dot += left[index] * right[index];
    leftSquare += left[index] ** 2;
    rightSquare += right[index] ** 2;
  }
  const overlap = union ? intersection / union : 0;
  const cosine = leftSquare && rightSquare ? dot / Math.sqrt(leftSquare * rightSquare) : 0;
  return Number((overlap * 0.55 + cosine * 0.45).toFixed(4));
}
