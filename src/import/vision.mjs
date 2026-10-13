import { categoryFor, polylineLength } from '../engine.mjs';

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
  if (width < 10 || height < 10 || pixels.length !== width * height * 4)
    throw new Error('Invalid map pixels.');
  const scale = Math.min(1000 / width, 800 / height),
    offsetX = (1000 - width * scale) / 2,
    offsetY = (800 - height * scale) / 2;
  const toPoint = (x, y) => ({ x: offsetX + x * scale, y: offsetY + y * scale });
  const rect = (c) => ({ ...toPoint(c.x, c.y), width: c.width * scale, height: c.height * scale });
  const colored = new Uint16Array(width * height),
    white = new Uint8Array(width * height),
    gray = new Uint8Array(width * height);
  for (let i = 0; i < white.length; i++) {
    const r = pixels[i * 4],
      g = pixels[i * 4 + 1],
      b = pixels[i * 4 + 2],
      max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      light = (r + g + b) / 3;
    if (max - min > 45 && light > 45 && light < 235)
      colored[i] = 1 + (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    white[i] = min > 235 ? 1 : 0;
    gray[i] = max - min < 30 && light > 100 && light < 233 ? 1 : 0;
  }
  const colorRegions = components(colored, width, height).filter(
    (c) => c.pixels.length > 8 && c.pixels.length / (c.width * c.height) > 0.55,
  );
  const whiteRegions = components(white, width, height).filter(
    (c) => !c.border && c.pixels.length > 35,
  );
  const isBuilding = (c) =>
    c.width >= 6 &&
    c.height >= 5 &&
    Math.max(c.width / c.height, c.height / c.width) < 4 &&
    c.pixels.length / (c.width * c.height) > 0.55 &&
    c.width < width * 0.45 &&
    c.height < height * 0.45;
  const buildingRegions = [
    ...colorRegions.filter((c) => c.pixels.length > 50 && isBuilding(c)),
    ...whiteRegions.filter(isBuilding),
  ].slice(0, 300);
  const buildings = buildingRegions.map(rect);
  const roadMask = new Uint8Array(white.length);
  const looksLikeRoad = (c) =>
    c.pixels.length >= 40 &&
    (Math.max(c.width / c.height, c.height / c.width) > 4 ||
      (c.width > width * 0.25 &&
        c.height > height * 0.2 &&
        c.pixels.length / (c.width * c.height) < 0.45));
  for (const c of [...components(gray, width, height), ...whiteRegions].filter(looksLikeRoad))
    for (const p of c.pixels) roadMask[p] = 1;
  for (const b of buildingRegions)
    for (let y = b.y; y < b.y + b.height; y++)
      for (let x = b.x; x < b.x + b.width; x++) roadMask[y * width + x] = 0;
  const skeleton = skeletonize(roadMask, width, height),
    graph = traceGraph(skeleton, width, height, toPoint, floor);
  if (graph.junctions.length > 900 || graph.edges.length > 2400) {
    graph.junctions = [];
    graph.edges = [];
  }
  const normalized = lines
    .map((l) => ({ ...l, text: l.text.replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.confidence >= 45 && /[A-Za-z]{3}/.test(l.text));
  const title = normalized.find(
    (l) => l.y < height * 0.12 && /university|campus|faculty/i.test(l.text),
  )?.text;
  const places = [],
    legendLines = new Set();
  const addPlace = (name, x, y, confidence) => {
    if (
      name.length < 3 ||
      name.length > 90 ||
      places.some(
        (p) =>
          p.name.toLowerCase() === name.toLowerCase() &&
          Math.hypot(p.x - toPoint(x, y).x, p.y - toPoint(x, y).y) < 80,
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
        'Read from your layout. Check the label and entrance before following directions.',
    });
  };
  for (const line of normalized) {
    const key = colorRegions
      .filter(
        (c) =>
          c.width < 10 &&
          c.height < 10 &&
          c.x < line.x &&
          line.x - c.x - c.width < width * 0.06 &&
          Math.abs(c.y + c.height / 2 - line.y - line.height / 2) < Math.max(line.height, 6),
      )
      .sort((a, b) => b.x - a.x)[0];
    if (!key) continue;
    const target = buildingRegions
      .filter((c) => c.value === key.value && c.pixels.length > key.pixels.length * 2)
      .sort((a, b) => b.pixels.length - a.pixels.length)[0];
    if (target) {
      addPlace(
        line.text.replace(/^[A-Z0-9]{1,3}\s*[-–:.,]\s*/i, ''),
        target.x + target.width / 2,
        target.y + target.height / 2,
        line.confidence,
      );
      legendLines.add(line);
    }
  }
  for (const line of normalized) {
    if (
      legendLines.has(line) ||
      line.text === title ||
      /\b(road|path|walk|corridor|legend|scale|north|copyright|metres|meters)\b/i.test(line.text) ||
      line.text.split(' ').length > 10
    )
      continue;
    const x = line.x + line.width / 2,
      y = line.y + line.height / 2;
    const building = buildingRegions.find(
      (c) => x >= c.x - 2 && x <= c.x + c.width + 2 && y >= c.y - 2 && y <= c.y + c.height + 2,
    );
    if (
      building ||
      /library|lecture|caf[eé]|canteen|gate|entrance|student|department|faculty|laboratory|auditorium|health|garden|sport|hall|office|room|centre|center/i.test(
        line.text,
      )
    )
      addPlace(line.text, x, y, line.confidence);
  }
  let connected = 0;
  for (const place of places) if (connectPlace(place, graph, floor)) connected++;
  const warnings = [];
  if (!places.length)
    warnings.push(
      'No clear place labels were found. Try a sharper photo or add the missing places.',
    );
  if (!graph.edges.length)
    warnings.push(
      'No distinct path network was found. Open white space is not treated as a road. Add verified paths in the editor.',
    );
  else
    warnings.push(
      'Detected paths and entrances are estimates. Compare them with the source before starting directions.',
    );
  if (connected < places.length)
    warnings.push(
      `${places.length - connected} place${places.length - connected === 1 ? ' is' : 's are'} not connected to a detected path.`,
    );
  warnings.push(
    'The map has no real-world scale. Route lengths are compared relative to one another.',
  );
  return {
    title,
    places,
    ...graph,
    buildings,
    roads: graph.edges.map((e) => e.points),
    warnings,
    reviewed: false,
  };
}
