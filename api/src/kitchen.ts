// The kitchen half of Pal: goal swaps, reading a pantry photo, and sending the missing items to Instacart.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { type Recipe, Swap } from "./schema.js";

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

function swapPrompt(recipe: Recipe, goal: Goal, mealKcal: number | null) {
  const aim =
    goal === "cut" ? "make it lighter while keeping protein high" : goal === "bulk" ? "add energy and protein for building muscle" : "make it a little healthier without changing the dish";
  return (
    `Suggest up to 3 ingredient swaps to ${aim}. The dish must still taste like itself.\n` +
    `Recipe: ${recipe.title}, serves ${recipe.servings}, about ${recipe.macros_per_serving.kcal} kcal per serving.` +
    (mealKcal ? ` The eater's target is about ${mealKcal} kcal per meal.` : "") +
    `\nIngredients: ${recipe.ingredients.map((i) => `${i.name} (${i.qty ?? "?"} ${i.unit})`).join("; ")}\n` +
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

export function ruleSwaps(recipe: Recipe, goal: Goal): SwapT[] {
  const out: SwapT[] = [];
  for (const i of recipe.ingredients) {
    const rule = RULES.find((r) => r.goals.includes(goal) && r.match.test(i.name));
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
export async function swapsFor(recipe: Recipe, goal: Goal, mealKcal: number | null): Promise<{ swaps: SwapT[]; planner: string; note?: string }> {
  // Only keep swaps of ingredients that are really in the recipe.
  const names = new Set(recipe.ingredients.map((i) => i.name));
  const valid = (list: SwapT[]) => list.filter((s) => names.has(s.from)).slice(0, 3);
  if (mock()) {
    await sleep(600);
    return { swaps: ruleSwaps(recipe, goal), planner: "mock" };
  }
  const tried: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const msg = await (anthropic ??= new Anthropic()).messages.parse({
        model: process.env.CLAUDE_MODEL || "claude-haiku-5-5",
        max_tokens: 800,
        system: "You are Pal, a friendly cooking companion. Be practical and brief.",
        messages: [{ role: "user", content: swapPrompt(recipe, goal, mealKcal) }],
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
        contents: [{ role: "user", parts: [{ text: swapPrompt(recipe, goal, mealKcal) }] }],
        config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(SwapList), temperature: 0.4, abortSignal: AbortSignal.timeout(30_000) },
      });
      if (res.text) return { swaps: valid(SwapList.parse(JSON.parse(res.text)).swaps), planner: "gemini" };
    } catch (e) {
      tried.push(`gemini: ${clean(e)}`);
    }
  }
  return { swaps: ruleSwaps(recipe, goal), planner: "built-in", note: tried.join(" | ") || undefined };
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

// ---------- Instacart ----------

// "Order on Instacart": Instacart's official Developer Platform API turns the list into a shopping page.
// The user signs in and pays on Instacart's own page; Pal never sees that login.
// Without a key there is still a real path: an Instacart search page for the items.
export async function instacartLink(title: string, items: { name: string; qty: number | null; unit: string }[]): Promise<{ url: string; fallback: boolean }> {
  const key = process.env.INSTACART_API_KEY;
  if (!key) {
    return { url: `https://www.instacart.com/store/s?k=${encodeURIComponent(items.map((i) => i.name).join(", "))}`, fallback: true };
  }
  const base = process.env.INSTACART_BASE_URL || "https://connect.instacart.com";
  const res = await fetch(`${base}/idp/v1/products/products_link`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      title,
      link_type: "shopping_list",
      line_items: items.map((i) => ({
        name: i.name,
        display_text: i.qty ? `${i.qty} ${i.unit} ${i.name}`.replace(/\s+/g, " ").trim() : i.name,
        ...(i.qty ? { line_item_measurements: [{ quantity: i.qty, unit: i.unit || "each" }] } : {}),
      })),
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => {
    throw new KitchenError(502, "instacart_unreachable", "I can't reach Instacart right now. Try again in a minute.", clean(e));
  });
  const json = (await res.json().catch(() => ({}))) as { products_link_url?: string; error?: { message?: string } };
  if (!res.ok || !json.products_link_url) {
    throw new KitchenError(502, "instacart_failed", "Instacart didn't take the list just now. Try again in a minute.", `HTTP ${res.status} ${json.error?.message ?? ""}`.trim());
  }
  return { url: json.products_link_url, fallback: false };
}
