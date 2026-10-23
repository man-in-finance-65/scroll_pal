import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Plan, type Recipe } from "./schema.js";

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
    messages: [
      {
        role: "user",
        content:
          `Build a ${days}-day plan with 2 meal slots per day (lunch and dinner). ` +
          `Cook the recipe below at least ${Math.ceil(days / 2)} times; set uses_recipe true on those slots ` +
          `and use leftovers smartly. Other slots: simple meals with common ingredients.\n` +
          `${GOAL_HINT[goal]}\n\nRecipe: ${recipe.title} (${recipe.cuisine}), serves ${recipe.servings}.\n` +
          `Ingredients: ${recipe.ingredients.map((i) => i.name).join(", ")}`,
      },
    ],
    output_config: { format: zodOutputFormat(Plan) },
  });
  if (!msg.parsed_output) throw new Error("Claude returned no plan");
  return msg.parsed_output;
}
