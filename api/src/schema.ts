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
  // A screenshot of the caption (base64, no "data:" prefix), for posts whose text can't be copied easily.
  shot: z.object({ data: z.string().min(100), mimeType: z.string().regex(/^image\//) }).optional(),
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

// What the user never wants suggested (vegetarian, no dairy, nut allergy...). Ids from api/src/diet.ts.
export const Diet = z.array(z.string().max(30)).max(12);

export const SwapsBody = z.object({
  recipe: Recipe,
  goal: Goal,
  mealKcal: z.number().nullable().optional(),
  diet: Diet.optional(),
});

export const PantryBody = z.object({
  image: z.string().min(100), // base64, no "data:" prefix
  mimeType: z.string().regex(/^image\//),
  ingredients: z.array(z.string()).min(1).max(60),
});

// What a fix changes, per serving. Negative = less (a lighter swap). Always Pal's estimate.
export const Adds = z.object({ kcal: z.number(), protein_g: z.number(), carbs_g: z.number(), fat_g: z.number() });

// One fix Pal recommends when a recipe misses a goal check. kcal is the per serving energy if you do it (or null).
// kind: "recipe" changes the dish itself, "side" goes on the plate next to it. fixes: the check it targets (its id).
export const Recommendation = z.object({
  title: z.string(),
  how: z.string(),
  kind: z.enum(["recipe", "side"]),
  fixes: z.string(),
  adds: Adds,
  kcal: z.number().nullable(),
  source: Source,
});

export const RecommendBody = z.object({
  recipe: Recipe,
  goal: Goal,
  mealKcal: z.number().nullable().optional(), // the eater's target per meal, if known
  kcalAfter: z.number(), // per serving after the swaps
  misses: z.array(z.string().max(200)).max(8), // which checks the dish failed, with the maths
  // Every goal check with its numbers, so the server can score how well a fix closes the gaps without breaking a pass.
  // id: kcal, protein, density, fat, carbs, time, target. value is the dish now; lo/hi are the bounds (either may be missing).
  checks: z.array(z.object({ id: z.string().max(20), label: z.string().max(60), value: z.number(), lo: z.number().nullable(), hi: z.number().nullable(), pass: z.boolean() })).max(10).optional(),
  diet: Diet.optional(),
});

// Pal works the fixes you picked into the cooking steps. swaps: ingredient changes Pal already made ("to" for "from").
export const StepsBody = z.object({
  recipe: Recipe,
  picks: z.array(Recommendation).min(1).max(5),
  swaps: z.array(z.object({ from: z.string().max(120), to: z.string().max(120) })).max(6).optional(),
});

// One cooking step. pal = Pal added or changed it for your picks.
export const CookStep = z.object({ text: z.string(), pal: z.boolean() });
