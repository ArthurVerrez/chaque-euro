import assert from "node:assert/strict";
import { test } from "node:test";
import { changeRankText, cityStats, standoutStats, statSentence } from "../src/lib/large-cities.ts";

const city = (name, debt2019, debt2025) => ({
  insee: name,
  slug: name,
  name,
  departmentCode: "00",
  population: 100000,
  values: { dette: { 2019: debt2019, 2025: debt2025 }, depenses: { 2019: 1000, 2025: 1000 } },
});
const cities = [city("A", 500, 1500), city("B", 1000, 1100), city("C", 2000, 1800)];

test("ranks a city's level and change against the other large cities", () => {
  const [debt] = cityStats(cities, cities[0]);
  assert.equal(debt.metric.item, "dette");
  assert.equal(debt.rank, 2);
  assert.equal(debt.changeRank, 1);
  assert.equal(debt.median, 1500);
  assert.equal(debt.change, 2);
});

test("leads with the most unusual figure and describes it", () => {
  const [top] = standoutStats(cityStats(cities, cities[0]), 1);
  assert.equal(top.metric.item, "dette");
  assert.match(
    statSentence(top, "Le Havre"),
    /^La dette par habitant du Havre est passée de 500\s€ à 1\s500\s€ entre 2019 et 2025/,
  );
  assert.match(
    statSentence(top, "Angers"),
    /d’Angers .* la plus forte hausse des 3 grandes villes\.$/,
  );
});

test("names a change by its sign, not only by its rank", () => {
  assert.equal(changeRankText(1, 4, 0.3), "plus forte hausse des 4 grandes villes");
  assert.equal(changeRankText(4, 4, -0.1), "plus forte baisse des 4 grandes villes");
  assert.equal(changeRankText(3, 4, 0.07), "2e évolution la plus faible des 4 grandes villes");
  assert.equal(changeRankText(2, 4, -0.02), "2e évolution la plus forte des 4 grandes villes");
});
