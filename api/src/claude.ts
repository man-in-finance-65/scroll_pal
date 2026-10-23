import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Plan, type Recipe } from "./schema.js";

export function planPrompt(recipe: Recipe, goal: keyof typeof GOAL_HINT, days: number): string {
  return (
    `Dream up a ${days}-day meal plan with 2 meal slots per day (lunch and dinner). Make it feel inspired, not generic: ` +
    `name real dishes that fit the ${recipe.cuisine} flavours of the recipe, vary the meals day to day, and use each note for a useful tip (prep ahead, swap, side). ` +
    `Cook the recipe below fresh at least ${Math.ceil(days / 2)} times (kind "cook"). ` +
    `Use its leftovers creatively (kind "leftovers", e.g. turn them into a wrap, bowl or salad); a batch serves ${recipe.servings}. ` +
    `Other slots: easy meals with common ingredients (kind "simple").\n` +
    `${GOAL_HINT[goal]}\n\nRecipe: ${recipe.title} (${recipe.cuisine}), serves ${recipe.servings}.\n` +
    `Ingredients: ${recipe.ingredients.map((i) => i.name).join(", ")}. Never write calorie or macro numbers. Keep every text field under 70 characters.`
  );
}

let client: Anthropic | null = null;
const anthropic = () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return (client ??= new Anthropic());
};

const GOAL_HINT = {
  bulk: "The user is bulking: generous portions, extra carbs and protein around the main recipe.",
  cut: "The user is cutting: lighter sides, more vegetables, keep protein high.",
  maintain: "The user is maintaining: balanced, normal portions.",
} as const;

export async function buildPlan(recipe: Recipe, goal: keyof typeof GOAL_HINT, days: number): Promise<Plan> {
  const msg = await anthropic().messages.parse({
    model: process.env.CLAUDE_MODEL || "claude-haiku-5-5",
    max_tokens: 1500,
    system:
      "You are Pal, a friendly cooking companion. Write short, practical meal plans. " +
      "Never write calorie or macro numbers; the app calculates those. Keep every text field under 70 characters.",
    messages: [{ role: "user", content: planPrompt(recipe, goal, days) }],
    output_config: { format: zodOutputFormat(Plan) },
  });
  if (!msg.parsed_output) throw new Error("Claude returned no plan");
  return msg.parsed_output;
}
