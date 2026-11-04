import assert from "node:assert/strict";
import { test } from "node:test";
import { communeCode, constituencyAt } from "../src/lib/constituencies.ts";

const square = (x, y, size) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];
const shapes = [
  {
    constituency: 1,
    geometry: { type: "Polygon", coordinates: [square(2, 48, 0.1), square(2.04, 48.04, 0.02)] },
  },
  {
    constituency: 2,
    geometry: { type: "MultiPolygon", coordinates: [[square(2.1, 48, 0.1)], [square(3, 49, 0.1)]] },
  },
];

test("finds one constituency, preserves holes and disjoint islands", () => {
  assert.equal(constituencyAt([2.02, 48.02], shapes), 1);
  assert.equal(constituencyAt([2.15, 48.05], shapes), 2);
  assert.equal(constituencyAt([3.05, 49.05], shapes), 2);
  assert.equal(constituencyAt([2.05, 48.05], shapes), null);
  assert.equal(constituencyAt([4, 50], shapes), null);
});

test("refuses boundaries, points within 200 metres, overlaps and missing polygons", () => {
  assert.equal(constituencyAt([2.1, 48.05], shapes), null);
  assert.equal(constituencyAt([2.099, 48.05], shapes), null);
  assert.equal(constituencyAt([2.101, 48.05], shapes), null);
  assert.equal(constituencyAt([2.039, 48.05], shapes), null);
  assert.equal(constituencyAt([2.096, 48.02], shapes), 1);
  assert.equal(constituencyAt([2.02, 48.02], [...shapes, { ...shapes[0], constituency: 3 }]), null);
  assert.equal(constituencyAt([2.02, 48.02], []), null);
  assert.equal(constituencyAt([NaN, 48], shapes), null);
});

test("maps municipal arrondissement codes without confusing other communes", () => {
  assert.equal(communeCode("75112"), "75056");
  assert.equal(communeCode("69383"), "69123");
  assert.equal(communeCode("13209"), "13055");
  assert.equal(communeCode("01001"), "01001");
  assert.equal(communeCode("97411"), "97411");
});
