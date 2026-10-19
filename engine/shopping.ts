import type { Recipe } from "./recipe.ts";
import type { WeekPlan } from "./plan.ts";

// Adds up every ingredient across the week, scaled by servings eaten.
export function shoppingList(plan: WeekPlan, recipes: Map<string, Recipe>): { name: string; grams: number }[] {
  const totals = new Map<string, number>();
  for (const day of plan.days)
    for (const m of day.meals) {
      const r = recipes.get(m.recipeId);
      if (!r) continue;
      for (const i of r.ingredients) {
        const key = i.name.trim().toLowerCase();
        totals.set(key, (totals.get(key) ?? 0) + (i.grams * m.servings) / r.servings);
      }
    }
  return [...totals].map(([name, grams]) => ({ name, grams: Math.round(grams) })).sort((a, b) => a.name.localeCompare(b.name));
}
