import { z } from "zod";

// "stated" = said or shown in the video/caption. "estimated" = Pal's best guess.
// The app shows a "~" in front of every estimated number.
export const Source = z.enum(["stated", "estimated"]);

export const Ingredient = z.object({
  name: z.string(),
  qty: z.number().nullable(),
  unit: z.string(),
  source: Source,
});

export const Macros = z.object({
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  source: Source,
});

export const Recipe = z.object({
  title: z.string(),
  creator: z.string(),
  cuisine: z.string(),
  servings: z.number().int().min(1),
  ingredients: z.array(Ingredient).min(1),
  steps: z.array(z.string()).min(1),
  prep_minutes: z.number(),
  cook_minutes: z.number(),
  macros_per_serving: Macros,
  confidence: z.number().min(0).max(1),
});
export type Recipe = z.infer<typeof Recipe>;

export const IngestBody = z.object({
  url: z.string().trim().min(1),
  caption: z.string().trim().optional(),
});

export const Goal = z.enum(["bulk", "cut", "maintain"]);

export const PlanBody = z.object({
  recipe: Recipe,
  goal: Goal,
  days: z.number().int().min(1).max(7),
});

export const Slot = z.object({
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  meal: z.string(),
  // cook = make a fresh batch of the recipe (this is what earns XP), leftovers = eat a batch you already made,
  // simple = an easy meal that isn't the recipe
  kind: z.enum(["cook", "leftovers", "simple"]),
  note: z.string(),
});

export const Plan = z.object({
  summary: z.string(),
  days: z.array(z.object({ day: z.number().int(), slots: z.array(Slot).min(1) })).min(1),
});
export type Plan = z.infer<typeof Plan>;

export const EventBody = z.object({
  type: z.enum(["share", "plan", "done", "skip"]),
  device: z.string().max(64).optional(),
  ref: z.string().max(200).optional(),
});
