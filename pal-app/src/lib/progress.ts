import type { Cook, Dish, Targets } from "./types";

// ---- XP (exactly the PRD: +50 per dish, +20 protein goal hit, +10 zero food waste) ----

export const XP = { dish: 50, protein: 20, noWaste: 10 } as const;

/** The protein goal for one meal: a third of the daily target (3 meals a day). */
export const mealProteinTarget = (t: Targets) => Math.floor(t.protein_g / 3);

export function xpForCook(dish: Dish, targets: Targets, noWaste: boolean): Cook["xp"] {
  return {
    base: XP.dish,
    protein: dish.macros.protein_g >= mealProteinTarget(targets) ? XP.protein : 0,
    noWaste: noWaste ? XP.noWaste : 0,
  };
}
export const cookXp = (c: Cook) => c.xp.base + c.xp.protein + c.xp.noWaste;
export const totalXp = (cooks: Cook[]) => cooks.reduce((n, c) => n + cookXp(c), 0);

// ---- Levels 1-50. Going from level L to L+1 costs 100 + 25 x (L - 1) XP:
// level 2 at 100 XP (2 dishes), level 3 at 225, level 10 at 1,800, level 50 at 34,300.
export const MAX_LEVEL = 50;
export const xpToNext = (level: number) => 100 + 25 * (level - 1);

export function levelInfo(xp: number) {
  let level = 1;
  let floor = 0;
  while (level < MAX_LEVEL && xp >= floor + xpToNext(level)) {
    floor += xpToNext(level);
    level++;
  }
  const need = level < MAX_LEVEL ? xpToNext(level) : 0;
  return { level, into: xp - floor, need, floor };
}

// ---- Skill tree: unlock rules read the recipes you actually cooked ----

const words = (d: Dish) => d.instructions.map((s) => s.text.toLowerCase()).join(" ");
const KNIFE = /\b(chop|chopped|dice|diced|mince|minced|slice|sliced|julienne|cube|cubed|finely cut)\b/;
const SAUCE = /\b(sauce|emulsif\w*|whisk\w*|vinaigrette|mayo\w*|aioli|roux|reduce|reduction|gravy|dressing)\b/;
/** "High protein" = at least 30% of the dish's calories come from protein (4 kcal per gram). */
export const isHighProtein = (d: Dish) => d.macros.calories > 0 && (d.macros.protein_g * 4) / d.macros.calories >= 0.3;
const isQuick = (d: Dish) => d.totalMin > 0 && d.totalMin < 20;

export type Badge = { id: string; name: string; rule: string; have: number; need: number };

export function badges(cooks: Cook[]): Badge[] {
  const count = (f: (d: Dish) => boolean) => cooks.filter((c) => f(c.dish)).length;
  const knife = count((d) => KNIFE.test(words(d)));
  return [
    { id: "knife1", name: "Knife Skills I", rule: "Cook 3 dishes with chopping, dicing, mincing or slicing", have: knife, need: 3 },
    { id: "knife2", name: "Knife Skills II", rule: "Cook 10 dishes with knife work", have: knife, need: 10 },
    { id: "knife3", name: "Knife Skills III", rule: "Cook 25 dishes with knife work", have: knife, need: 25 },
    { id: "sauce", name: "Sauce & Emulsion Master", rule: "Cook 10 dishes where you make a sauce, dressing or emulsion", have: count((d) => SAUCE.test(words(d))), need: 10 },
    { id: "macro", name: "Macro Alchemist", rule: "Cook 50 high-protein dishes (30%+ of calories from protein)", have: count(isHighProtein), need: 50 },
    { id: "speed", name: "Speed Cooker", rule: "Cook 10 dishes that take under 20 minutes", have: count(isQuick), need: 10 },
  ];
}

// ---- Creator stamps: one stamp per creator at 1, 3 and 10 of their recipes cooked ----

export const STAMP_TIERS = [1, 3, 10] as const;

export function creatorStamps(cooks: Cook[]) {
  const by = new Map<string, number>();
  for (const c of cooks) by.set(c.dish.creator.handle, (by.get(c.dish.creator.handle) ?? 0) + 1);
  return [...by.entries()]
    .map(([handle, n]) => ({ handle, cooked: n, tier: STAMP_TIERS.filter((t) => n >= t).pop() ?? 0, next: STAMP_TIERS.find((t) => n < t) ?? null }))
    .sort((a, b) => b.cooked - a.cooked);
}
