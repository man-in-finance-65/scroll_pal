// The kitchen half of Pal: goal swaps and reading a pantry photo.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { breaksDiet, dietWords } from "./diet.js";
import { Recommendation, type Recipe, Swap } from "./schema.js";

type Goal = "bulk" | "cut" | "maintain";
type SwapT = z.infer<typeof Swap>;
export class KitchenError extends Error {
  constructor(public status: number, public code: string, message: string, public detail?: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mock = () => process.env.MOCK_AI === "1";
const clean = (e: unknown) =>
  String((e as Error)?.message ?? e).replace(/sk-[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}/g, "***").replace(/\s+/g, " ").slice(0, 160);

// ---------- Swaps ----------

const SwapList = z.object({ swaps: z.array(Swap).max(4) });

function swapPrompt(recipe: Recipe, goal: Goal, mealKcal: number | null, diet: string[]) {
  const aim =
    goal === "cut" ? "make it lighter while keeping protein high" : goal === "bulk" ? "add energy and protein for building muscle" : "make it a little healthier without changing the dish";
  return (
    `Suggest up to 3 ingredient swaps to ${aim}. The dish must still taste like itself.\n` +
    `Recipe: ${recipe.title}, serves ${recipe.servings}, about ${recipe.macros_per_serving.kcal} kcal per serving.` +
    (mealKcal ? ` The eater's target is about ${mealKcal} kcal per meal.` : "") +
    `\nIngredients: ${recipe.ingredients.map((i) => `${i.name} (${i.qty ?? "?"} ${i.unit})`).join("; ")}\n` +
    (diet.length ? `The user NEVER eats: ${dietWords(diet)}. Never swap in anything that breaks this.\n` : "") +
    `Rules: "from" must be copied exactly from the ingredient names above. "why" under 50 characters, no hyphens or dashes. ` +
    `kcal_saved is the change per serving (positive = fewer kcal, negative = more kcal). source is "estimated" unless the creator stated it.`
  );
}

// Plain rules for when no AI is set up. Rough per serving numbers, so they are all marked estimated.
const RULES: { match: RegExp; to: string; why: string; kcal: number; goals: Goal[] }[] = [
  { match: /heavy cream|double cream|whipping cream/i, to: "Greek yogurt (0%)", why: "Same creaminess, more protein", kcal: 180, goals: ["cut", "maintain"] },
  { match: /sour cream|cr[eè]me fra[iî]che|mayo/i, to: "Greek yogurt", why: "Tangy and light", kcal: 90, goals: ["cut", "maintain"] },
  { match: /\bbutter\b|ghee/i, to: "Olive oil spray", why: "A mist does the same job", kcal: 90, goals: ["cut"] },
  { match: /white rice|cooked rice|basmati|jasmine rice/i, to: "Half cauliflower rice", why: "Half the carbs, same bowl", kcal: 100, goals: ["cut"] },
  { match: /white rice|cooked rice|basmati|jasmine rice/i, to: "Brown rice", why: "More fibre, keeps you full", kcal: 0, goals: ["maintain"] },
  { match: /\bpasta\b|spaghetti|penne/i, to: "Whole wheat pasta", why: "More fibre and protein", kcal: 20, goals: ["cut", "maintain"] },
  { match: /\bsugar\b|\bhoney\b|maple syrup/i, to: "Half the sweetener", why: "Still sweet, less sugar", kcal: 30, goals: ["cut", "maintain"] },
  { match: /cheddar|mozzarella|parmesan|cheese/i, to: "Half the cheese", why: "Flavour stays, fat drops", kcal: 60, goals: ["cut"] },
  { match: /chicken breast/i, to: "Chicken thighs", why: "Juicier, more energy", kcal: -60, goals: ["bulk"] },
  { match: /white rice|cooked rice|basmati|jasmine rice/i, to: "1.5× the rice", why: "More fuel for training", kcal: -110, goals: ["bulk"] },
  { match: /yogurt/i, to: "Full fat Greek yogurt", why: "Extra protein and energy", kcal: -50, goals: ["bulk"] },
];

export function ruleSwaps(recipe: Recipe, goal: Goal, diet: string[] = []): SwapT[] {
  const out: SwapT[] = [];
  for (const i of recipe.ingredients) {
    const rule = RULES.find((r) => r.goals.includes(goal) && r.match.test(i.name) && !breaksDiet(r.to, diet));
    if (rule && !out.some((s) => s.from === i.name)) out.push({ from: i.name, to: rule.to, why: rule.why, kcal_saved: rule.kcal, source: "estimated" });
    if (out.length === 3) break;
  }
  return out;
}

let anthropic: Anthropic | null = null;
let gemini: GoogleGenAI | null = null;
const geminiClient = () => (gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
const geminiSchema = (schema: z.ZodType) => {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
};

// 1) Claude, 2) Gemini, 3) plain rules. Whoever answers first wins, so swaps never fail.
export async function swapsFor(recipe: Recipe, goal: Goal, mealKcal: number | null, diet: string[] = []): Promise<{ swaps: SwapT[]; planner: string; note?: string }> {
  // Only keep swaps of ingredients that are really in the recipe, into something the user eats.
  const names = new Set(recipe.ingredients.map((i) => i.name));
  const valid = (list: SwapT[]) => list.filter((s) => names.has(s.from) && !breaksDiet(s.to, diet)).slice(0, 3);
  if (mock()) {
    await sleep(600);
    return { swaps: ruleSwaps(recipe, goal, diet), planner: "mock" };
  }
  const tried: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const msg = await (anthropic ??= new Anthropic()).messages.parse({
        model: process.env.CLAUDE_MODEL || "claude-haiku-5-5",
        max_tokens: 800,
        system: "You are Pal, a friendly cooking companion. Be practical and brief.",
        messages: [{ role: "user", content: swapPrompt(recipe, goal, mealKcal, diet) }],
        output_config: { format: zodOutputFormat(SwapList) },
      });
      if (msg.parsed_output) return { swaps: valid(msg.parsed_output.swaps), planner: "claude" };
    } catch (e) {
      tried.push(`claude: ${clean(e)}`);
    }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await geminiClient().models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: swapPrompt(recipe, goal, mealKcal, diet) }] }],
        config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(SwapList), temperature: 0.4, abortSignal: AbortSignal.timeout(30_000) },
      });
      if (res.text) return { swaps: valid(SwapList.parse(JSON.parse(res.text)).swaps), planner: "gemini" };
    } catch (e) {
      tried.push(`gemini: ${clean(e)}`);
    }
  }
  return { swaps: ruleSwaps(recipe, goal, diet), planner: "built-in", note: tried.join(" | ") || undefined };
}

// ---------- Pantry photo ----------

const Seen = z.object({ have: z.array(z.string()) });

export async function readPantry(image: string, mimeType: string, ingredients: string[]): Promise<string[]> {
  if (mock()) {
    await sleep(900);
    return ingredients.slice(0, Math.ceil(ingredients.length / 2));
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new KitchenError(503, "pantry_unavailable", "My eyes aren't switched on yet. Tick what you have instead.", "GEMINI_API_KEY is not set");
  }
  try {
    const res = await geminiClient().models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: image } },
          { text: `This is a photo of someone's fridge, pantry or shelves. Which of these ingredients can you see (or a clear equivalent)? Copy names exactly from this list:\n${ingredients.join("\n")}\nOnly include items you can actually see.` },
        ],
      }],
      config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(Seen), temperature: 0.1, abortSignal: AbortSignal.timeout(60_000) },
    });
    const list = new Set(ingredients);
    return Seen.parse(JSON.parse(res.text ?? "{}")).have.filter((n) => list.has(n));
  } catch (e) {
    throw new KitchenError(502, "pantry_failed", "I couldn't make out that photo. Try a brighter one, or tick what you have.", clean(e));
  }
}

// ---------- Recommendations (the dish does not fit the goal) ----------
// Each fix targets one check the dish misses, says what it adds per serving, and is scored on the numbers:
// how much it closes the gaps, minus any check it would break. Best score first, whoever wrote it (AI or rules).

type Rec = z.infer<typeof Recommendation>;
type Adds = Rec["adds"];
export type Check = { id: string; label: string; value: number; lo: number | null; hi: number | null; pass: boolean };
type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
const RecList = z.object({ recommendations: z.array(Recommendation).max(4) });

// The dish's numbers per serving for one check, after a fix.
function metric(id: string, m: Macros, before: number): number {
  switch (id) {
    case "kcal": case "target": return m.kcal;
    case "protein": return m.protein_g;
    case "density": return m.kcal > 0 ? (m.protein_g * 100) / m.kcal : 0;
    case "fat": return m.fat_g;
    case "carbs": return m.carbs_g;
    default: return before; // time: food can't change it
  }
}
const gap = (c: Check, v: number) => (c.lo !== null && v < c.lo ? c.lo - v : c.hi !== null && v > c.hi ? v - c.hi : 0);

export function scoreFix(base: Macros, adds: Adds, checks: Check[]): { score: number; fixed: string[]; broke: string[] } {
  const after = { kcal: base.kcal + adds.kcal, protein_g: base.protein_g + adds.protein_g, carbs_g: base.carbs_g + adds.carbs_g, fat_g: base.fat_g + adds.fat_g };
  let score = 0;
  const fixed: string[] = [];
  const broke: string[] = [];
  for (const c of checks) {
    const was = gap(c, c.value);
    const now = gap(c, metric(c.id, after, c.value));
    if (!c.pass && was > 0) {
      const progress = (was - now) / was; // 1 = fully closed, negative = made it worse
      score += progress < 0 ? progress * 2 : progress; // making a miss worse counts double: no tuna for a dish that is already too big
      if (now === 0) { score += 1; fixed.push(c.id); }
    } else if (now > 0) {
      score -= 2; // it passed before and this fix breaks it
      broke.push(c.id);
    }
  }
  return { score, fixed, broke };
}

// Real foods with rough numbers per serving (USDA style), marked estimated. tag = which diets can't have it.
type Food = { title: string; how: string; kind: "recipe" | "side"; adds: Adds; for: string[] };
const FOODS: Food[] = [
  { title: "Add 3 egg whites", how: "Whisk 3 egg whites into the dish at the end, or scramble them on the side.", kind: "recipe", adds: { kcal: 51, protein_g: 11, carbs_g: 0.7, fat_g: 0.2 }, for: ["protein", "density"] },
  { title: "Add 100 g shrimp", how: "Toss 100 g cooked shrimp into the pan for the last 2 minutes.", kind: "recipe", adds: { kcal: 99, protein_g: 24, carbs_g: 0.2, fat_g: 0.3 }, for: ["protein", "density"] },
  { title: "100 g tuna on the side", how: "A small can of tuna in water (about 100 g drained) with lemon and pepper.", kind: "side", adds: { kcal: 116, protein_g: 26, carbs_g: 0, fat_g: 1 }, for: ["protein", "density"] },
  { title: "170 g Greek yogurt on the side", how: "170 g of plain 0% Greek yogurt, with herbs or a little hot sauce.", kind: "side", adds: { kcal: 100, protein_g: 17, carbs_g: 6, fat_g: 0.7 }, for: ["protein", "density"] },
  { title: "150 g cottage cheese on the side", how: "150 g of low fat cottage cheese with black pepper.", kind: "side", adds: { kcal: 108, protein_g: 18, carbs_g: 4, fat_g: 1.5 }, for: ["protein", "density"] },
  { title: "Add 100 g chicken breast", how: "Cook 100 g more chicken breast per serving into the dish.", kind: "recipe", adds: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 }, for: ["protein", "density"] },
  { title: "Add 100 g firm tofu", how: "Cube 100 g firm tofu, brown it, and stir it into the dish.", kind: "recipe", adds: { kcal: 144, protein_g: 17, carbs_g: 2.8, fat_g: 8.7 }, for: ["protein"] },
  { title: "Add 100 g seitan", how: "Slice 100 g seitan, sear it, and stir it into the dish.", kind: "recipe", adds: { kcal: 120, protein_g: 21, carbs_g: 4, fat_g: 2 }, for: ["protein", "density"] },
  { title: "100 g edamame on the side", how: "100 g shelled edamame with a pinch of salt.", kind: "side", adds: { kcal: 121, protein_g: 12, carbs_g: 9, fat_g: 5 }, for: ["protein"] },
  { title: "Stir in 100 g lentils", how: "Stir 100 g cooked lentils into the dish to bulk it up.", kind: "recipe", adds: { kcal: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4 }, for: ["protein", "carbs"] },
  { title: "Top it with 2 eggs", how: "Fry or soft boil 2 eggs and put them on top.", kind: "recipe", adds: { kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 }, for: ["protein", "kcal", "target"] },
  { title: "1 protein shake with it", how: "One scoop of protein powder (about 30 g) shaken with water.", kind: "side", adds: { kcal: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5 }, for: ["protein", "density"] },
  { title: "1 cup of rice on the side", how: "160 g of cooked rice (about 1 cup).", kind: "side", adds: { kcal: 208, protein_g: 4.3, carbs_g: 45, fat_g: 0.5 }, for: ["carbs", "kcal", "target"] },
  { title: "Add 200 g potatoes", how: "Roast or boil 200 g of potatoes and serve them with it.", kind: "recipe", adds: { kcal: 174, protein_g: 3.7, carbs_g: 40, fat_g: 0.2 }, for: ["carbs", "kcal", "target"] },
  { title: "1 banana after", how: "One medium banana for dessert.", kind: "side", adds: { kcal: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4 }, for: ["carbs"] },
  { title: "250 ml of milk with it", how: "250 ml of whole milk with the meal.", kind: "side", adds: { kcal: 150, protein_g: 8, carbs_g: 12, fat_g: 8 }, for: ["kcal", "target", "carbs"] },
  { title: "Finish with 1 tbsp olive oil", how: "Drizzle 1 tablespoon of olive oil over the plate.", kind: "recipe", adds: { kcal: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5 }, for: ["kcal", "target"] },
  { title: "30 g almonds on the side", how: "30 g of almonds as a side or snack after.", kind: "side", adds: { kcal: 174, protein_g: 6, carbs_g: 6, fat_g: 15 }, for: ["kcal", "target"] },
];

// Lighter changes to the dish itself, sized from its own numbers.
function lighter(base: Macros): Food[] {
  const out: Food[] = [];
  if (base.fat_g >= 10) {
    const cut = Math.floor(base.fat_g * 0.4);
    out.push({ title: "Use half the fat", how: "Halve the oil, butter and cheese, and grill, bake or air fry instead of frying.", kind: "recipe", adds: { kcal: -cut * 9, protein_g: 0, carbs_g: 0, fat_g: -cut }, for: ["kcal", "target", "fat", "density"] });
  }
  if (base.carbs_g >= 30) {
    const cut = Math.floor(base.carbs_g * 0.5);
    out.push({ title: "Half the carbs, more veg", how: "Use half the rice, pasta or bread and fill the gap with greens or roast veg.", kind: "recipe", adds: { kcal: -cut * 4 + 30, protein_g: 1, carbs_g: -cut + 6, fat_g: 0 }, for: ["kcal", "target", "density"] });
  }
  // Trade half the carbs for lean protein: more protein for about the same energy. The smart fix when both are tight.
  if (base.carbs_g >= 30) {
    const cut = Math.floor(base.carbs_g * 0.5);
    for (const p of [
      { name: "shrimp", how: "100 g cooked shrimp", kcal: 99, protein_g: 24, carbs_g: 0.2, fat_g: 0.3 },
      { name: "chicken breast", how: "100 g chicken breast", kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
      { name: "firm tofu", how: "100 g firm tofu", kcal: 144, protein_g: 17, carbs_g: 2.8, fat_g: 8.7 },
      { name: "seitan", how: "100 g seitan", kcal: 120, protein_g: 21, carbs_g: 4, fat_g: 2 },
    ]) {
      out.push({ title: `Half the carbs, add ${p.how}`, how: `Use half the rice, pasta or noodles and add ${p.how} per serving instead.`, kind: "recipe", adds: { kcal: -cut * 4 + p.kcal, protein_g: p.protein_g - 2, carbs_g: -cut + p.carbs_g, fat_g: p.fat_g }, for: ["protein", "density"] });
    }
  }
  const q = { kcal: -Math.floor(base.kcal / 4), protein_g: -Math.floor(base.protein_g / 4), carbs_g: -Math.floor(base.carbs_g / 4), fat_g: -Math.floor(base.fat_g / 4) };
  out.push({ title: "Three quarters and a salad", how: "Eat three quarters of a serving with a big green salad, light dressing.", kind: "side", adds: { kcal: q.kcal + 40, protein_g: q.protein_g + 2, carbs_g: q.carbs_g + 6, fat_g: q.fat_g + 1 }, for: ["kcal", "target"] });
  return out;
}

const PREP: Food = { title: "Prep it the night before", how: "Chop and marinate tonight, then it is a quick cook tomorrow.", kind: "recipe", adds: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, for: ["time"] };

const round1 = (n: number) => Math.floor(n * 10) / 10; // never round up
const tidy = (a: Adds): Adds => ({ kcal: Math.floor(a.kcal), protein_g: round1(a.protein_g), carbs_g: round1(a.carbs_g), fat_g: round1(a.fat_g) });

// Keep fixes that help on the numbers and fit the diet, best first, at most one per idea. Fills in kcal with the math.
export function rankFixes(list: Rec[], base: Macros, checks: Check[], diet: string[]): Rec[] {
  const scored = list
    .filter((r) => !breaksDiet(`${r.title} ${r.how}`, diet))
    .map((r) => ({ r: { ...r, adds: tidy(r.adds), kcal: Math.floor(base.kcal + r.adds.kcal), source: "estimated" as const }, ...scoreFix(base, r.adds, checks) }))
    // A time fix changes no numbers but is still useful when time is what misses.
    .filter((x) => x.score > 0.05 || (x.r.fixes === "time" && checks.some((c) => c.id === "time" && !c.pass)));
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return scored.filter((x) => !seen.has(x.r.title.toLowerCase()) && seen.add(x.r.title.toLowerCase())).map((x) => x.r);
}

export function ruleRecs(base: Macros, checks: Check[], diet: string[]): Rec[] {
  const missing = new Set(checks.filter((c) => !c.pass).map((c) => c.id));
  const pool = [...FOODS, ...lighter(base), PREP].filter((f) => f.for.some((id) => missing.has(id)));
  const recs: Rec[] = pool.map((f) => ({ title: f.title, how: f.how, kind: f.kind, fixes: f.for.find((id) => missing.has(id))!, adds: f.adds, kcal: null, source: "estimated" }));
  // Best first, but no more than 2 of the same kind, so there is always a choice between changing the dish and a side.
  const ranked = rankFixes(recs, base, checks, diet);
  const picked: Rec[] = [];
  for (const r of ranked) if (picked.filter((p) => p.kind === r.kind).length < 2 && picked.length < 3) picked.push(r);
  return picked;
}

function recPrompt(recipe: Recipe, goal: Goal, base: Macros, checks: Check[], diet: string[]) {
  const aim = goal === "cut" ? "lose weight" : goal === "bulk" ? "build muscle" : "eat healthier";
  const bound = (c: Check) => (c.lo !== null && c.hi !== null ? `${c.lo} to ${c.hi}` : c.lo !== null ? `at least ${c.lo}` : `at most ${c.hi}`);
  const misses = checks.filter((c) => !c.pass).map((c) => `- ${c.id} (${c.label}): ${round1(c.value)}, needs ${bound(c)}`).join("\n");
  const keep = checks.filter((c) => c.pass && c.id !== "time").map((c) => `- ${c.id} (${c.label}): ${round1(c.value)}, needs ${bound(c)}`).join("\n");
  return (
    `The user wants to ${aim}. Dish: ${recipe.title}, per serving ${Math.floor(base.kcal)} kcal, ${base.protein_g} g protein, ${base.carbs_g} g carbs, ${base.fat_g} g fat.\n` +
    `Ingredients: ${recipe.ingredients.map((i) => `${i.name} (${i.qty ?? "?"} ${i.unit})`).join("; ")}.\n` +
    `Checks it MISSES (fix these):\n${misses}\nChecks it passes (do NOT break these):\n${keep || "- none"}\n` +
    (diet.length ? `The user NEVER eats: ${dietWords(diet)}. Never suggest anything that breaks this.\n` : "") +
    `Give 4 smart fixes, best first. A smart fix closes the biggest gap without breaking a check that passes: ` +
    `on a cut, add protein that costs few calories (egg whites, shrimp, Greek yogurt, tuna), not fatty protein; when energy is too high, change the dish (less oil, fewer carbs, smaller portion). ` +
    `Mix kinds: "recipe" changes the dish itself (name the exact ingredient and amount per serving), "side" goes next to it. Match the dish's cuisine so it still tastes right.\n` +
    `fixes = the id of the check it targets. adds = what it changes PER SERVING in kcal, protein_g, carbs_g, fat_g (negative when it removes). ` +
    `Title is the action with the exact amount, under 40 characters, e.g. "Add 100 g chicken breast". How under 110 characters with the amount. kcal = null, source "estimated". Never use hyphens or dashes.`
  );
}

export async function recommendFor(
  recipe: Recipe, goal: Goal, mealKcal: number | null, kcalAfter: number, misses: string[], checks: Check[] = [], diet: string[] = [],
): Promise<{ recommendations: Rec[]; planner: string; note?: string }> {
  const m = recipe.macros_per_serving;
  const base: Macros = { kcal: kcalAfter, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g };
  // An older app sends only the miss text: rebuild the energy check so the scoring still works.
  if (!checks.length) {
    const limit = mealKcal ?? (goal === "cut" ? 550 : null);
    checks = [{ id: "kcal", label: misses[0] ?? "Energy", value: kcalAfter, lo: goal === "bulk" ? (limit ?? 600) : null, hi: goal === "bulk" ? null : limit, pass: false }];
  }
  if (mock()) {
    await sleep(500);
    return { recommendations: ruleRecs(base, checks, diet), planner: "mock" };
  }
  const tried: string[] = [];
  const prompt = recPrompt(recipe, goal, base, checks, diet);
  // The AI's fixes go through the same scoring and diet check as the rules. If none survive, the rules answer.
  const keep = (list: Rec[]) => rankFixes(list, base, checks, diet).slice(0, 3);
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const msg = await (anthropic ??= new Anthropic()).messages.parse({
        model: process.env.CLAUDE_MODEL || "claude-haiku-5-5",
        max_tokens: 1200,
        system: "You are Pal, a friendly cooking companion and sharp sports nutritionist. Be practical, kind and brief. Your nutrition numbers are realistic.",
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(RecList) },
      });
      const list = keep(msg.parsed_output?.recommendations ?? []);
      if (list.length) return { recommendations: list, planner: "claude" };
      tried.push("claude: no fix survived the checks");
    } catch (e) {
      tried.push(`claude: ${clean(e)}`);
    }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await geminiClient().models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // Light thinking: deep thinking took over 30 s here. The scoring above catches any weak idea anyway.
        config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(RecList), temperature: 0.5, abortSignal: AbortSignal.timeout(35_000), thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
      });
      const list = keep(res.text ? RecList.parse(JSON.parse(res.text)).recommendations : []);
      if (list.length) return { recommendations: list, planner: "gemini" };
      tried.push("gemini: no fix survived the checks");
    } catch (e) {
      tried.push(`gemini: ${clean(e)}`);
    }
  }
  return { recommendations: ruleRecs(base, checks, diet), planner: "built-in", note: tried.join(" | ") || undefined };
}
