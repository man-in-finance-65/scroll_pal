// Nutrition for a recipe, computed from ingredient grams and per-100 g values (from USDA).
// An LLM never supplies these numbers.

export type Per100g = { kcal: number; proteinG: number };
export type ResolvedIngredient = { name: string; grams: number; per100g: Per100g; confirmed: boolean };
export type Recipe = { id: string; title: string; servings: number; ingredients: ResolvedIngredient[] };
export type Nutrition = { kcal: number; proteinG: number };

// Only confirmed recipes may be planned: every ingredient confirmed by the user and matched to a USDA food.
export function isPlannable(r: Recipe): boolean {
  return r.servings > 0 && r.ingredients.length > 0 && r.ingredients.every((i) => i.confirmed);
}

export function perServing(r: Recipe): Nutrition {
  if (r.servings <= 0) throw new Error(`recipe ${r.id} has no servings`);
  const total = r.ingredients.reduce(
    (t, i) => ({ kcal: t.kcal + (i.grams * i.per100g.kcal) / 100, proteinG: t.proteinG + (i.grams * i.per100g.proteinG) / 100 }),
    { kcal: 0, proteinG: 0 },
  );
  return { kcal: total.kcal / r.servings, proteinG: total.proteinG / r.servings };
}

// Mass units only. Cups and spoons need a USDA portion weight for that food, passed as gramsPerUnit.
const GRAMS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, oz: 28.3495, lb: 453.592 };

export function toGrams(qty: number, unit: string, gramsPerUnit?: number): number | null {
  const u = unit.trim().toLowerCase();
  if (u in GRAMS) return qty * GRAMS[u];
  return gramsPerUnit !== undefined ? qty * gramsPerUnit : null;
}
