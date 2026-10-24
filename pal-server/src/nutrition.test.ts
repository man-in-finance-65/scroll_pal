import assert from "node:assert/strict";
import { test } from "node:test";
import { gramsFor, perPortion, resolveLine, sumLines, swapDelta, trunc1, type UsdaFood } from "./nutrition.js";

const food = (per100g: UsdaFood["per100g"], portions: UsdaFood["portions"] = []): UsdaFood => ({
  fdcId: 1, description: "x", per100g, portions,
});

// Fixed fixture: 100 g thigh = 209 kcal / 26 P / 0 C / 10.9 F; 100 g breast = 120 kcal / 22.5 P / 0 C / 2.6 F
const THIGH = food({ calories: 209, protein_g: 26, carbs_g: 0, fat_g: 10.9 });
const BREAST = food({ calories: 120, protein_g: 22.5, carbs_g: 0, fat_g: 2.6 }, [{ label: "cup", amount: 1, gramWeight: 140 }]);
const lookup = (m: Record<string, UsdaFood>) => async (n: string) => m[n] ?? null;

test("delta math with a fixed fixture (per portion, truncated)", async () => {
  const orig = await resolveLine({ name: "thigh", quantity: 400, unit: "g" }, lookup({ thigh: THIGH }));
  const repl = await resolveLine({ name: "breast", quantity: 400, unit: "g" }, lookup({ breast: BREAST }));
  // 400 g thigh = 836 kcal, 104 P, 0 C, 43.6 F ; 400 g breast = 480 kcal, 90 P, 0 C, 10.4 F
  assert.deepEqual(swapDelta(orig, repl, 2), { calories: -178, protein_g: -7, carbs_g: 0, fat_g: -16.6 });
});

test("volume units convert through USDA portion data", () => {
  const r = gramsFor({ quantity: 0.5, unit: "cup" }, BREAST);
  assert.ok("grams" in r && Math.abs(r.grams - 70) < 1e-9);
  const tbsp = gramsFor({ quantity: 2, unit: "tbsp" }, BREAST); // 2 tbsp = 29.5736 ml of a cup=140 g (236.588 ml)
  assert.ok("grams" in tbsp && Math.abs(tbsp.grams - 140 * (29.5736 / 236.588)) < 1e-6);
});

test("unconvertible unit is unmatched, not guessed", async () => {
  const line = await resolveLine({ name: "breast", quantity: 1, unit: "pinch" }, lookup({ breast: BREAST }));
  assert.equal(line.status, "unmatched");
});

test("USDA-unmatched ingredient is excluded from totals", async () => {
  const l = lookup({ thigh: THIGH });
  const lines = [
    await resolveLine({ name: "thigh", quantity: 200, unit: "g" }, l),
    await resolveLine({ name: "mystery sauce", quantity: 100, unit: "g" }, l),
  ];
  assert.equal(lines[1].status, "unmatched");
  assert.deepEqual(sumLines(lines), { calories: 418, protein_g: 52, carbs_g: 0, fat_g: 21.8 });
  assert.deepEqual(perPortion(sumLines(lines), 2), { calories: 209, protein_g: 26, carbs_g: 0, fat_g: 10.9 });
});

test("a swap with an unmatched side has no delta", async () => {
  const o = await resolveLine({ name: "thigh", quantity: 100, unit: "g" }, lookup({ thigh: THIGH }));
  const u = await resolveLine({ name: "nope", quantity: 100, unit: "g" }, lookup({}));
  assert.equal(swapDelta(o, u, 1), null);
});

test("trunc1 never rounds up", () => {
  assert.equal(trunc1(1.99), 1.9);
  assert.equal(trunc1(-1.99), -1.9);
  assert.equal(trunc1(0.3), 0.3);
});

test("count with no unit uses the name's last word as the USDA portion (4 garlic cloves)", () => {
  const GARLIC = food({ calories: 149, protein_g: 6.4, carbs_g: 33, fat_g: 0.5 }, [
    { label: "cup", amount: 1, gramWeight: 136 },
    { label: "clove", amount: 1, gramWeight: 3 },
  ]);
  const r = gramsFor({ name: "garlic cloves", quantity: 4, unit: "" }, GARLIC);
  assert.ok("grams" in r && r.grams === 12);
});
