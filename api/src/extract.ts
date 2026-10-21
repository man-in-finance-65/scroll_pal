// Turns a reel (link + caption) or a recipe screenshot into a dish, using Claude with a strict JSON schema.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Dish } from "../../engine/swap.ts";
import { PodError } from "../../engine/pods.ts";

export type DishInput =
  | { kind: "reel"; url: string; caption: string }
  | { kind: "screenshot"; mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string };

export type Extractor = (input: DishInput) => Promise<Dish>;

const Extraction = z.object({
  is_dish: z.boolean(),
  name: z.string(),
  ingredients: z.array(z.object({ name: z.string(), qty_per_serving: z.number().nonnegative(), unit: z.string() })),
  steps: z.array(z.string()),
  macros_per_serving: z.object({ kcal: z.number().nonnegative(), protein_g: z.number().nonnegative(), carbs_g: z.number().nonnegative(), fat_g: z.number().nonnegative() }),
});

// Structured outputs need every property required and no extras.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_dish", "name", "ingredients", "steps", "macros_per_serving"],
  properties: {
    is_dish: { type: "boolean", description: "false if the content is not a cookable dish" },
    name: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "qty_per_serving", "unit"],
        properties: {
          name: { type: "string", description: "plain grocery name, e.g. 'chicken breast'" },
          qty_per_serving: { type: "number" },
          unit: { type: "string", description: "g, kg, ml, l, tsp, tbsp, cup, oz, lb, or empty for a count" },
        },
      },
    },
    steps: { type: "array", items: { type: "string" } },
    macros_per_serving: {
      type: "object",
      additionalProperties: false,
      required: ["kcal", "protein_g", "carbs_g", "fat_g"],
      properties: { kcal: { type: "number" }, protein_g: { type: "number" }, carbs_g: { type: "number" }, fat_g: { type: "number" } },
    },
  },
};

const SYSTEM = `You turn food content from social media into a meal-prep recipe.
Return the dish name, every ingredient with its quantity for ONE serving, short ordered cooking steps, and estimated macros for one serving.
If the source gives quantities for several servings, divide them. If it gives none, estimate a normal single meal-prep portion.
Use plain grocery names without preparation words (write "onion", not "finely diced onion"; put the preparation in the steps).
Ignore health claims, discount codes and calls to follow the creator. If the content is not a dish someone could cook, set is_dish to false.`;

export function claudeExtractor(client = new Anthropic()): Extractor {
  return async (input) => {
    const content: Anthropic.Beta.BetaContentBlockParam[] =
      input.kind === "reel"
        ? [{ type: "text", text: `Reel link: ${input.url}\n\nCaption:\n${input.caption}\n\nYou can't watch the video; work from the caption.` }]
        : [
            { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.data } },
            { type: "text", text: "This is a screenshot of a recipe or a food post." },
          ];

    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") throw new PodError("Pal couldn't read that one. Try another reel or screenshot.");
    if (response.stop_reason === "max_tokens") throw new PodError("That recipe was too long for Pal to read. Try a shorter caption.");
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new PodError("Pal didn't get a recipe back. Try again.");
    return toDish(JSON.parse(text.text));
  };
}

// Validates Claude's JSON and reshapes it into the app's dish format.
export function toDish(json: unknown): Dish {
  const parsed = Extraction.safeParse(json);
  if (!parsed.success) throw new PodError("Pal got a recipe it couldn't use. Try again.");
  const x = parsed.data;
  if (!x.is_dish || x.ingredients.length === 0) throw new PodError("Pal couldn't find a dish in that. Try a reel or screenshot that shows a recipe.");
  return {
    name: x.name.trim(),
    ingredients: x.ingredients.map((i) => ({ name: i.name.trim(), qty: i.qty_per_serving, unit: i.unit.trim() })),
    steps: x.steps.map((s) => s.trim()).filter(Boolean),
    macros: { kcal: Math.round(x.macros_per_serving.kcal), proteinG: Math.round(x.macros_per_serving.protein_g), carbsG: Math.round(x.macros_per_serving.carbs_g), fatG: Math.round(x.macros_per_serving.fat_g) },
  };
}
