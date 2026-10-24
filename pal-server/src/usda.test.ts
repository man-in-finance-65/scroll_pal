import assert from "node:assert/strict";
import { test } from "node:test";
import { createUsda } from "./usda.js";

const n = (number: string, amount: number) => ({ nutrient: { number }, amount });
test("USDA lookup skips hits missing a macro (Foundation meat without carbs) and uses the next one", async () => {
  const fake = (async (url: string) => {
    if (url.includes("/foods/search")) {
      return Response.json({
        foods: [
          { fdcId: 1, foodNutrients: [{ nutrientNumber: "203", value: 22 }, { nutrientNumber: "204", value: 2 }, { nutrientNumber: "957", value: 110 }] },
          { fdcId: 2, foodNutrients: ["203", "204", "205", "208"].map((nutrientNumber) => ({ nutrientNumber, value: 1 })) },
        ],
      });
    }
    assert.match(url, /\/food\/2\?/);
    return Response.json({ fdcId: 2, description: "Chicken, broilers or fryers, breast, raw", foodNutrients: [n("208", 120), n("203", 22.5), n("204", 2.6), n("205", 0)] });
  }) as typeof fetch;
  const food = await createUsda("k", fake)("chicken breast");
  assert.deepEqual(food?.per100g, { calories: 120, protein_g: 22.5, carbs_g: 0, fat_g: 2.6 });
});
