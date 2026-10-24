import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { LlmRecipe, LlmSwaps, type Goal, type Recipe } from "./schema.js";
import type { Segment } from "./whisper.js";

let client: Anthropic | null = null;

async function askJson(schema: z.ZodType, system: string, user: string): Promise<unknown> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic();
  const msg = await client.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(schema as never) },
  });
  const text = msg.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("model returned no text");
  return JSON.parse(text.text); // a JSON syntax error is reported by the caller as a bad model output
}

export type ExtractInput = { caption: string; transcript: Segment[] };

/** Raw (unvalidated) recipe from the model. The caller validates it. */
export function extractRecipe({ caption, transcript }: ExtractInput): Promise<unknown> {
  const lines = transcript.map((s) => `[${Math.floor(s.start)}s] ${s.text}`).join("\n");
  return askJson(
    LlmRecipe,
    "You turn a short cooking video into a structured recipe. Use only what the caption and transcript say or clearly imply. " +
      "Do not invent a dish. If the video is not a cooking recipe, return empty ingredients and instructions. " +
      "Ingredient names must be plain food names a nutrition database would know (e.g. \"heavy cream\", \"chicken breast\"). " +
      "Use quantity and unit as stated; when a quantity is not stated, pick a sensible one for the portions. " +
      "Use a unit like cup, tbsp, tsp, g, oz, lb, ml, or an empty string for countable things (e.g. 2 eggs). " +
      "video_timestamp_sec is the transcript time where the step is spoken; null if you cannot tell. Never write macros.",
    `CAPTION:\n${extractCaption(caption)}\n\nTRANSCRIPT (with seconds):\n${lines || "(no speech)"}`,
  );
}
const extractCaption = (c: string) => c.slice(0, 4000);

const GOAL_HINT: Record<Goal, string> = {
  bulk: "more calories and protein (calorie-dense, high-protein swaps)",
  cut: "fewer calories and fat while keeping protein high",
  maintain: "similar calories and macros, just somewhat healthier",
  keto: "very low carbs, higher fat",
  high_protein: "much more protein per portion",
};

/** Raw (unvalidated) swap proposals. Numbers are never requested: macros are computed from USDA in code. */
export function proposeSwaps(recipe: Recipe, goal: Goal): Promise<unknown> {
  const list = recipe.ingredients.map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`.trim()).join("\n");
  return askJson(
    LlmSwaps,
    "You suggest ingredient swaps that move a recipe toward a goal while keeping the dish recognisable. " +
      "Propose at most 5 swaps. Each `original` must be copied exactly from the ingredient list. " +
      "Give the replacement a plain food name and a realistic quantity and unit. Never write calorie or macro numbers.",
    `Goal: ${goal} (${GOAL_HINT[goal]}).\nRecipe: ${recipe.recipe.title}, ${recipe.recipe.portions} portions.\nIngredients:\n${list}`,
  );
}
