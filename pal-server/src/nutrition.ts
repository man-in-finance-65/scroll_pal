import type { Ingredient, Macros } from "./schema.js";

/** One portion row from USDA, e.g. "1 cup = 238 g". */
export type Portion = { label: string; amount: number; gramWeight: number };
export type UsdaFood = { fdcId: number; description: string; per100g: Macros; portions: Portion[] };
export type UsdaLookup = (name: string) => Promise<UsdaFood | null>;

export type Line =
  | { name: string; status: "matched"; grams: number; macros: Macros }
  | { name: string; status: "unmatched"; reason: string };

export const ZERO: Macros = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
const KEYS = ["calories", "protein_g", "carbs_g", "fat_g"] as const;

/** Truncate toward zero to 1 decimal. We never round a number up. */
export const trunc1 = (n: number) => Math.trunc(n * 10 + 1e-9 * Math.sign(n)) / 10;
export const truncMacros = (m: Macros): Macros => ({
  calories: trunc1(m.calories),
  protein_g: trunc1(m.protein_g),
  carbs_g: trunc1(m.carbs_g),
  fat_g: trunc1(m.fat_g),
});
export const addMacros = (a: Macros, b: Macros): Macros => ({
  calories: a.calories + b.calories,
  protein_g: a.protein_g + b.protein_g,
  carbs_g: a.carbs_g + b.carbs_g,
  fat_g: a.fat_g + b.fat_g,
});
export const subMacros = (a: Macros, b: Macros): Macros => ({
  calories: a.calories - b.calories,
  protein_g: a.protein_g - b.protein_g,
  carbs_g: a.carbs_g - b.carbs_g,
  fat_g: a.fat_g - b.fat_g,
});
const scale = (m: Macros, f: number): Macros => Object.fromEntries(KEYS.map((k) => [k, m[k] * f])) as Macros;

/** Sum of matched lines only. Unmatched ones are excluded, never guessed. */
export function sumLines(lines: Line[]): Macros {
  return lines.reduce((acc, l) => (l.status === "matched" ? addMacros(acc, l.macros) : acc), ZERO);
}
export const perPortion = (total: Macros, portions: number): Macros => scale(total, 1 / portions);

/** Macros change of replacing `orig` with `repl`, per portion. null when either side has no USDA data. */
export function swapDelta(orig: Line, repl: Line, portions: number): Macros | null {
  if (orig.status !== "matched" || repl.status !== "matched") return null;
  return truncMacros(perPortion(subMacros(repl.macros, orig.macros), portions));
}

// ---- quantity -> grams ----

const MASS_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};
const VOLUME_ML: Record<string, number> = {
  ml: 1, l: 1000, liter: 1000, litre: 1000, tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868, cup: 236.588, cups: 236.588,
  "fl oz": 29.5735,
};
const GENERIC_COUNT = new Set(["", "piece", "pieces", "whole", "each", "item", "items", "unit", "large", "medium", "small"]);

/** Which volume unit does a USDA portion label describe? Returns ml per 1 unit, or null. */
function labelVolumeMl(label: string): number | null {
  const l = label.toLowerCase();
  if (/\bfl\.? ?oz\b|fluid ounce/.test(l)) return VOLUME_ML["fl oz"];
  if (/\btbsp\b|tablespoon/.test(l)) return VOLUME_ML.tbsp;
  if (/\btsp\b|teaspoon/.test(l)) return VOLUME_ML.tsp;
  if (/\bcup\b/.test(l)) return VOLUME_ML.cup;
  return null;
}
const isMassLabel = (label: string) => /\b(g|gram|grams|oz|ounce|lb)\b/i.test(label) && labelVolumeMl(label) === null;

/** Grams for an ingredient line using USDA's own portion data. null = cannot convert honestly. */
export function gramsFor(ing: Pick<Ingredient, "quantity" | "unit">, food: UsdaFood): { grams: number } | { reason: string } {
  const unit = ing.unit.trim().toLowerCase();
  if (unit in MASS_G) return { grams: ing.quantity * MASS_G[unit] };

  if (unit in VOLUME_ML) {
    const ml = ing.quantity * VOLUME_ML[unit];
    for (const p of food.portions) {
      const mlPer = labelVolumeMl(p.label);
      if (mlPer && p.amount > 0) return { grams: ml * (p.gramWeight / (p.amount * mlPer)) };
    }
    return { reason: `USDA has no volume portion for "${food.description}"` };
  }

  const counts = food.portions.filter((p) => labelVolumeMl(p.label) === null && !isMassLabel(p.label) && p.amount > 0);
  const singular = unit.replace(/s$/, "");
  const named = counts.find((p) => singular && p.label.toLowerCase().includes(singular));
  const pick = named ?? (GENERIC_COUNT.has(unit) ? counts[0] : undefined);
  if (!pick) return { reason: `no USDA portion for unit "${ing.unit}" on "${food.description}"` };
  return { grams: ing.quantity * (pick.gramWeight / pick.amount) };
}

export async function resolveLine(ing: Pick<Ingredient, "name" | "quantity" | "unit">, lookup: UsdaLookup): Promise<Line> {
  let food: UsdaFood | null;
  try {
    food = await lookup(ing.name);
  } catch (e) {
    return { name: ing.name, status: "unmatched", reason: `USDA lookup failed: ${(e as Error).message}` };
  }
  if (!food) return { name: ing.name, status: "unmatched", reason: "no USDA match" };
  const g = gramsFor(ing, food);
  if ("reason" in g) return { name: ing.name, status: "unmatched", reason: g.reason };
  return { name: ing.name, status: "matched", grams: g.grams, macros: scale(food.per100g, g.grams / 100) };
}
