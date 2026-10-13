export const SESSION_MS = 3 * 60 * 60 * 1000;
export const isExpired = (expiresAt, now = Date.now()) =>
  !Number.isFinite(expiresAt) || now >= expiresAt;
export const remainingTime = (expiresAt, now = Date.now()) =>
  Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
export const polylineLength = (points) =>
  points
    .slice(1)
    .reduce((total, p, i) => total + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
function edgeLength(edge, byId) {
  if (Number.isFinite(edge.distance) && edge.distance >= 0) return edge.distance;
  if (edge.points?.length > 1) return polylineLength(edge.points);
  const a = byId.get(edge.a),
    b = byId.get(edge.b);
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
}
export function findRoute(nodes, edges, from, to, accessible = false, options = {}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(from) || !byId.has(to)) return null;
  const adjacency = new Map(nodes.map((n) => [n.id, []]));
  edges.forEach((edge, index) => {
    if (
      (accessible && !edge.accessible) ||
      (!options.preview && edge.confirmed === false) ||
      options.blockedEdges?.has(index)
    )
      return;
    if (
      !byId.has(edge.a) ||
      !byId.has(edge.b) ||
      options.blockedNodes?.has(edge.a) ||
      options.blockedNodes?.has(edge.b)
    )
      return;
    const cost = edgeLength(edge, byId);
    if (!Number.isFinite(cost) || cost < 0) return;
    adjacency.get(edge.a).push({ next: edge.b, index, cost });
    adjacency.get(edge.b).push({ next: edge.a, index, cost });
  });
  const distance = new Map([[from, 0]]),
    previous = new Map(),
    queue = new Set(byId.keys());
  while (queue.size) {
    let current = null,
      best = Infinity;
    for (const id of queue)
      if ((distance.get(id) ?? Infinity) < best) {
        current = id;
        best = distance.get(id);
      }
    if (current === null) return null;
    if (current === to) {
      const path = [to],
        edgeIndexes = [];
      while (previous.has(path[0])) {
        const p = previous.get(path[0]);
        path.unshift(p.id);
        edgeIndexes.unshift(p.index);
      }
      return options.details ? { path, distance: best, edgeIndexes } : { path, distance: best };
    }
    queue.delete(current);
    for (const { next, index, cost } of adjacency.get(current)) {
      if (queue.has(next) && best + cost < (distance.get(next) ?? Infinity)) {
        distance.set(next, best + cost);
        previous.set(next, { id: current, index });
      }
    }
  }
  return null;
}
// Yen's algorithm keeps alternatives loop-free and ranked by the same distance measure.
export function findAlternatives(
  nodes,
  edges,
  from,
  to,
  accessible = false,
  preview = false,
  limit = 3,
) {
  const options = { details: true, preview };
  const first = findRoute(nodes, edges, from, to, accessible, options);
  if (!first) return [];
  const routes = [first],
    candidates = new Map(),
    byId = new Map(nodes.map((n) => [n.id, n]));
  for (let k = 1; k < limit; k++) {
    const last = routes[k - 1];
    for (let i = 0; i < last.path.length - 1; i++) {
      const root = last.path.slice(0, i + 1),
        blockedEdges = new Set();
      for (const route of routes)
        if (root.every((id, j) => route.path[j] === id)) blockedEdges.add(route.edgeIndexes[i]);
      const spur = findRoute(nodes, edges, root.at(-1), to, accessible, {
        ...options,
        blockedEdges,
        blockedNodes: new Set(root.slice(0, -1)),
      });
      if (!spur) continue;
      const path = [...root.slice(0, -1), ...spur.path],
        edgeIndexes = [...last.edgeIndexes.slice(0, i), ...spur.edgeIndexes];
      const key = path.join('|');
      if (!routes.some((r) => r.path.join('|') === key))
        candidates.set(key, {
          path,
          edgeIndexes,
          distance: edgeIndexes.reduce((s, index) => s + edgeLength(edges[index], byId), 0),
        });
    }
    const next = [...candidates.entries()].sort((a, b) => a[1].distance - b[1].distance)[0];
    if (!next) break;
    candidates.delete(next[0]);
    routes.push(next[1]);
  }
  return routes;
}
export function routePoints(route, nodes, edges) {
  if (!route) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!route.edgeIndexes?.length) return route.path.map((id) => byId.get(id));
  return route.edgeIndexes.flatMap((index, i) => {
    const e = edges[index],
      points = e.points?.length > 1 ? [...e.points] : [byId.get(e.a), byId.get(e.b)];
    if (e.a !== route.path[i]) points.reverse();
    return i === 0 ? points : points.slice(1);
  });
}
export function categoryFor(name) {
  if (/caf[eé]|canteen|food|dining|restaurant|coffee/i.test(name))
    return { category: 'Food', icon: 'coffee' };
  if (/garden|park|sport|field|grounds|court/i.test(name))
    return { category: 'Outdoors', icon: /sport|court|field/i.test(name) ? 'ball' : 'leaf' };
  if (
    /library|lecture|auditorium|faculty|department|lab|science|study|class|theatre|school/i.test(
      name,
    )
  )
    return {
      category: 'Study',
      icon: /library/i.test(name)
        ? 'book'
        : /science|lab|chemistry/i.test(name)
          ? 'flask'
          : 'building',
    };
  return {
    category: 'Services',
    icon: /health|clinic|medical/i.test(name)
      ? 'heart'
      : /student|centre|center/i.test(name)
        ? 'people'
        : /gate|entrance/i.test(name)
          ? 'gate'
          : 'pin',
  };
}
export function validateMap(raw) {
  if (
    !raw ||
    raw.version !== 1 ||
    typeof raw.name !== 'string' ||
    !Array.isArray(raw.places) ||
    !Array.isArray(raw.edges)
  )
    throw new Error('Choose a valid UniWay map file.');
  if (
    raw.places.length > 500 ||
    (raw.junctions?.length ?? 0) > 1000 ||
    raw.edges.length > 3000 ||
    !Array.isArray(raw.images) ||
    !raw.images.length ||
    raw.images.length > 8
  )
    throw new Error('This map is too large or has no images.');
  const point = (p) =>
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 0 &&
    p.x <= 1000 &&
    p.y >= 0 &&
    p.y <= 800;
  const images = raw.images.map((i) => {
    if (
      !i ||
      typeof i.name !== 'string' ||
      typeof i.data !== 'string' ||
      !/^data:image\/(png|jpeg|webp);base64,/.test(i.data) ||
      i.data.length > 5000000
    )
      throw new Error('Map images must be PNG, JPEG, or WebP.');
    const buildings = (Array.isArray(i.buildings) ? i.buildings : [])
      .slice(0, 500)
      .filter(
        (b) =>
          point(b) &&
          Number.isFinite(b.width) &&
          Number.isFinite(b.height) &&
          b.width > 0 &&
          b.height > 0 &&
          b.x + b.width <= 1000 &&
          b.y + b.height <= 800,
      )
      .map((b) => ({
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : undefined,
      }));
    const roads = (Array.isArray(i.roads) ? i.roads : [])
      .slice(0, 1500)
      .filter((r) => Array.isArray(r) && r.length <= 200 && r.every(point))
      .map((r) => r.map((p) => ({ x: p.x, y: p.y })));
    return {
      name: i.name.slice(0, 100),
      data: i.data,
      buildings,
      roads,
      reviewed: i.reviewed === true,
      unplacedLabels: (Array.isArray(i.unplacedLabels) ? i.unplacedLabels : [])
        .slice(0, 500)
        .filter((l) => l && typeof l.name === 'string' && l.name.trim())
        .map((l) => ({
          name: l.name.slice(0, 100),
          color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : undefined,
          confidence: Number.isFinite(l.confidence)
            ? Math.max(0, Math.min(100, l.confidence))
            : undefined,
        })),
      warnings: (Array.isArray(i.warnings) ? i.warnings : [])
        .filter((w) => typeof w === 'string')
        .slice(0, 10),
    };
  });
  if (raw.junctions !== undefined && !Array.isArray(raw.junctions))
    throw new Error('Map junctions must be a list.');
  const cleanPlace = (p, junction = false) => {
    if (
      !p ||
      typeof p.id !== 'string' ||
      !p.id.trim() ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      !point(p) ||
      !Number.isInteger(p.floor) ||
      p.floor < 0 ||
      p.floor >= images.length
    )
      throw new Error('Some map places have invalid coordinates.');
    return {
      id: p.id.slice(0, 80),
      name: p.name.slice(0, 100),
      x: p.x,
      y: p.y,
      floor: p.floor,
      ...categoryFor(p.name),
      ...(junction ? { category: 'Path', icon: 'pin' } : {}),
      description:
        typeof p.description === 'string'
          ? p.description.slice(0, 400)
          : 'Detected from your layout',
      aliases: Array.isArray(p.aliases)
        ? p.aliases
            .filter((a) => typeof a === 'string')
            .slice(0, 10)
            .map((a) => a.slice(0, 80))
        : [],
      confidence: Number.isFinite(p.confidence)
        ? Math.min(100, Math.max(0, p.confidence))
        : undefined,
    };
  };
  const places = raw.places.map((p) => cleanPlace(p)),
    junctions = (raw.junctions ?? []).map((p) => cleanPlace(p, true)),
    all = [...places, ...junctions];
  const byId = new Map(all.map((p) => [p.id, p]));
  if (byId.size !== all.length) throw new Error('Map place IDs must be unique.');
  const edges = raw.edges.map((e) => {
    if (!e || !byId.has(e.a) || !byId.has(e.b) || e.a === e.b)
      throw new Error('A map path has an invalid endpoint.');
    if (byId.get(e.a).floor !== byId.get(e.b).floor)
      throw new Error('Cross-floor paths are not supported yet.');
    if (
      e.points &&
      (!Array.isArray(e.points) ||
        e.points.length < 2 ||
        e.points.length > 200 ||
        !e.points.every(point))
    )
      throw new Error('A path has invalid geometry.');
    return {
      a: e.a,
      b: e.b,
      accessible: e.accessible === true,
      confirmed: e.source === 'detected' ? e.confirmed === true : e.confirmed !== false,
      source: e.source === 'detected' ? 'detected' : 'manual',
      ...(e.points ? { points: e.points.map((p) => ({ x: p.x, y: p.y })) } : {}),
    };
  });
  return { version: 1, name: raw.name.slice(0, 100), places, edges, images, junctions };
}
