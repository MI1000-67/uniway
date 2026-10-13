import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRaster } from '../src/import/vision.mjs';
import { movePlace } from '../src/editMap.mjs';
import { validateMap, findRoute, routePoints } from '../src/engine.mjs';
function fixture(shared = false) {
  const width = 400,
    height = 300,
    pixels = new Uint8ClampedArray(width * height * 4).fill(255),
    lines = [];
  const colors = [
    [240, 80, 90],
    [45, 150, 90],
    [80, 120, 230],
    [210, 150, 40],
    [150, 60, 180],
  ];
  if (shared) colors[1] = colors[0];
  const fill = (x, y, w, h, color) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) pixels.set([...color, 255], (yy * width + xx) * 4);
  };
  for (let i = 0; i < 5; i++) {
    fill(300, 80 + i * 30, 8, 8, colors[i]);
    fill(30 + i * 40, 100, 22, 22, colors[i]);
    lines.push({
      text: `L${i} - Library ${i}`,
      confidence: 92,
      x: 312,
      y: 80 + i * 30,
      width: 80,
      height: 8,
    });
  }
  // A grey scale bar in the legend column must not become a walkway.
  fill(370, 25, 8, 45, [160, 160, 160]);
  // An inset black frame and white space must not become a route either.
  fill(10, 10, 380, 1, [0, 0, 0]);
  fill(10, 289, 380, 1, [0, 0, 0]);
  fill(10, 10, 1, 280, [0, 0, 0]);
  fill(389, 10, 1, 280, [0, 0, 0]);
  return { pixels, width, height, lines };
}
test('legend labels map to matching buildings, preserving letterbox alignment', () => {
  const result = analyzeRaster(fixture());
  assert.equal(result.places.length, 5);
  assert.equal(result.unplacedLabels.length, 0);
  assert.equal(result.places[0].name, 'Library 0');
  assert.equal(result.places[0].x, 102.5);
  assert.equal(result.places[0].y, 302.5);
  assert.equal(result.edges.length, 0);
});
test('shared legend colours keep both names for manual placement', () => {
  const result = analyzeRaster(fixture(true));
  assert.equal(result.places.length, 3);
  assert.deepEqual(
    result.unplacedLabels.map((l) => l.name),
    ['Library 0', 'Library 1'],
  );
  assert.equal(result.edges.length, 0);
});
const campus = {
  version: 1,
  name: 'Test',
  images: [
    {
      name: 'Ground',
      data: 'data:image/png;base64,AAAA',
      reviewed: true,
      unplacedLabels: [{ name: 'Library', color: '#ff0033', confidence: 81 }],
    },
  ],
  places: [
    { id: 'a', name: 'Library', x: 100, y: 100, floor: 0 },
    { id: 'b', name: 'Cafe', x: 200, y: 200, floor: 0 },
  ],
  edges: [
    {
      a: 'a',
      b: 'b',
      source: 'manual',
      confirmed: true,
      accessible: true,
      points: [
        { x: 100, y: 100 },
        { x: 100, y: 200 },
        { x: 200, y: 200 },
      ],
    },
  ],
};
test('moving a pin preserves bends but invalidates attached path and accessibility review', () => {
  const moved = movePlace(campus, 'a', { x: 120, y: 110 });
  assert.equal(moved.images[0].reviewed, false);
  assert.equal(moved.edges[0].confirmed, false);
  assert.equal(moved.edges[0].accessible, false);
  assert.deepEqual(moved.edges[0].points, [
    { x: 120, y: 110 },
    { x: 100, y: 200 },
    { x: 200, y: 200 },
  ]);
  assert.equal(findRoute(moved.places, moved.edges, 'a', 'b'), null);
  assert.equal(campus.images[0].reviewed, true);
});
test('unplaced labels and bent walkways survive export validation', () => {
  const restored = validateMap(campus);
  assert.deepEqual(restored.images[0].unplacedLabels, campus.images[0].unplacedLabels);
  const route = findRoute(restored.places, restored.edges, 'a', 'b', false, { details: true });
  assert.equal(route.distance, 200);
  assert.deepEqual(routePoints(route, restored.places, restored.edges), campus.edges[0].points);
});
test('invalid move coordinates leave the campus unchanged', () => {
  assert.equal(movePlace(campus, 'a', { x: Infinity, y: 0 }), campus);
  assert.equal(movePlace(campus, 'a', { x: -1, y: 0 }), campus);
});
