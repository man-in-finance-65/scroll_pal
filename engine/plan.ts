import { TOLERANCE } from "../config/nutrition.ts";
import { isPlannable, perServing, type Nutrition, type Recipe } from "./recipe.ts";
import type { Targets } from "./targets.ts";

export type Meal = { recipeId: string; servings: number };
export type WeekPlan = { days: { meals: Meal[] }[] };

export type DayCheck = Nutrition & { pass: boolean; problems: string[] };
export type Verdict = { pass: boolean; days: DayCheck[]; problems: string[] };

const round = (n: number) => Math.round(n);

// Recomputes every day's totals from confirmed recipes and checks them against the targets.
export function verifyPlan(plan: WeekPlan, recipes: Map<string, Recipe>, t: Targets, expectedDays = 7): Verdict {
  const problems: string[] = [];
  if (plan.days.length !== expectedDays) problems.push(`plan has ${plan.days.length} days, expected ${expectedDays}`);
  const days = plan.days.map((day, d) => {
    const dayProblems: string[] = [];
    let kcal = 0, proteinG = 0;
    for (const m of day.meals) {
      const r = recipes.get(m.recipeId);
      if (!r) { dayProblems.push(`unknown recipe ${m.recipeId}`); continue; }
      if (!isPlannable(r)) { dayProblems.push(`recipe ${r.title} is not confirmed`); continue; }
      if (!(m.servings > 0)) { dayProblems.push(`bad servings for ${r.title}`); continue; }
      const n = perServing(r);
      kcal += n.kcal * m.servings;
      proteinG += n.proteinG * m.servings;
    }
    if (Math.abs(kcal - t.calories) > t.calories * TOLERANCE.calorieShare)
      dayProblems.push(`day ${d + 1}: ${round(kcal)} kcal, target ${t.calories} (within ${TOLERANCE.calorieShare * 100}%)`);
    if (proteinG < t.proteinG * (1 - TOLERANCE.proteinShortfallShare))
      dayProblems.push(`day ${d + 1}: ${round(proteinG)} g protein, need at least ${round(t.proteinG * (1 - TOLERANCE.proteinShortfallShare))} g`);
    return { kcal: round(kcal), proteinG: round(proteinG), pass: dayProblems.length === 0, problems: dayProblems };
  });
  const all = problems.concat(days.flatMap((d) => d.problems));
  return { pass: all.length === 0, days, problems: all };
}

// Fewer meals a day need bigger portions to reach the target.
const servingSteps = (mealsPerDay: number) => (mealsPerDay <= 2 ? [0.5, 1, 1.5, 2, 2.5, 3] : [0.5, 1, 1.5, 2]);
const MAX_CANDIDATES = 10;

function* combos<T>(items: T[], k: number, start = 0, picked: T[] = []): Generator<T[]> {
  if (picked.length === k) { yield picked; return; }
  for (let i = start; i < items.length; i++) yield* combos(items, k, i + 1, [...picked, items[i]]);
}

function* servingVectors(k: number, steps: number[]): Generator<number[]> {
  if (k === 0) { yield []; return; }
  for (const s of steps) for (const rest of servingVectors(k - 1, steps)) yield [s, ...rest];
}

// Fallback planner: picks meals in code, no LLM. Prefers recipes used least so far for variety.
export function buildWeekInCode(recipes: Recipe[], t: Targets, mealsPerDay: number, days = 7): WeekPlan {
  const usable = recipes.filter(isPlannable);
  if (usable.length === 0) throw new Error("no confirmed recipes to plan with");
  const nutrition = new Map(usable.map((r) => [r.id, perServing(r)]));
  const used = new Map(usable.map((r) => [r.id, 0]));
  const plan: WeekPlan = { days: [] };

  for (let d = 0; d < days; d++) {
    const pool = [...usable].sort((a, b) => used.get(a.id)! - used.get(b.id)!).slice(0, MAX_CANDIDATES);
    // Too few recipes for distinct meals: repeat the pool so a day can reuse one.
    const choices = pool.length >= mealsPerDay ? pool : Array.from({ length: mealsPerDay }, (_, i) => pool[i % pool.length]);
    let best: { meals: Meal[]; score: number } | null = null;
    for (const set of combos(choices, mealsPerDay)) {
      for (const servings of servingVectors(mealsPerDay, servingSteps(mealsPerDay))) {
        let kcal = 0, protein = 0, reuse = 0;
        set.forEach((r, i) => {
          const n = nutrition.get(r.id)!;
          kcal += n.kcal * servings[i];
          protein += n.proteinG * servings[i];
          reuse += used.get(r.id)!;
        });
        // Calories inside tolerance come first (that is the deficit); protein next; variety last.
        const kcalOff = Math.abs(kcal - t.calories) / t.calories;
        const outside = Math.max(0, kcalOff - TOLERANCE.calorieShare);
        const shortfall = Math.max(0, t.proteinG - protein) / t.proteinG;
        const score = kcalOff + 20 * outside + 2 * shortfall + 0.005 * reuse;
        if (!best || score < best.score) best = { score, meals: set.map((r, i) => ({ recipeId: r.id, servings: servings[i] })) };
      }
    }
    best!.meals.forEach((m) => used.set(m.recipeId, used.get(m.recipeId)! + 1));
    plan.days.push({ meals: best!.meals });
  }
  return plan;
}

export type Proposer = (input: { recipes: Recipe[]; targets: Targets; mealsPerDay: number; feedback: string[] }) => Promise<WeekPlan>;

// The LLM proposes, code verifies. Two retries with the verifier's feedback, then the code planner.
export async function planWeek(opts: { propose: Proposer; recipes: Recipe[]; targets: Targets; mealsPerDay: number }) {
  const usable = opts.recipes.filter(isPlannable);
  const byId = new Map(usable.map((r) => [r.id, r]));
  let feedback: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const plan = await opts.propose({ recipes: usable, targets: opts.targets, mealsPerDay: opts.mealsPerDay, feedback });
      const verdict = verifyPlan(plan, byId, opts.targets);
      if (verdict.pass) return { plan, verdict, source: "llm" as const, attempts: attempt };
      feedback = verdict.problems;
    } catch (e) {
      feedback = [`proposal failed: ${String(e)}`];
    }
  }
  const plan = buildWeekInCode(usable, opts.targets, opts.mealsPerDay);
  return { plan, verdict: verifyPlan(plan, byId, opts.targets), source: "code" as const, attempts: 3 };
}
