import { categoryFor, polylineLength } from '../engine.mjs';
import { paletteRegions, legendSwatches, colorDistance, cleanLegendName } from './palette.mjs';

export function components(mask, width, height) {
  const seen = new Uint8Array(mask.length),
    result = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start],
      pixels = [];
    seen[start] = 1;
    let x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0,
      border = false;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i],
        x = p % width,
        y = Math.floor(p / width);
      pixels.push(p);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) border = true;
      for (const n of [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ]) {
        if (n >= 0 && !seen[n] && mask[n] === mask[start]) {
          seen[n] = 1;
          queue.push(n);
        }
      }
    }
    result.push({
      pixels,
      x: x0,
      y: y0,
      width: x1 - x0 + 1,
      height: y1 - y0 + 1,
      border,
      value: mask[start],
    });
  }
  return result;
}

export function skeletonize(mask, width, height) {
  const output = Uint8Array.from(mask, (v) => (v ? 1 : 0));
  for (let iteration = 0; iteration < 80; iteration++) {
    let changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const remove = [];
      for (let y = 1; y < height - 1; y++)
        for (let x = 1; x < width - 1; x++) {
          const p = y * width + x;
          if (!output[p]) continue;
          const n = [-width, -width + 1, 1, width + 1, width, width - 1, -1, -width - 1].map(
            (d) => output[p + d],
          );
          const count = n.reduce((a, b) => a + b, 0),
            transitions = n.reduce((a, b, i) => a + (!b && n[(i + 1) % 8] ? 1 : 0), 0);
          if (count < 2 || count > 6 || transitions !== 1) continue;
          const first = pass ? n[0] * n[2] * n[6] : n[0] * n[2] * n[4];
          const second = pass ? n[0] * n[4] * n[6] : n[2] * n[4] * n[6];
          if (!first && !second) remove.push(p);
        }
      for (const p of remove) output[p] = 0;
      changed ||= remove.length > 0;
    }
    if (!changed) break;
  }
  return output;
}

function simplify(points, tolerance = 4) {
  if (points.length <= 2) return points;
  const a = points[0],
    b = points.at(-1),
    dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);
  let farthest = 0,
    index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = length
      ? Math.abs(dy * points[i].x - dx * points[i].y + b.x * a.y - b.y * a.x) / length
      : Math.hypot(points[i].x - a.x, points[i].y - a.y);
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  return farthest > tolerance
    ? [
        ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(points.slice(index), tolerance),
      ]
    : [a, b];
}

export function traceGraph(mask, width, height, toPoint, floor = 0) {
  const neighbors = (p) => {
    const x = p % width,
      y = Math.floor(p / width),
      result = [];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
      const n = p + dx + dy * width;
      if (mask[n] && !(dx && dy && (mask[p + dx] || mask[p + dy * width]))) result.push(n);
    }
    return result;
  };
  const special = new Uint8Array(mask.length);
  for (let p = 0; p < mask.length; p++) if (mask[p] && neighbors(p).length !== 2) special[p] = 1;
  for (const c of components(mask, width, height))
    if (!c.pixels.some((p) => special[p])) {
      special[c.pixels[0]] = 1;
      special[c.pixels[Math.floor(c.pixels.length / 2)]] = 1;
    }
  const nodeAt = new Map(),
    junctions = [];
  for (const c of components(special, width, height)) {
    const id = `f${floor}-j${junctions.length}`;
    const center = c.pixels.reduce(
      (s, p) => ({ x: s.x + (p % width), y: s.y + Math.floor(p / width) }),
      { x: 0, y: 0 },
    );
    junctions.push({
      id,
      ...toPoint(center.x / c.pixels.length, center.y / c.pixels.length),
      name: 'Path junction',
      category: 'Path',
      icon: 'pin',
      description: '',
      floor,
    });
    for (const p of c.pixels) nodeAt.set(p, id);
  }
  const visited = new Set(),
    edges = [],
    byId = new Map(junctions.map((j) => [j.id, j]));
  const key = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (const [p, from] of nodeAt)
    for (const next of neighbors(p)) {
      if (nodeAt.get(next) === from || visited.has(key(p, next))) continue;
      let previous = p,
        current = next,
        points = [byId.get(from)];
      visited.add(key(previous, current));
      for (let count = 0; count < mask.length; count++) {
        const to = nodeAt.get(current);
        if (to) {
          if (to !== from) {
            points.push(byId.get(to));
            const simple = simplify(points);
            if (polylineLength(simple) > 3)
              edges.push({
                a: from,
                b: to,
                points: simple.map((q) => ({ x: q.x, y: q.y })),
                accessible: false,
                confirmed: false,
                source: 'detected',
              });
          }
          break;
        }
        points.push(toPoint(current % width, Math.floor(current / width)));
        const following = neighbors(current).find(
          (n) => n !== previous && !visited.has(key(current, n)),
        );
        if (following === undefined) break;
        previous = current;
        current = following;
        visited.add(key(previous, current));
      }
    }
  return { junctions, edges };
}

function connectPlace(place, graph, floor) {
  let nearest = null,
    distance = Infinity;
  graph.edges.forEach((edge, edgeIndex) => {
    const points = edge.points;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(1, ((place.x - a.x) * dx + (place.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
      );
      const point = { x: a.x + t * dx, y: a.y + t * dy },
        d = Math.hypot(point.x - place.x, point.y - place.y);
      if (d < distance) {
        distance = d;
        nearest = { edge, edgeIndex, segment: i, point };
      }
    }
  });
  if (!nearest || distance > 100) return false;
  const { edge, edgeIndex, segment, point } = nearest;
  const close = graph.junctions.find((j) => Math.hypot(j.x - point.x, j.y - point.y) < 2);
  let id = close?.id;
  if (!id) {
    id = `f${floor}-j${graph.junctions.length}`;
    graph.junctions.push({
      id,
      ...point,
      floor,
      name: 'Path junction',
      category: 'Path',
      icon: 'pin',
      description: '',
    });
    graph.edges.splice(
      edgeIndex,
      1,
      { ...edge, b: id, points: [...edge.points.slice(0, segment), point] },
      { ...edge, a: id, points: [point, ...edge.points.slice(segment)] },
    );
  }
  graph.edges.push({
    a: place.id,
    b: id,
    points: [{ x: place.x, y: place.y }, point],
    accessible: false,
    confirmed: false,
    source: 'detected',
  });
  return true;
}

export function analyzeRaster({ pixels, width, height, lines, floor = 0 }) {
  if (
    width < 10 ||
    height < 10 ||
    width > 1000 ||
    height > 1000 ||
    pixels.length !== width * height * 4
  )
    throw new Error('Invalid map pixels.');
  const scale = Math.min(1000 / width, 800 / height),
    offsetX = (1000 - width * scale) / 2,
    offsetY = (800 - height * scale) / 2;
  const toPoint = (x, y) => ({ x: offsetX + x * scale, y: offsetY + y * scale });
  const rect = (c) => ({
    ...toPoint(c.x, c.y),
    width: c.width * scale,
    height: c.height * scale,
    color: c.color,
  });
  const regions = paletteRegions(pixels, width, height, components);
  const swatches = legendSwatches(regions, width, height);
  const swatchSet = new Set(swatches);
  const buildingRegions = regions.filter(
    (c) =>
      !swatchSet.has(c) &&
      !c.border &&
      c.pixels.length > Math.max(8, width * height * 0.000025) &&
      c.width < width * 0.6 &&
      c.height < height * 0.6,
  );
  const inLegend = (x, y) =>
    swatches.some(
      (c) => Math.abs(y - c.y - c.height / 2) < Math.max(c.height * 1.8, 10) && x >= c.x - 5,
    );
  const normalized = lines
    .map((l) => ({ ...l, text: l.text.replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.confidence >= 45 && /[A-Za-z]{3}/.test(l.text));
  const title = normalized.find(
    (l) => l.y < height * 0.15 && /university|campus|faculty/i.test(l.text),
  )?.text;
  const places = [],
    unplacedLabels = [],
    usedLines = new Set(),
    usedBuildings = new Set();
  const addPlace = (name, x, y, confidence, description) => {
    if (
      name.length < 4 ||
      name.length > 100 ||
      places.length >= 500 ||
      places.some(
        (p) => p.name === name && Math.hypot(p.x - toPoint(x, y).x, p.y - toPoint(x, y).y) < 40,
      )
    )
      return;
    places.push({
      id: `f${floor}-p${places.length}`,
      name,
      ...toPoint(x, y),
      ...categoryFor(name),
      floor,
      confidence,
      description:
        description ||
        'Read from your layout. Check the label and entrance before following directions.',
    });
  };
  for (const swatch of swatches) {
    const cy = swatch.y + swatch.height / 2;
    const line = normalized
      .filter(
        (l) =>
          l.text !== title &&
          !usedLines.has(l) &&
          l.x + l.width > swatch.x + swatch.width &&
          Math.abs(l.y + l.height / 2 - cy) < Math.max(swatch.height * 1.2, l.height),
      )
      .sort((a, b) => Math.abs(a.y + a.height / 2 - cy) - Math.abs(b.y + b.height / 2 - cy))[0];
    if (!line) continue;
    usedLines.add(line);
    const name = cleanLegendName(line.text);
    const candidates = buildingRegions
      .filter(
        (c) =>
          c.pixels.length > swatch.pixels.length * 0.25 &&
          !usedBuildings.has(c) &&
          !inLegend(c.x + c.width / 2, c.y + c.height / 2),
      )
      .map((c) => ({ c, d: colorDistance(c.rgb, swatch.rgb) }))
      .filter((v) => v.d < 95)
      .sort((a, b) => a.d - b.d);
    if (
      swatches.some((other) => other !== swatch && colorDistance(other.rgb, swatch.rgb) < 18) ||
      !candidates.length ||
      (candidates.length > 1 && candidates[1].d - candidates[0].d < 8)
    ) {
      unplacedLabels.push({ name, confidence: line.confidence, color: swatch.color });
      continue;
    }
    const target = candidates[0].c;
    usedBuildings.add(target);
    addPlace(
      name,
      target.x + target.width / 2,
      target.y + target.height / 2,
      line.confidence,
      'Matched from the colour legend. Move the pin to the real entrance before connecting a path.',
    );
  }
  const useful =
    /library|lecture|caf[eé]|canteen|entrance|student|department|faculty|laboratory|auditorium|health|garden|sport|hall|office|room|centre|center|complex/i;
  for (const line of normalized) {
    const x = line.x + line.width / 2,
      y = line.y + line.height / 2;
    if (
      usedLines.has(line) ||
      line.text === title ||
      inLegend(x, y) ||
      line.confidence < 65 ||
      !useful.test(line.text) ||
      /\b(road|path|walk|corridor|legend|scale|north|copyright|metres|meters)\b/i.test(line.text) ||
      line.text.split(' ').length > 10
    )
      continue;
    if (
      [...usedBuildings].some(
        (c) => x >= c.x - 3 && x <= c.x + c.width + 3 && y >= c.y - 3 && y <= c.y + c.height + 3,
      )
    )
      continue;
    addPlace(line.text, x, y, line.confidence);
  }
  // Solid road bands can be proposed; white gaps, thin outlines, text and page frames cannot.
  const gray = new Uint8Array(width * height);
  const margin = Math.max(3, Math.round(Math.min(width, height) * 0.025));
  for (let y = margin; y < height - margin; y++)
    for (let x = margin; x < width - margin; x++) {
      const i = y * width + x,
        r = pixels[i * 4],
        g = pixels[i * 4 + 1],
        b = pixels[i * 4 + 2];
      if (
        Math.max(r, g, b) - Math.min(r, g, b) < 18 &&
        Math.min(r, g, b) > 110 &&
        Math.max(r, g, b) < 225 &&
        !inLegend(x, y) &&
        !swatches.some((c) => c.x > width * 0.55 && x >= c.x - 5)
      )
        gray[i] = 1;
    }
  for (const l of lines)
    for (let y = Math.max(0, Math.floor(l.y - 2)); y < Math.min(height, l.y + l.height + 2); y++)
      for (let x = Math.max(0, Math.floor(l.x - 2)); x < Math.min(width, l.x + l.width + 2); x++)
        gray[y * width + x] = 0;
  // Require a genuine band interior: anti-aliased single-pixel boundaries have none.
  const roadMask = new Uint8Array(gray.length);
  for (const c of components(gray, width, height)) {
    if (
      c.x <= margin ||
      c.y <= margin ||
      c.x + c.width >= width - margin ||
      c.y + c.height >= height - margin ||
      c.pixels.length < 60
    )
      continue;
    let interior = 0;
    for (const i of c.pixels)
      if (
        gray[i - 1] &&
        gray[i + 1] &&
        gray[i - width] &&
        gray[i + width] &&
        gray[i - 2] &&
        gray[i + 2] &&
        gray[i - 2 * width] &&
        gray[i + 2 * width]
      )
        interior++;
    const elongated = Math.max(c.width / c.height, c.height / c.width) > 4;
    if (interior / c.pixels.length < 0.16 || !elongated) continue;
    for (const i of c.pixels) roadMask[i] = 1;
  }
  const graph = traceGraph(skeletonize(roadMask, width, height), width, height, toPoint, floor);
  if (graph.junctions.length > 120 || graph.edges.length > 180) {
    graph.junctions = [];
    graph.edges = [];
  }
  let connected = 0;
  for (const place of places) if (connectPlace(place, graph, floor)) connected++;
  const warnings = [];
  if (!places.length)
    warnings.push(
      'No reliable destination positions were found. Keep the source visible and place labels where they belong.',
    );
  if (unplacedLabels.length)
    warnings.push(
      'Some legend colours are ambiguous. Review any labels still waiting for placement.',
    );
  if (!graph.edges.length)
    warnings.push(
      'No distinct path network could be verified from the image. Trace the walkways on the original layout to enable routes.',
    );
  else
    warnings.push(
      'Path candidates need review. Check every segment and entrance before using directions.',
    );
  if (connected < places.length)
    warnings.push('Check that each destination has a traced connection to the walkway network.');
  warnings.push('Distances and geographic north are not calibrated.');
  return {
    title,
    places,
    ...graph,
    buildings: buildingRegions.map(rect),
    roads: graph.edges.map((e) => e.points),
    warnings,
    unplacedLabels,
    reviewed: false,
  };
}
