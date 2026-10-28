import { describe, expect, it } from "vitest";
import { fitFor } from "./meal";
import type { Body, Recipe, Swap } from "./types";

const base: Recipe = {
  title: "x", creator: "c", cuisine: "Home", servings: 1, ingredients: [{ name: "stuff", qty: 1, unit: "", source: "stated" }],
  steps: ["cook"], prep_minutes: 10, cook_minutes: 12, confidence: 0.9,
  macros_per_serving: { kcal: 640, protein_g: 46, carbs_g: 72, fat_g: 17, source: "estimated" },
};
const smores: Recipe = { ...base, title: "S'mores cookie", macros_per_serving: { kcal: 920, protein_g: 8, carbs_g: 120, fat_g: 42, source: "estimated" } };
const body: Body = { heightCm: 170, weightKg: 75, targetKg: 70 }; // cut: 75 × 30 = 2250 − 400 = 1850 a day, 616 per meal
const swap = (kcal_saved: number): Swap => ({ from: "stuff", to: "lighter stuff", why: "lighter", kcal_saved, source: "estimated" });

describe("does the meal fit the goal?", () => {
  it("a s'mores cookie does NOT fit a cut, even with swaps", () => {
    const fit = fitFor(smores, [swap(150)], "cut", body);
    expect(fit.level).toBe("off");
    expect(fit.kcal).toBe(770);
    expect(fit.over).toBe(154); // 770 − 616
    expect(fit.misses.length).toBeGreaterThanOrEqual(3);
  });

  it("no swaps does not mean it fits", () => {
    expect(fitFor(smores, [], "cut", body).level).toBe("off");
  });

  it("the gochujang bowl fits a cut once swaps take 130 kcal off", () => {
    const fit = fitFor(base, [swap(130)], "cut", body);
    expect(fit.kcal).toBe(510);
    expect(fit.level).toBe("good");
  });

  it("the same bowl without swaps is too much for a cut (640 vs 616)", () => {
    const fit = fitFor(base, [], "cut", body);
    expect(fit.level).not.toBe("good");
    expect(fit.misses.join(" ")).toMatch(/Energy|meal target/);
  });

  it("uses plain words with no dashes", () => {
    const fit = fitFor(smores, [], "cut", body);
    expect(fit.misses.join(" ")).not.toMatch(/[–—]/);
    expect(fit.verdict.rows.map((r) => r.rule).join(" ")).not.toMatch(/[–—]/);
  });

  it("a big dish suits a bulk", () => {
    const big: Recipe = { ...base, macros_per_serving: { kcal: 800, protein_g: 55, carbs_g: 90, fat_g: 25, source: "estimated" } };
    expect(fitFor(big, [], "bulk", { heightCm: 180, weightKg: 80, targetKg: 85 }).level).toBe("good");
  });

  it("offers half a serving only when half would fit", () => {
    expect(fitFor({ ...base, macros_per_serving: { ...base.macros_per_serving, kcal: 1000 } }, [], "cut", body).halfFits).toBe(true);
    expect(fitFor(smores, [], "cut", { heightCm: 170, weightKg: 50, targetKg: 48 }).halfFits).toBe(false);
  });
});
