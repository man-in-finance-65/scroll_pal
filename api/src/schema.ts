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

export const PalBody = z.object({
  ref: z.string().max(120).optional(), // which site sent them here
  mobile: z.boolean().optional(),
});

export const FeedbackBody = z.object({
  device: z.string().max(64),
  milestone: z.number().int().min(0).max(50),
  level: z.number().int().min(1).max(999),
  cooks: z.number().int().min(0).max(9999),
  id: z.string().max(40),
  q: z.string().max(400),
  a: z.string().trim().min(1).max(2000),
});

export const EventBody = z.object({
  type: z.enum(["share", "plan", "done", "eat", "skip"]),
  device: z.string().max(64).optional(),
  ref: z.string().max(200).optional(),
});

// One ingredient swap. kcal_saved is per serving: positive = lighter, negative = more energy (bulking).
export const Swap = z.object({
  from: z.string(),
  to: z.string(),
  why: z.string(),
  kcal_saved: z.number(),
  source: Source,
});

export const SwapsBody = z.object({
  recipe: Recipe,
  goal: Goal,
  mealKcal: z.number().nullable().optional(),
});

export const PantryBody = z.object({
  image: z.string().min(100), // base64, no "data:" prefix
  mimeType: z.string().regex(/^image\//),
  ingredients: z.array(z.string()).min(1).max(60),
});

export const InstacartBody = z.object({
  title: z.string().max(120),
  items: z.array(z.object({ name: z.string(), qty: z.number().nullable(), unit: z.string() })).min(1).max(60),
});
