import test from 'node:test';
import assert from 'node:assert/strict';
import { findRoute, isExpired, remainingTime, SESSION_MS, validateMap } from '../src/engine.mjs';
const nodes = [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 3, y: 0 },
  { id: 'c', x: 3, y: 4 },
  { id: 'd', x: 0, y: 4 },
];
const edges = [
  { a: 'a', b: 'b', accessible: true },
  { a: 'b', b: 'c', accessible: true },
  { a: 'a', b: 'c', accessible: false },
  { a: 'a', b: 'd', accessible: true },
  { a: 'd', b: 'c', accessible: true },
];
test('shortest path selects the direct five-unit route', () => {
  assert.deepEqual(findRoute(nodes, edges, 'a', 'c'), { path: ['a', 'c'], distance: 5 });
});
test('step-free routing excludes the shorter stair connection', () => {
  const r = findRoute(nodes, edges, 'a', 'c', true);
  assert.equal(r.distance, 7);
  assert.equal(r.path.length, 3);
});
test('routes work in both directions', () => {
  assert.deepEqual(findRoute(nodes, edges, 'c', 'a'), { path: ['c', 'a'], distance: 5 });
});
test('unreachable and missing destinations return no route', () => {
  assert.equal(findRoute(nodes, [], 'a', 'c'), null);
  assert.equal(findRoute(nodes, edges, 'a', 'missing'), null);
});
test('a destination that is the starting point has zero distance', () => {
  assert.deepEqual(findRoute(nodes, edges, 'a', 'a'), { path: ['a'], distance: 0 });
});
test('three-hour expiry uses absolute elapsed time, including sleeping tabs', () => {
  const expires = 1000 + SESSION_MS;
  assert.equal(remainingTime(expires, 1000), 10800);
  assert.equal(isExpired(expires, expires - 1), false);
  assert.equal(isExpired(expires, expires), true);
  assert.equal(remainingTime(expires, expires + 100000), 0);
  assert.equal(isExpired(undefined), true);
});
const map = {
  version: 1,
  name: 'Example campus',
  images: [{ name: 'Ground', data: 'data:image/png;base64,aGVsbG8=' }],
  places: [
    { id: 'a', name: 'A', x: 0, y: 0, floor: 0 },
    { id: 'b', name: 'B', x: 100, y: 100, floor: 0 },
  ],
  edges: [{ a: 'a', b: 'b', accessible: true }],
};
test('valid map is sanitized without trusting unrecognized fields', () => {
  const result = validateMap({ ...map, trackingUrl: 'https://example.org' });
  assert.equal(result.name, map.name);
  assert.equal(result.edges[0].accessible, true);
  assert.equal(result.trackingUrl, undefined);
});
test('import refuses remote image URLs and SVG image payloads', () => {
  assert.throws(() =>
    validateMap({ ...map, images: [{ name: 'X', data: 'https://example.org/track' }] }),
  );
  assert.throws(() =>
    validateMap({ ...map, images: [{ name: 'X', data: 'data:image/svg+xml;base64,AAAA' }] }),
  );
});
test('import refuses invalid coordinates, duplicate IDs and orphan edges', () => {
  assert.throws(() => validateMap({ ...map, places: [{ ...map.places[0], x: NaN }] }));
  assert.throws(() => validateMap({ ...map, places: [map.places[0], map.places[0]] }));
  assert.throws(() => validateMap({ ...map, edges: [{ a: 'a', b: 'x' }] }));
});
test('cross-image paths are rejected instead of producing misleading routes', () => {
  assert.throws(() =>
    validateMap({
      ...map,
      images: [...map.images, ...map.images],
      places: [map.places[0], { ...map.places[1], floor: 1 }],
    }),
  );
});
