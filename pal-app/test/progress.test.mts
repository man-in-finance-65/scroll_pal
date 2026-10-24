import assert from "node:assert/strict";
import { test } from "node:test";
import { badges, creatorStamps, levelInfo, xpForCook } from "../src/lib/progress.ts";
import type { Cook, Dish } from "../src/lib/types.ts";

const dish = (over: Partial<Dish> = {}): Dish => ({
  recipeId: "r", version: "original", goal: null, title: "T",
  creator: { handle: "@chef", platform: "tiktok", avatar_url: "", video_url: "https://x" },
  ingredients: [], instructions: [{ step_number: 1, text: "Dice the onion and whisk the sauce", video_timestamp_sec: null, chef_tip: null }],
  macros: { calories: 500, protein_g: 45, carbs_g: 40, fat_g: 10 }, totalMin: 15, swapsOn: [], ...over,
});

test("XP per PRD: 50 + 20 if protein >= a third of the daily target + 10 for zero waste", () => {
  assert.deepEqual(xpForCook(dish(), { calories: 2000, protein_g: 120 }, true), { base: 50, protein: 20, noWaste: 10 });
  assert.deepEqual(xpForCook(dish(), { calories: 2000, protein_g: 150 }, false), { base: 50, protein: 0, noWaste: 0 });
});

test("level curve: L -> L+1 costs 100 + 25(L-1)", () => {
  assert.deepEqual(levelInfo(0), { level: 1, into: 0, need: 100, floor: 0 });
  assert.equal(levelInfo(99).level, 1);
  assert.equal(levelInfo(100).level, 2);
  assert.equal(levelInfo(225).level, 3);
  assert.equal(levelInfo(34_300).level, 50);
  assert.equal(levelInfo(10_000_000).level, 50);
});

test("badges and stamps count real cooks", () => {
  const cooks: Cook[] = [1, 2, 3].map((i) => ({ at: i, dish: dish(), xp: { base: 50, protein: 0, noWaste: 0 } }));
  const b = Object.fromEntries(badges(cooks).map((x) => [x.id, x.have]));
  assert.equal(b.knife1, 3); assert.equal(b.sauce, 3); assert.equal(b.macro, 3); assert.equal(b.speed, 3);
  assert.deepEqual(creatorStamps(cooks), [{ handle: "@chef", cooked: 3, tier: 3, next: 10 }]);
});
