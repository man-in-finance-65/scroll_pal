import { z } from "zod";

export const Goal = z.enum(["bulk", "cut", "maintain", "keto", "high_protein"]);
export type Goal = z.infer<typeof Goal>;

export const Macros = z.object({
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
});
export type Macros = z.infer<typeof Macros>;

export const Ingredient = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string(),
  category: z.string().min(1),
  is_staple: z.boolean(),
});
export type Ingredient = z.infer<typeof Ingredient>;

/** The exact shape that travels between server and app. */
export const RecipeSchema = z.object({
  creator: z.object({
    handle: z.string(),
    platform: z.enum(["tiktok", "instagram", "youtube"]),
    avatar_url: z.string(),
    video_url: z.string().url(),
  }),
  recipe: z.object({
    title: z.string().min(1),
    prep_min: z.number().int().nonnegative(),
    cook_min: z.number().int().nonnegative(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    portions: z.number().int().positive(),
  }),
  ingredients: z.array(Ingredient).min(1),
  instructions: z
    .array(
      z.object({
        step_number: z.number().int().positive(),
        text: z.string().min(1),
        video_timestamp_sec: z.number().int().nonnegative().nullable(),
        chef_tip: z.string().nullable(),
      }),
    )
    .min(1),
  macros: Macros,
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const GoalFitRequest = z.object({ recipe: RecipeSchema, goal: Goal });

// What we ask the model for. Deliberately plain (no min/max) because the model's structured-output
// mode supports only simple schemas; the strict checks above run on whatever it returns.
export const LlmRecipe = z.object({
  recipe: z.object({
    title: z.string(),
    prep_min: z.number(),
    cook_min: z.number(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    portions: z.number(),
  }),
  ingredients: z.array(
    z.object({ name: z.string(), quantity: z.number(), unit: z.string(), category: z.string(), is_staple: z.boolean() }),
  ),
  instructions: z.array(
    z.object({
      step_number: z.number(),
      text: z.string(),
      video_timestamp_sec: z.number().nullable(),
      chef_tip: z.string().nullable(),
    }),
  ),
});

export const LlmSwaps = z.object({
  swaps: z.array(
    z.object({
      original: z.string(),
      replacement: z.object({ name: z.string(), quantity: z.number(), unit: z.string() }),
      reason: z.string(),
    }),
  ),
});
export const StrictSwaps = z.object({
  swaps: z.array(
    z.object({
      original: z.string().min(1),
      replacement: z.object({ name: z.string().min(1), quantity: z.number().positive(), unit: z.string() }),
      reason: z.string().min(1),
    }),
  ),
});
