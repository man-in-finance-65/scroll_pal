import { test } from "node:test";
import assert from "node:assert/strict";
import { score, scoreFilter, type ReelResult } from "./score.ts";

const reel = (over: Partial<ReelResult> = {}): ReelResult => ({
  url: "u",
  ok: true,
  seconds: 30,
  costUsd: 0.01,
  recipe: {
    is_recipe: true,
    title: "t",
    steps: ["s"],
    ingredients: [
      { name: "egg", qty: 2, unit: null, estimate: false },
      { name: "salt", qty: null, unit: null, estimate: true },
    ],
  },
  ...over,
});

test("7 good reels out of 10 pass", () => {
  const results = [...Array(7)].map(() => reel()).concat([...Array(3)].map(() => reel({ ok: false, recipe: null })));
  assert.equal(score(results).pass, true);
});

test("6 recipes out of 10 fail", () => {
  const results = [...Array(6)].map(() => reel()).concat([...Array(4)].map(() => reel({ recipe: null })));
  assert.equal(score(results).checks.recipes.pass, false);
});

test("unquantified, unflagged ingredients fail the 80% rule", () => {
  const bad = reel();
  bad.recipe!.ingredients = [{ name: "oil", qty: null, unit: null, estimate: false }];
  const results = [...Array(10)].map(() => bad);
  assert.equal(score(results).checks.quantities.pass, false);
});

test("a reel over 90 seconds fails speed", () => {
  const results = [...Array(9)].map(() => reel()).concat([reel({ seconds: 91 })]);
  assert.equal(score(results).checks.speed.pass, false);
});

test("missing cost fails cost logging", () => {
  const results = [...Array(10)].map(() => reel({ costUsd: null }));
  assert.equal(score(results).checks.costLogged.pass, false);
});

test("filter test passes when no non-food reel is called a recipe", () => {
  const notFood = reel({ recipe: { is_recipe: false, title: "", steps: [], ingredients: [] } });
  assert.equal(scoreFilter([notFood, notFood]).pass, true);
  assert.equal(scoreFilter([notFood, reel()]).pass, false);
});
