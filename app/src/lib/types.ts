// Mirrors api/src/schema.ts. Keep the two in sync.
export type Source = "stated" | "estimated";
export type Ingredient = { name: string; qty: number | null; unit: string; source: Source };
export type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number; source: Source };

export type Recipe = {
  title: string;
  creator: string;
  cuisine: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  prep_minutes: number;
  cook_minutes: number;
  macros_per_serving: Macros;
  confidence: number;
  image?: string | null; // photo for the dish: the video thumbnail or the page's picture
  source_url?: string;
};

export type Goal = "bulk" | "cut" | "maintain";
export type SlotKind = "cook" | "leftovers" | "simple";

export type SlotStatus = "planned" | "done" | "skipped";
export type PlanSlot = {
  id: string;
  day: number;
  date: string; // local day "YYYY-MM-DD"
  slot: string;
  meal: string;
  kind: SlotKind;
  note: string;
  status: SlotStatus;
  recipeTitle?: string; // which of your recipes this cook is (Kitchen Pact plans)
  tweaks?: Recommendation[]; // Pal's fixes you picked when you added it to the plan
};

export type Plan = {
  id: string;
  createdAt: string;
  goal: Goal;
  days: number;
  summary: string;
  recipe: Recipe;
  slots: PlanSlot[];
  confirmed: boolean;
};

export type Stamp = { key: string; label: string; kind: "cuisine" | "creator"; at: string };
export type CookLog = { at: string; title: string; cuisine: string; creator: string };

// Your body, for the meal target. Kept on the phone only.
export type Body = { heightCm: number; weightKg: number; targetKg: number };

// One ingredient Pal swapped to fit your goal. kcal_saved is per serving (negative = more energy, for bulking).
export type Swap = { from: string; to: string; why: string; kcal_saved: number; source: Source };

// What Pal recommends when a dish does not fit your goal. kcal is per serving if you do it.
// kind: "recipe" changes the dish, "side" goes next to it. fixes: the goal check it targets. adds: what it changes per serving.
// (kind, fixes and adds are missing on picks saved before 2026-10-27.)
export type Adds = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
export type Recommendation = { title: string; how: string; kcal: number | null; source: Source; kind?: "recipe" | "side"; fixes?: string; adds?: Adds };

// What the user never wants Pal to suggest. Same ids as api/src/diet.ts.
export type DietId = "vegetarian" | "vegan" | "no_dairy" | "no_eggs" | "gluten_free" | "no_pork" | "no_nuts" | "no_shellfish";

// The meal you're on right now, from the link to the plate.
export type MealStage = "swaps" | "pantry" | "shop" | "wait" | "cook" | "eat" | "done";
export type Meal = {
  id: string;
  recipe: Recipe;
  swaps: Swap[];
  have: string[]; // ingredient names you already have
  tweaks?: Recommendation[]; // the fixes you picked for a dish that did not fit
  tweak?: Recommendation; // older single pick, still read by the cook screen
  orderUrl?: string; // the store cart you shopped in, to reopen it while you wait
  stage: MealStage;
  slotId?: string; // the plan slot this meal fills, if any
  cookedAt?: string;
  eatenAt?: string;
};

// "This week I'll cook N meals with Pal."
export type Pact = { weekStart: string; meals: number };

// A saved chat with Pal, so closing it never loses the conversation.
export type ChatMsg = { from: "pal" | "me"; text: string; key: string };
export type ChatStep = { id: string; apiId?: string; ask: string; chips: string[]; hint?: string };
export type ChatSave = { log: ChatMsg[]; step: ChatStep; finished: boolean; asked: string[] };

// One link Pal is digesting right now. Lives in memory only.
export type Job = { id: string; url: string; caption?: string; status: "digesting" | "done" | "failed"; error?: string; detail?: string; code?: string; title?: string };
