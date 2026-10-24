import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeName, normalizePantryList } from "./pantry.js";

test("pantry names are normalized to plain recipe names", () => {
  assert.equal(normalizeName("Extra Virgin Olive Oil"), "olive oil");
  assert.equal(normalizeName("Kosher Salt"), "salt");
  assert.equal(normalizeName("ground black pepper"), "pepper");
  assert.equal(normalizeName("2 Garlic Bulbs"), "garlic");
  assert.equal(normalizeName("Soy Sauce (low sodium)"), "soy sauce");
  assert.equal(normalizeName("Tomatoes"), "tomato");
  assert.equal(normalizeName("dried oregano"), "oregano");
  assert.equal(normalizeName("hummus"), "hummus");
});

test("pantry list is de-duplicated, sorted, empties dropped", () => {
  assert.deepEqual(normalizePantryList(["Salt", "sea salt", "Paprika", "", "123"]), ["paprika", "salt"]);
});

test("pantry list rejects non-string input loudly", () => {
  assert.throws(() => normalizePantryList("salt"), /expected a list of ingredient names, got "salt"/);
  assert.throws(() => normalizePantryList([1]), /expected a list/);
});
