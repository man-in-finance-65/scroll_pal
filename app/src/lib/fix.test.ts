import { describe, expect, it } from "vitest";
import { fitFor, fixMath } from "./meal";
import type { Body, Recipe, Recommendation } from "./types";

const lowProtein: Recipe = {
  title: "Veg noodles", creator: "c", cuisine: "Thai", servings: 1, ingredients: [{ name: "noodles", qty: 100, unit: "g", source: "stated" }],
  steps: ["cook"], prep_minutes: 10, cook_minutes: 10, confidence: 0.9,
  macros_per_serving: { kcal: 480, protein_g: 22, carbs_g: 50, fat_g: 16, source: "estimated" },
};
const body: Body = { heightCm: 170, weightKg: 75, targetKg: 70 }; // cut: 616 per meal

describe("Pal's fixes", () => {
  it("every check carries its number and bounds, so the server can score fixes", () => {
    const fit = fitFor(lowProtein, [], "cut", body);
    const protein = fit.verdict.rows.find((r) => r.id === "protein")!;
    expect(protein).toMatchObject({ value: 22, lo: 30, hi: null, pass: false });
    const target = fit.verdict.rows.find((r) => r.id === "target")!;
    expect(target).toMatchObject({ value: 480, lo: null, hi: 616, pass: true });
  });

  it("shows the math for what a fix adds, never rounded up", () => {
    const yogurt: Recommendation = { title: "Greek yogurt on the side", how: "170 g", kind: "side", fixes: "protein", adds: { kcal: 100, protein_g: 17, carbs_g: 6, fat_g: 0.7 }, kcal: 580, source: "estimated" };
    expect(fixMath(yogurt, lowProtein, 480)).toBe("~22 + 17 = 39 g protein · ~480 + 100 = 580 kcal");
    const lessFat: Recommendation = { title: "Use half the fat", how: "x", kind: "recipe", fixes: "fat", adds: { kcal: -54, protein_g: 0, carbs_g: 0, fat_g: -6.4 }, kcal: 426, source: "estimated" };
    expect(fixMath(lessFat, lowProtein, 480.9)).toBe("~480 minus 54 = 426 kcal · ~16 minus 6.4 = 9.6 g fat");
  });

  it("old picks without numbers still read fine", () => {
    expect(fixMath({ title: "Treat day", how: "x", kcal: null, source: "estimated" }, lowProtein, 480)).toBeNull();
  });
});
