// Palette regions locate legend swatches and matching buildings without exact RGB equality.
export function paletteRegions(pixels, width, height, components) {
  const mask = new Uint16Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const r = pixels[i * 4],
      g = pixels[i * 4 + 1],
      b = pixels[i * 4 + 2];
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min;
    if (d < 24 || max < 90 || (r + g + b) / 3 > 247) continue;
    const hue =
      ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
    mask[i] = 1 + Math.round(hue / 20) + Math.round((d / max) * 3) * 32;
  }
  const raw = components(mask, width, height)
    .filter((c) => c.pixels.length >= 5)
    .map((c) => {
      const rgb = [0, 0, 0];
      for (const i of c.pixels)
        for (let k = 0; k < 3; k++) rgb[k] += pixels[i * 4 + k] / c.pixels.length;
      return {
        ...c,
        rgb,
        color: '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''),
      };
    });
  const merged = [];
  for (const region of raw.sort((a, b) => b.pixels.length - a.pixels.length)) {
    const match = merged.find(
      (c) =>
        colorDistance(c.rgb, region.rgb) < 80 &&
        c.x <= region.x + region.width &&
        region.x <= c.x + c.width &&
        c.y <= region.y + region.height &&
        region.y <= c.y + c.height,
    );
    if (!match) {
      merged.push({ ...region });
      continue;
    }
    const n = match.pixels.length,
      m = region.pixels.length;
    match.rgb = match.rgb.map((v, i) => (v * n + region.rgb[i] * m) / (n + m));
    const x = Math.min(match.x, region.x),
      y = Math.min(match.y, region.y);
    match.width = Math.max(match.x + match.width, region.x + region.width) - x;
    match.height = Math.max(match.y + match.height, region.y + region.height) - y;
    match.x = x;
    match.y = y;
    match.pixels = match.pixels.concat(region.pixels);
    match.color = '#' + match.rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  return merged;
}
export function legendSwatches(regions, width, height) {
  const small = regions.filter(
    (c) =>
      c.width <= width * 0.035 &&
      c.height <= height * 0.04 &&
      c.width >= 3 &&
      c.height >= 3 &&
      c.pixels.length / (c.width * c.height) > 0.45,
  );
  const groups = [];
  for (const c of small) {
    let group = groups.find((g) => Math.abs(g[0].x - c.x) < Math.max(5, width * 0.012));
    if (!group) {
      group = [];
      groups.push(group);
    }
    group.push(c);
  }
  return groups
    .filter(
      (g) =>
        g.length >= 5 &&
        Math.max(...g.map((c) => c.y)) - Math.min(...g.map((c) => c.y)) > height * 0.12,
    )
    .flat()
    .sort((a, b) => a.y - b.y);
}
export function colorDistance(a, b) {
  return Math.hypot(...a.map((v, i) => v - b[i]));
}
export function cleanLegendName(text) {
  const suffix = text
    .split(/\s*[-–—]\s*/)
    .slice(1)
    .join(' ')
    .trim();
  return (suffix.length >= 4 ? suffix : text.replace(/^[^A-Za-z]*[A-Z][0-9,._]*\s+/, ''))
    .replace(/^[^A-Za-z]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
