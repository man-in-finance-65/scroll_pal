import { dayLabel, slotLabel } from "../components/PlanPicker";
import { normalizeName } from "./pantry";
import type { Plan } from "./store";
import { SLOTS } from "./types";

/** Ingredients used by 2+ planned meals this week: buy them once. Same unit adds up; mixed units are listed as they are. */
export function sharedIngredients(plan: Plan, days: string[]) {
  const by = new Map<string, { name: string; uses: { where: string; qty: number; unit: string }[]; meals: Set<string> }>();
  for (const day of days) {
    for (const slot of SLOTS) {
      const dish = plan[day]?.[slot];
      if (!dish) continue;
      const where = `${dayLabel(day).split(",")[0]} ${slotLabel[slot].toLowerCase()}`;
      for (const i of dish.ingredients) {
        const k = normalizeName(i.name);
        const e = by.get(k) ?? { name: i.name, uses: [], meals: new Set<string>() };
        e.meals.add(where);
        e.uses.push({ where, qty: i.quantity, unit: i.unit });
        by.set(k, e);
      }
    }
  }
  // Only ingredients shared by different meals; a recipe listing parmesan twice is still one meal.
  return [...by.values()].filter((e) => e.meals.size > 1);
}

