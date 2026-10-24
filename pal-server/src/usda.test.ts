import assert from "node:assert/strict";
import { test } from "node:test";
import { createUsda } from "./usda.js";

const n = (number: string, amount: number) => ({ nutrient: { number }, amount });
const all4 = ["203", "204", "205", "208"].map((nutrientNumber) => ({ nutrientNumber, value: 1 }));

function fakeUsda(calls: string[]) {
  return (async (url: string) => {
    calls.push(url.replace(/\?.*/, ""));
    if (url.includes("/foods/search")) {
      if (url.includes("query=pasta+water")) return Response.json({ foods: [{ fdcId: 9, description: "Pasta, dry", foodNutrients: all4 }] });
      return Response.json({
        foods: [
          { fdcId: 1, description: "Chicken, breast, raw (Foundation, no carbs row)", foodNutrients: all4.slice(0, 2).concat(all4[3]) },
          { fdcId: 2, description: "Chicken, broilers or fryers, breast, meat and skin, cooked, fried, batter", foodNutrients: all4 },
          { fdcId: 3, description: "Chicken, broilers or fryers, breast, meat only, raw", foodNutrients: all4 },
        ],
      });
    }
    assert.match(url, /\/food\/3\?/);
    return Response.json({ fdcId: 3, description: "Chicken, breast, meat only, raw", foodNutrients: [n("208", 120), n("203", 22.5), n("204", 2.6), n("205", 0)] });
  }) as typeof fetch;
}

test("USDA: only candidates with all four macros are offered, the picked one is used, null pick = unmatched", async () => {
  const calls: string[] = [];
  let offered: any;
  const usda = createUsda("k", async (items) => {
    offered = items;
    return { picks: [{ name: "chicken breast", fdc_id: 3 }, { name: "pasta water", fdc_id: null }] };
  }, fakeUsda(calls));
  const m = await usda(["chicken breast", "pasta water"]);
  assert.deepEqual(offered[0].candidates.map((c: any) => c.fdcId), [2, 3]);
  assert.deepEqual(m.get("chicken breast")?.per100g, { calories: 120, protein_g: 22.5, carbs_g: 0, fat_g: 2.6 });
  assert.equal(m.get("pasta water"), null);
  await usda(["Chicken Breast"]); // cached: no new USDA calls
  assert.equal(calls.length, 3);
});

test("USDA: a picked id that was never offered is not trusted", async () => {
  const usda = createUsda("k", async () => ({ picks: [{ name: "chicken breast", fdc_id: 999 }] }), fakeUsda([]));
  assert.equal((await usda(["chicken breast"])).get("chicken breast"), null);
});
