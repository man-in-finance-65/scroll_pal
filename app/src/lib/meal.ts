import { num } from "./format";
import { judge, type Verdict } from "./goals";
import type { Body, Goal, Pact, Plan, PlanSlot, Recipe, Recommendation, Swap } from "./types";
import { localDay } from "./xp";

// Your energy target per meal, from your body and goal. A simple rule of thumb, so it is marked "~" everywhere:
// about 30 kcal per kg keeps a body as it is; a cut takes 400 off, a bulk adds 300; split over 3 meals.
const KCAL_PER_KG = 30;
const GOAL_SHIFT: Record<Goal, number> = { cut: -400, maintain: 0, bulk: 300 };

export function mealTarget(body: Body | null, goal: Goal): { perMeal: number; perDay: number; math: string } | null {
  if (!body) return null;
  const base = body.weightKg * KCAL_PER_KG;
  const shift = GOAL_SHIFT[goal];
  const perDay = Math.floor(base + shift);
  const perMeal = Math.floor(perDay / 3);
  const shiftText = shift < 0 ? ` minus ${-shift} for your cut` : shift > 0 ? ` plus ${shift} for your bulk` : "";
  return { perDay, perMeal, math: `${num(body.weightKg)} kg × ${KCAL_PER_KG} = ${Math.floor(base)}${shiftText} = ${perDay} a day, ÷ 3 meals = ${perMeal} per meal` };
}

// The ingredient list after Pal's swaps.
export function swappedIngredients(recipe: Recipe, swaps: Swap[]): string[] {
  const map = new Map(swaps.map((s) => [s.from.toLowerCase(), s.to]));
  return recipe.ingredients.map((i) => map.get(i.name.toLowerCase()) ?? i.name);
}

// What to search for in a shop. Rule swaps can be a portion ("Half the cheese"); the shop needs just the item.
export const shopName = (name: string) => name.replace(/^(half( the)?|1\.5× the)\s+/i, "");

export function kcalAfterSwaps(recipe: Recipe, swaps: Swap[]): number {
  return Math.max(0, recipe.macros_per_serving.kcal - swaps.reduce((a, s) => a + s.kcal_saved, 0));
}

// "This week" for the Kitchen Pact: Monday to Sunday, phone time.
export function mondayOf(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d.toISOString());
}

// A Kitchen Pact plan: N cooks spread evenly over the next 7 days, each one of your recipes (round robin).
// Slots without a recipe yet get one as soon as you feed Pal a link.
export function pactPlan(pact: Pact, recipes: Recipe[], goal: Goal, now = new Date()): Plan {
  const n = Math.max(1, Math.min(7, pact.meals));
  const slots: PlanSlot[] = Array.from({ length: n }, (_, i) => {
    const offset = Math.floor((i * 7) / n);
    const date = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12).toISOString());
    const r = recipes.length ? recipes[i % recipes.length] : undefined;
    return { id: `pact-${i}-${Date.now().toString(36)}`, day: offset + 1, date, slot: "dinner", meal: r?.title ?? "", kind: "cook", note: "", status: "planned", recipeTitle: r?.title };
  });
  return { id: Date.now().toString(36), createdAt: now.toISOString(), goal, days: 7, summary: `${n} meals this week`, recipe: recipes[0], slots, confirmed: true };
}

// Adds a recipe (and the fixes you picked) to the plan: the first open night without a recipe, else one more night
// after the last. No plan this week: a new plan with just this meal, tonight.
export function planWith(plan: Plan | null, recipe: Recipe, tweaks: Recommendation[], goal: Goal, now = new Date()): Plan {
  const fill = { recipeTitle: recipe.title, meal: recipe.title, tweaks };
  const open = plan?.slots.find((x) => x.status === "planned" && !x.recipeTitle);
  if (plan && open) return { ...plan, slots: plan.slots.map((x) => (x.id === open.id ? { ...x, ...fill } : x)) };
  const last = plan?.slots[plan.slots.length - 1];
  const [y, m, d] = last ? last.date.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1, now.getDate() - 1];
  const date = localDay(new Date(y, m - 1, d + 1, 12).toISOString());
  const slot: PlanSlot = { id: `add-${Date.now().toString(36)}`, day: (last?.day ?? 0) + 1, date, slot: "dinner", kind: "cook", note: "", status: "planned", ...fill };
  if (plan) return { ...plan, slots: [...plan.slots, slot] };
  return { id: Date.now().toString(36), createdAt: now.toISOString(), goal, days: 7, summary: "1 meal this week", recipe, slots: [slot], confirmed: true };
}

// Gives empty pact slots a recipe. Returns the same plan if nothing changed.
export function fillPlan(plan: Plan, recipes: Recipe[]): Plan {
  if (!recipes.length || plan.slots.every((s) => s.recipeTitle)) return plan;
  let k = 0;
  const slots = plan.slots.map((s) => {
    if (s.recipeTitle || s.status !== "planned") return s;
    const r = recipes[k++ % recipes.length];
    return { ...s, recipeTitle: r.title, meal: r.title };
  });
  return { ...plan, slots, recipe: plan.recipe ?? recipes[0] };
}

// Every Instagram post or reel link in a "Download your information" file (JSON or HTML), no repeats.
export function instagramLinks(text: string): string[] {
  const found = text.match(/https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+/g) ?? [];
  const clean = found.map((u) => u.replace(/^http:/, "https:").replace("://instagram", "://www.instagram").replace("/reels/", "/reel/"));
  return [...new Set(clean)];
}

// A CSV file split into rows of cells. Handles quoted cells that hold commas, quotes and line breaks (captions do).
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const FOOD_WORDS = /recipe|cook|bake|baking|dinner|lunch|breakfast|meal|snack|dessert|ingredient|tbsp|tsp|cup|grams|protein|chicken|beef|pork|steak|salmon|fish|shrimp|egg|rice|pasta|noodle|soup|salad|bowl|cookie|cake|bread|pizza|burger|taco|sauce|dough|roast|fry|grill|air fryer|oven|vegan|healthy|kcal|calorie|macros|crispy|cheese|chocolate|oats|smoothie|yogurt/i;

export type Save = { url: string; caption: string };

// What to feed Pal from a saves file. Instagram's JSON export is just links. A CSV with columns like
// creator, post_url, caption, bucket (some tools export saves this way) gets the food saves only, newest first,
// each with its caption, so Pal can read the recipe even when Instagram won't show its page.
export function instagramSaves(text: string): { saves: Save[]; total: number; kind: "csv" | "links" } {
  const rows = csvRows(text);
  const head = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (name: string) => head.indexOf(name);
  if (col("post_url") < 0) {
    const links = instagramLinks(text);
    return { saves: links.map((url) => ({ url, caption: "" })), total: links.length, kind: "links" };
  }
  const [u, c, b, d, h] = [col("post_url"), col("caption"), col("bucket"), col("posted_date"), col("hashtags")];
  const all = rows.slice(1).filter((r) => /instagram\.com\//.test(r[u] ?? ""));
  const caption = (r: Row) => (c >= 0 ? r[c] ?? "" : "");
  type Row = string[];
  // Food: the file's own food bucket when it has one (then double checked by the words in the caption), else the words alone.
  const inBucket = b >= 0 ? all.filter((r) => /food|recipe|cook/i.test(r[b] ?? "")) : all;
  const wordy = (r: Row) => FOOD_WORDS.test(`${caption(r)} ${h >= 0 ? r[h] ?? "" : ""}`);
  let food = inBucket.filter(wordy);
  if (!food.length) food = inBucket.length ? inBucket : all.filter(wordy);
  food.sort((x, y) => (d >= 0 ? (y[d] ?? "").localeCompare(x[d] ?? "") : 0));
  const seen = new Set<string>();
  const saves = food.flatMap((r) => {
    const url = r[u].trim().replace(/^http:/, "https:");
    if (seen.has(url)) return [];
    seen.add(url);
    return [{ url, caption: caption(r).trim().slice(0, 1800) }];
  });
  return { saves, total: all.length, kind: "csv" };
}

// Does this meal, after Pal's swaps, really fit your goal? Decided by plain rules on the numbers (lib/goals.ts),
// never by the AI, so a s'mores cookie can't get a pass. The meal target from your body is one more check.
//   good = every check passes, close = one misses, off = two or more miss.
export type Fit = { level: "good" | "close" | "off"; verdict: Verdict; misses: string[]; kcal: number; target: number | null; over: number; halfFits: boolean };

export function fitFor(recipe: Recipe, swaps: Swap[], goal: Goal, body: Body | null): Fit {
  const kcal = kcalAfterSwaps(recipe, swaps);
  const after: Recipe = { ...recipe, macros_per_serving: { ...recipe.macros_per_serving, kcal } };
  const verdict = judge(after, goal);
  const aim = mealTarget(body, goal);
  const target = aim?.perMeal ?? null;
  if (target !== null) {
    // Cut or maintain: stay at or under your target. Bulk: don't fall far short of it.
    const pass = goal === "bulk" ? kcal >= target * 0.8 : kcal <= target;
    const math = goal === "bulk" ? `${num(kcal, 0)} kcal vs at least ${num(target * 0.8, 0)}` : `${num(kcal, 0)} kcal vs your ${target} per meal`;
    verdict.rows.push({ id: "target", label: "Your meal target", rule: "Fits the meal size I worked out for you", pass, math, value: kcal, lo: goal === "bulk" ? Math.floor(target * 0.8) : null, hi: goal === "bulk" ? null : target });
    verdict.total++;
    if (pass) verdict.passed++;
  }
  const misses = verdict.rows.filter((r) => !r.pass).map((r) => `${r.label}: ${r.math}`);
  const level = misses.length === 0 ? "good" : misses.length === 1 ? "close" : "off";
  const limit = target ?? (goal === "cut" ? 550 : Infinity);
  return { level, verdict, misses, kcal, target, over: target !== null && kcal > target ? kcal - target : 0, halfFits: goal !== "bulk" && kcal > limit && Math.floor(kcal / 2) <= limit };
}


// What one of Pal's fixes changes, with the math, per serving: "~22 g + 17 g = 39 g protein · ~480 + 100 = 580 kcal".
// Protein and energy always; carbs or fat too when that is the check the fix targets. Never rounded up.
export function fixMath(x: Recommendation, recipe: Recipe, kcalNow: number): string | null {
  const a = x.adds;
  if (!a || (a.kcal === 0 && a.protein_g === 0 && a.carbs_g === 0 && a.fat_g === 0)) return null;
  const m = recipe.macros_per_serving;
  const line = (before: number, add: number, unit: string, what: string, d = 1) =>
    `~${num(before, d)} ${add < 0 ? "minus" : "+"} ${num(Math.abs(add), d)} = ${num(before + add, d)}${unit} ${what}`;
  const parts = [];
  if (a.protein_g !== 0) parts.push(line(m.protein_g, a.protein_g, " g", "protein"));
  parts.push(line(kcalNow, a.kcal, "", "kcal", 0));
  if (x.fixes === "carbs" && a.carbs_g !== 0) parts.push(line(m.carbs_g, a.carbs_g, " g", "carbs"));
  if (x.fixes === "fat" && a.fat_g !== 0) parts.push(line(m.fat_g, a.fat_g, " g", "fat"));
  return parts.join(" · ");
}
