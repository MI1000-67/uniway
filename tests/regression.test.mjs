import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findRoute,
  findAlternatives,
  routePoints,
  remainingTime,
  validateMap,
} from '../src/engine.mjs';
import { analyzeRaster, skeletonize, traceGraph } from '../src/import/vision.mjs';
const nodes = [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 3, y: 0 },
  { id: 'c', x: 3, y: 4 },
  { id: 'd', x: 0, y: 4 },
];
const edges = [
  { a: 'a', b: 'c', accessible: false },
  { a: 'a', b: 'b', accessible: true },
  { a: 'b', b: 'c', accessible: true },
  { a: 'a', b: 'd', accessible: true },
  { a: 'd', b: 'c', accessible: true },
];
test('alternatives are ranked, distinct, loop-free and respect step-free filtering', () => {
  const routes = findAlternatives(nodes, edges, 'a', 'c');
  assert.deepEqual(
    routes.map((r) => r.distance),
    [5, 7, 7],
  );
  for (const r of routes) assert.equal(new Set(r.path).size, r.path.length);
  assert.equal(new Set(routes.map((r) => r.path.join('|'))).size, 3);
  assert.deepEqual(
    findAlternatives(nodes, edges, 'a', 'c', true).map((r) => r.distance),
    [7, 7],
  );
});
test('detected paths cannot provide walking directions until confirmed', () => {
  const pending = edges.map((e) => ({ ...e, confirmed: false }));
  assert.equal(findRoute(nodes, pending, 'a', 'c'), null);
  assert.equal(findAlternatives(nodes, pending, 'a', 'c', false, true).length, 3);
});
test('curved paths use polyline length and reverse geometry correctly', () => {
  const e = [
    {
      a: 'a',
      b: 'c',
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 4 },
        { x: 3, y: 4 },
      ],
      confirmed: true,
    },
  ];
  const r = findAlternatives(nodes, e, 'c', 'a')[0];
  assert.equal(r.distance, 7);
  assert.deepEqual(routePoints(r, nodes, e), [
    { x: 3, y: 4 },
    { x: 0, y: 4 },
    { x: 0, y: 0 },
  ]);
});
test('invalid expiry values display zero remaining seconds', () =>
  assert.equal(remainingTime(undefined), 0));
const map = {
  version: 1,
  name: 'Example',
  images: [{ name: 'Ground', data: 'data:image/png;base64,AAAA' }],
  places: [
    { id: 'a', name: 'Library', x: 0, y: 0, floor: 0 },
    { id: 'b', name: 'Cafe', x: 100, y: 100, floor: 0 },
  ],
  edges: [{ a: 'a', b: 'b', source: 'detected' }],
};
test('missing review flags on detected imported paths fail closed', () =>
  assert.equal(validateMap(map).edges[0].confirmed, false));
test('blank names, blank identifiers and malformed junction lists are rejected', () => {
  assert.throws(() =>
    validateMap({ ...map, places: [{ ...map.places[0], id: ' ' }, map.places[1]] }),
  );
  assert.throws(() =>
    validateMap({ ...map, places: [{ ...map.places[0], name: ' ' }, map.places[1]] }),
  );
  assert.throws(() => validateMap({ ...map, junctions: {} }));
});
test('a blank floorplan never invents a path through open white space', () => {
  const pixels = new Uint8ClampedArray(80 * 60 * 4).fill(255);
  const r = analyzeRaster({ pixels, width: 80, height: 60, lines: [] });
  assert.equal(r.edges.length, 0);
  assert.equal(r.places.length, 0);
  assert.ok(r.warnings.some((w) => w.includes('No distinct path network')));
});
test('road geometry detection preserves a connected line and marks it unreviewed', () => {
  const width = 80,
    height = 60,
    mask = new Uint8Array(width * height);
  for (let x = 10; x < 70; x++) for (let y = 28; y < 33; y++) mask[y * width + x] = 1;
  const graph = traceGraph(skeletonize(mask, width, height), width, height, (x, y) => ({ x, y }));
  assert.ok(graph.edges.length > 0);
  assert.ok(graph.edges.every((e) => e.confirmed === false && e.accessible === false));
});
test('label recognition places named destinations on the correct image', () => {
  const width = 80,
    height = 60,
    pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const r = analyzeRaster({
    pixels,
    width,
    height,
    floor: 1,
    lines: [{ text: 'Library', confidence: 95, x: 10, y: 20, width: 20, height: 5 }],
  });
  assert.equal(r.places[0].name, 'Library');
  assert.equal(r.places[0].floor, 1);
  assert.equal(r.edges.length, 0);
});
import { matchesPlace } from '../src/search.mjs';
test('search tolerates accents, a one-letter typo and published aliases', () => {
  const place = { name: 'The Commons Café', description: '', aliases: ['canteen'] };
  assert.equal(matchesPlace(place, 'cafe'), true);
  assert.equal(matchesPlace(place, 'canteeen'), true);
  assert.equal(matchesPlace({ name: 'Central Library' }, 'libary'), true);
  assert.equal(matchesPlace(place, 'laboratory'), false);
});
