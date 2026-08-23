export function canvasEdgeLineInsets(data, width, height, channels, maximumThickness = 3) {
  const insets = { left: 0, top: 0, right: 0, bottom: 0 };
  const distance = (first, second) => Math.max(
    Math.abs(data[first] - data[second]),
    Math.abs(data[first + 1] - data[second + 1]),
    Math.abs(data[first + 2] - data[second + 2]),
  );
  const sideShare = (side, thickness) => {
    let different = 0;
    const length = side === "left" || side === "right" ? height : width;
    for (let index = 0; index < length; index += 1) {
      const x = side === "left" ? thickness - 1 : side === "right" ? width - thickness : index;
      const y = side === "top" ? thickness - 1 : side === "bottom" ? height - thickness : index;
      const referenceX = side === "left" ? maximumThickness + 1 : side === "right" ? width - maximumThickness - 2 : x;
      const referenceY = side === "top" ? maximumThickness + 1 : side === "bottom" ? height - maximumThickness - 2 : y;
      if (distance((y * width + x) * channels, (referenceY * width + referenceX) * channels) >= 24) different += 1;
    }
    return different / length;
  };
  for (const side of Object.keys(insets)) {
    for (let thickness = 1; thickness <= maximumThickness; thickness += 1) {
      if (sideShare(side, thickness) >= 0.94) insets[side] = thickness;
      else break;
    }
  }
  return insets;
}

export function stripExtractedCanvasEdgeLines(rgba, mask, width, height, maximumThickness = 3) {
  const insets = { left: 0, top: 0, right: 0, bottom: 0 };
  const coverage = (side, thickness) => {
    let visible = 0;
    const length = side === "left" || side === "right" ? height : width;
    for (let index = 0; index < length; index += 1) {
      const x = side === "left" ? thickness - 1 : side === "right" ? width - thickness : index;
      const y = side === "top" ? thickness - 1 : side === "bottom" ? height - thickness : index;
      visible += mask[y * width + x];
    }
    return visible / length;
  };
  for (const side of Object.keys(insets)) {
    for (let thickness = 1; thickness <= maximumThickness; thickness += 1) {
      if (coverage(side, thickness) >= 0.94) insets[side] = thickness;
      else break;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= insets.left && x < width - insets.right && y >= insets.top && y < height - insets.bottom) continue;
      const pixel = y * width + x;
      mask[pixel] = 0;
      rgba[pixel * 4 + 3] = 0;
    }
  }
  return insets;
}
