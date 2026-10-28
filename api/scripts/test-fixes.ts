// Asks the real AI for Pal's fixes on dishes that miss a goal, and checks them (real Claude/Gemini, a fraction of a cent).
// Usage:  npm run test:fixes
import { breaksDiet } from "../src/diet.js";
import { recommendFor, scoreFix, type Check } from "../src/kitchen.js";
import type { Recipe } from "../src/schema.js";

const dish = (title: string, kcal: number, protein_g: number, carbs_g: number, fat_g: number, ingredients: string[]): Recipe => ({
  title, creator: "test", cuisine: "Home-style", servings: 2, steps: ["cook"], prep_minutes: 10, cook_minutes: 15, confidence: 0.9,
  ingredients: ingredients.map((name) => ({ name, qty: null, unit: "", source: "stated" as const })),
  macros_per_serving: { kcal, protein_g, carbs_g, fat_g, source: "estimated" },
});
const C = (id: string, label: string, value: number, lo: number | null, hi: number | null): Check =>
  ({ id, label, value, lo, hi, pass: (lo === null || value >= lo) && (hi === null || value <= hi) });

const cases = [
  { name: "cut, low protein", goal: "cut" as const, diet: [] as string[], r: dish("Garlic butter noodles", 480, 14, 62, 18, ["noodles", "butter", "garlic", "parmesan"]) },
  { name: "cut, low protein, vegan", goal: "cut" as const, diet: ["vegan"], r: dish("Peanut veggie stir fry", 470, 13, 58, 19, ["rice noodles", "broccoli", "peanut sauce", "carrot"]) },
  { name: "cut, too big", goal: "cut" as const, diet: [], r: dish("Creamy chicken alfredo", 890, 42, 70, 48, ["fettuccine", "chicken breast", "heavy cream", "parmesan", "butter"]) },
  { name: "bulk, too small", goal: "bulk" as const, diet: ["no_dairy"], r: dish("Chicken salad", 420, 30, 15, 22, ["chicken breast", "lettuce", "olive oil", "tomato"]) },
];


let bad = 0;
for (const c of cases) {
  const m = c.r.macros_per_serving;
  const checks: Check[] = c.goal === "cut"
    ? [C("kcal", "Energy", m.kcal, 250, 550), C("protein", "Protein", m.protein_g, 30, null), C("density", "Protein density", (m.protein_g * 100) / m.kcal, 6, null), C("fat", "Fat", m.fat_g, null, 20), C("target", "Your meal target", m.kcal, null, 616)]
    : [C("kcal", "Energy", m.kcal, 600, 1000), C("protein", "Protein", m.protein_g, 35, null), C("carbs", "Carbs for fuel", m.carbs_g, 60, null), C("target", "Your meal target", m.kcal, 560, null)];
  const t0 = Date.now();
  const out = await recommendFor(c.r, c.goal, null, m.kcal, checks.filter((x) => !x.pass).map((x) => x.label), checks, c.diet);
  console.log(`\n== ${c.name} (${c.r.title}) misses ${checks.filter((x) => !x.pass).map((x) => x.id).join(", ")} | by ${out.planner} in ${((Date.now() - t0) / 1000).toFixed(1)}s${out.note ? ` | ${out.note}` : ""}`);
  for (const x of out.recommendations) {
    const s = scoreFix({ kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g }, x.adds, checks);
    const diet = breaksDiet(`${x.title} ${x.how}`, c.diet);
    console.log(`  [${x.kind}] ${x.title}: ${x.how}`);
    console.log(`     fixes ${x.fixes} | adds ${x.adds.protein_g} g protein, ${x.adds.kcal} kcal, ${x.adds.carbs_g} g carbs, ${x.adds.fat_g} g fat | score ${s.score.toFixed(2)} fixed [${s.fixed}] broke [${s.broke}]`);
    if (diet || s.score <= 0 || /[-–—]/.test(x.title + x.how)) { bad++; console.log(`     BAD: ${diet ? "breaks " + diet : s.score <= 0 ? "does not help" : "has a dash"}`); }
  }
  if (!out.recommendations.length) { bad++; console.log("  BAD: no fixes"); }
  if (out.planner === "built-in" || out.planner === "mock") console.log("  (no AI answered; this run did not test the AI)");
}
process.exit(bad ? 1 : 0);
