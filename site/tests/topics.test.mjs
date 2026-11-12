import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSearch } from "../src/lib/topics.ts";

test("folds case, accents, punctuation and ligatures", () => {
  assert.equal(normalizeSearch("Restos du cœur"), "restos du coeur");
  assert.equal(normalizeSearch("Sacré-Cœur"), "sacre coeur");
  assert.equal(normalizeSearch("ŒUILLY"), "oeuilly");
  assert.equal(normalizeSearch("Lætitia"), "laetitia");
  assert.equal(normalizeSearch("L'Haÿ-les-Roses"), "l hay les roses");
});
