import { num } from "./format";
import type { Goal, Recipe } from "./types";

// How Pal judges a recipe against your goal. Plain rules on the numbers per serving, so the verdict is never a mystery.
export type Criterion = {
  id: string;
  label: string; // what is being checked
  rule: string; // the rule in words
  check: (r: Recipe) => { pass: boolean; math: string };
};

const m = (r: Recipe) => r.macros_per_serving;
const kcal = (r: Recipe) => m(r).kcal;
// Protein per 100 kcal: how "protein-dense" a meal is.
const density = (r: Recipe) => (kcal(r) > 0 ? (m(r).protein_g * 100) / kcal(r) : 0);
const minutes = (r: Recipe) => r.prep_minutes + r.cook_minutes;

const range = (id: string, label: string, lo: number, hi: number): Criterion => ({
  id, label, rule: `${lo} to ${hi} kcal per serving`,
  check: (r) => ({ pass: kcal(r) >= lo && kcal(r) <= hi, math: `${num(kcal(r), 0)} kcal vs ${lo} to ${hi}` }),
});
const protein = (min: number): Criterion => ({
  id: "protein", label: "Protein", rule: `At least ${min} g protein per serving`,
  check: (r) => ({ pass: m(r).protein_g >= min, math: `${num(m(r).protein_g)} g vs ${min} g` }),
});
const dense = (min: number): Criterion => ({
  id: "density", label: "Protein density", rule: `At least ${min} g protein per 100 kcal`,
  check: (r) => ({ pass: density(r) >= min, math: `${num(m(r).protein_g)} g ÷ ${num(kcal(r), 0)} kcal × 100 = ${num(density(r))} g per 100 kcal` }),
});
const time = (max: number): Criterion => ({
  id: "time", label: "Time", rule: `Ready in ${max} minutes or less`,
  check: (r) => ({ pass: minutes(r) <= max, math: `${num(r.prep_minutes, 0)} prep + ${num(r.cook_minutes, 0)} cook = ${num(minutes(r), 0)} min vs ${max}` }),
});
const fat = (max: number): Criterion => ({
  id: "fat", label: "Fat", rule: `No more than ${max} g fat per serving`,
  check: (r) => ({ pass: m(r).fat_g <= max, math: `${num(m(r).fat_g)} g vs ${max} g` }),
});
const carbs = (min: number): Criterion => ({
  id: "carbs", label: "Carbs for fuel", rule: `At least ${min} g carbs per serving`,
  check: (r) => ({ pass: m(r).carbs_g >= min, math: `${num(m(r).carbs_g)} g vs ${min} g` }),
});

export const GOAL_CRITERIA: Record<Goal, { title: string; blurb: string; criteria: Criterion[] }> = {
  bulk: {
    title: "Bulk",
    blurb: "You want to build. Pal likes big, protein-rich plates with plenty of fuel.",
    criteria: [range("kcal", "Energy", 600, 1000), protein(35), carbs(60), time(60)],
  },
  maintain: {
    title: "Maintain",
    blurb: "You want balance. Pal likes a normal portion with a solid dose of protein.",
    criteria: [range("kcal", "Energy", 450, 700), protein(25), dense(4), time(60)],
  },
  cut: {
    title: "Cut",
    blurb: "You want lean. Pal likes lighter plates that still keep protein high.",
    criteria: [range("kcal", "Energy", 250, 550), protein(30), dense(6), fat(20), time(45)],
  },
};

export type Verdict = { passed: number; total: number; rows: { label: string; rule: string; pass: boolean; math: string }[]; estimated: boolean };

export function judge(recipe: Recipe, goal: Goal): Verdict {
  const rows = GOAL_CRITERIA[goal].criteria.map((c) => ({ label: c.label, rule: c.rule, ...c.check(recipe) }));
  return { passed: rows.filter((r) => r.pass).length, total: rows.length, rows, estimated: recipe.macros_per_serving.source === "estimated" };
}
