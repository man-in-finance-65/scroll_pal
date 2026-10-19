import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NUTRITION } from "../config/nutrition.ts";
import { computeTargets, restingKcal, type Body } from "./targets.ts";
import { screen, type ScreeningAnswers } from "./screening.ts";
import { isPlannable, perServing, toGrams, type Recipe } from "./recipe.ts";
import { buildWeekInCode, planWeek, verifyPlan, type WeekPlan } from "./plan.ts";
import { shoppingList } from "./shopping.ts";

// Test fixtures only. Per-100 g values are illustrative; the app takes real values from USDA.
const ing = (name: string, grams: number, kcal: number, proteinG: number, confirmed = true) => ({ name, grams, per100g: { kcal, proteinG }, confirmed });
const RECIPES: Recipe[] = [
  { id: "bowl", title: "Chicken rice bowl", servings: 1, ingredients: [ing("chicken breast", 200, 165, 31), ing("rice", 200, 130, 2.7)] },
  { id: "oats", title: "Yogurt oats", servings: 1, ingredients: [ing("greek yogurt", 250, 59, 10), ing("oats", 80, 389, 16.9), ing("banana", 120, 89, 1.1)] },
  { id: "salmon", title: "Salmon and potatoes", servings: 1, ingredients: [ing("salmon", 180, 208, 20), ing("potato", 300, 77, 2)] },
  { id: "eggs", title: "Eggs on toast", servings: 1, ingredients: [ing("egg", 150, 143, 12.6), ing("bread", 80, 265, 9)] },
  { id: "curry", title: "Lentil curry", servings: 2, ingredients: [ing("lentils", 400, 116, 9), ing("coconut milk", 200, 230, 2.3)] },
  { id: "wrap", title: "Turkey wrap", servings: 1, ingredients: [ing("turkey", 120, 135, 24), ing("tortilla", 70, 310, 8)] },
];
const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
const MAN: Body = { sex: "male", age: 30, weightKg: 80, heightCm: 180, activity: "moderate" };
const WOMAN: Body = { sex: "female", age: 30, weightKg: 60, heightCm: 165, activity: "sedentary" };
const OK: ScreeningAnswers = { age: 30, weightKg: 80, heightCm: 180, pregnantOrBreastfeeding: false, eatingDisorderNowOrPast: false, diabetesOrGlucoseMedication: false, otherConditionNeedingSupervisedDiet: false };

// Targets
test("Mifflin-St Jeor, men: 10x80 + 6.25x180 - 5x30 + 5 = 1780", () => assert.equal(restingKcal(MAN), 1780));
test("Mifflin-St Jeor, women: 10x60 + 6.25x165 - 5x30 - 161 = 1320.25", () => assert.equal(restingKcal(WOMAN), 1320.25));
test("default plan is maintenance minus 500 kcal", () => {
  const t = computeTargets(MAN);
  assert.equal(t.maintenanceKcal, 2759); // 1780 x 1.55
  assert.equal(t.calories, 2259);
});
test("calorie floor: women never planned below 1,200", () => {
  const t = computeTargets(WOMAN); // 1320.25 x 1.2 - 500 = 1084
  assert.equal(t.calories, 1200);
  assert.equal(t.floorApplied, true);
});
test("calorie floor: men never planned below 1,500", () => {
  const t = computeTargets({ ...MAN, weightKg: 55, heightCm: 160, age: 60, activity: "sedentary" });
  assert.equal(t.calories, 1500);
});
test("loss is capped at 2 lb a week (1,000 kcal/day)", () => {
  assert.equal(computeTargets(MAN, 5).calories, computeTargets(MAN, 2).calories);
  assert.equal(computeTargets(MAN, 2).calories, 2759 - 1000);
});
test("protein: 80 kg x 1.6 = 128 g/day, 20 g per meal", () => {
  const t = computeTargets(MAN);
  assert.equal(t.proteinG, 128);
  assert.equal(t.proteinPerMealG, 20);
});
test("default protein sits inside the ISSN 1.4 to 2.0 g/kg range", () => {
  const [lo, hi] = NUTRITION.proteinRangeGPerKg.value;
  assert.ok(NUTRITION.proteinGPerKg.value >= lo && NUTRITION.proteinGPerKg.value <= hi);
});
test("under-18s get no targets", () => assert.throws(() => computeTargets({ ...MAN, age: 17 })));

// Screening
test("healthy adult is eligible", () => assert.deepEqual(screen(OK), { eligible: true }));
for (const [field, value] of [["pregnantOrBreastfeeding", true], ["eatingDisorderNowOrPast", true], ["diabetesOrGlucoseMedication", true], ["otherConditionNeedingSupervisedDiet", true], ["age", 17]] as const)
  test(`declined: ${field}`, () => assert.equal(screen({ ...OK, [field]: value }).eligible, false));
test("declined: BMI under 18.5", () => assert.equal(screen({ ...OK, weightKg: 55, heightCm: 180 }).eligible, false)); // BMI 17.0
test("screening returns only eligible, never the reason", () => assert.deepEqual(Object.keys(screen({ ...OK, pregnantOrBreastfeeding: true })), ["eligible"]));

// Recipes
test("per-serving nutrition is computed from grams", () => {
  const n = perServing(BY_ID.get("curry")!); // (464 + 460) / 2 kcal, (36 + 4.6) / 2 g
  assert.equal(Math.round(n.kcal), 462);
  assert.equal(Math.round(n.proteinG * 10), 203);
});
test("unit conversion: mass units convert, cups need a USDA portion weight", () => {
  assert.equal(toGrams(2, "kg"), 2000);
  assert.equal(toGrams(1, "cup"), null);
  assert.equal(toGrams(1, "cup", 240), 240);
});
test("a recipe with an unconfirmed ingredient can't be planned", () => {
  assert.equal(isPlannable({ ...RECIPES[0], ingredients: [ing("mystery", 10, 100, 1, false)] }), false);
});

// Verifier
const dayOf = (meals: [string, number][]): { meals: { recipeId: string; servings: number }[] } => ({ meals: meals.map(([recipeId, servings]) => ({ recipeId, servings })) });
test("verifier passes a week inside tolerance", () => {
  const t = computeTargets(MAN);
  const plan = buildWeekInCode(RECIPES, t, 3);
  const v = verifyPlan(plan, BY_ID, t);
  assert.equal(v.pass, true, v.problems.join("; "));
});
test("verifier fails a day more than 5% off the calorie target", () => {
  const t = computeTargets(MAN);
  const plan: WeekPlan = { days: Array(7).fill(dayOf([["eggs", 1]])) };
  assert.equal(verifyPlan(plan, BY_ID, t).pass, false);
});
test("verifier fails low protein even when calories match", () => {
  const t = { ...computeTargets(MAN), calories: 2000, proteinG: 200 };
  const plan: WeekPlan = { days: Array(7).fill(dayOf([["curry", 2], ["oats", 1], ["eggs", 1]])) }; // ~2000 kcal, ~107 g
  const v = verifyPlan(plan, BY_ID, t);
  assert.equal(v.pass, false);
  assert.ok(v.problems.some((p) => p.includes("protein")));
});
test("verifier rejects recipes it doesn't know", () => {
  const t = computeTargets(MAN);
  const plan: WeekPlan = { days: Array(7).fill(dayOf([["invented", 3]])) };
  assert.ok(verifyPlan(plan, BY_ID, t).problems.some((p) => p.includes("unknown recipe")));
});

// Planner and LLM loop
test("code planner hits the floor-level target for a smaller woman", () => {
  const t = { ...computeTargets(WOMAN), proteinG: 96 };
  const v = verifyPlan(buildWeekInCode(RECIPES, t, 3), BY_ID, t);
  assert.equal(v.pass, true, v.problems.join("; "));
});
test("code planner never uses unconfirmed recipes", () => {
  const bad: Recipe = { id: "bad", title: "Unconfirmed", servings: 1, ingredients: [ing("x", 500, 300, 40, false)] };
  const plan = buildWeekInCode([...RECIPES, bad], computeTargets(MAN), 3);
  assert.ok(plan.days.every((d) => d.meals.every((m) => m.recipeId !== "bad")));
});
test("LLM plan that verifies is used on the first try", async () => {
  const t = computeTargets(MAN);
  const good = buildWeekInCode(RECIPES, t, 3);
  const r = await planWeek({ propose: async () => good, recipes: RECIPES, targets: t, mealsPerDay: 3 });
  assert.equal(r.source, "llm");
  assert.equal(r.attempts, 1);
});
test("LLM gets the verifier's feedback and two retries", async () => {
  const t = computeTargets(MAN);
  const good = buildWeekInCode(RECIPES, t, 3);
  const seen: string[][] = [];
  const r = await planWeek({
    propose: async ({ feedback }) => { seen.push(feedback); return seen.length < 3 ? { days: [] } : good; },
    recipes: RECIPES, targets: t, mealsPerDay: 3,
  });
  assert.equal(r.source, "llm");
  assert.equal(r.attempts, 3);
  assert.ok(seen[1].length > 0);
});
test("after 3 failed proposals the code planner takes over", async () => {
  const t = computeTargets(MAN);
  let calls = 0;
  const r = await planWeek({ propose: async () => { calls++; throw new Error("timeout"); }, recipes: RECIPES, targets: t, mealsPerDay: 3 });
  assert.equal(calls, 3);
  assert.equal(r.source, "code");
  assert.equal(r.verdict.pass, true);
});

// Shopping list and sources
test("shopping list scales ingredients by servings eaten", () => {
  const plan: WeekPlan = { days: [dayOf([["curry", 1], ["bowl", 2]])] };
  const list = new Map(shoppingList(plan, BY_ID).map((i) => [i.name, i.grams]));
  assert.equal(list.get("lentils"), 200); // 400 g makes 2 servings
  assert.equal(list.get("chicken breast"), 400);
});
test("every number in config/nutrition.ts cites a source in evidence/pack.json", () => {
  const ids = new Set(JSON.parse(readFileSync("evidence/pack.json", "utf8")).sources.map((s: { id: string }) => s.id));
  for (const [key, { source }] of Object.entries(NUTRITION)) assert.ok(ids.has(source), `${key} cites missing source ${source}`);
});
