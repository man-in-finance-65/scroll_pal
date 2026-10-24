export type Goal = "bulk" | "cut" | "maintain" | "keto" | "high_protein";
export const GOALS: { id: Goal; label: string }[] = [
  { id: "bulk", label: "Bulk" },
  { id: "cut", label: "Cut" },
  { id: "maintain", label: "Maintain" },
  { id: "keto", label: "Keto" },
  { id: "high_protein", label: "High protein" },
];

export type Macros = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
export type Ingredient = { name: string; quantity: number; unit: string; category: string; is_staple: boolean };

export type Recipe = {
  creator: { handle: string; platform: "tiktok" | "instagram" | "youtube"; avatar_url: string; video_url: string };
  recipe: { title: string; prep_min: number; cook_min: number; difficulty: "easy" | "medium" | "hard"; portions: number };
  ingredients: Ingredient[];
  instructions: { step_number: number; text: string; video_timestamp_sec: number | null; chef_tip: string | null }[];
  macros: Macros;
};

export type Swap = {
  original: string;
  replacement: string;
  reason: string;
  /** Per-portion macro change of this swap; null when USDA had no data for one side. */
  delta: Macros | null;
  unmatched: string[];
};

export type BreakdownLine =
  | { name: string; usda: string; grams: number; macros: Macros }
  | { name: string; usda: null; grams: null; macros: null; reason: string };

export type GoalFit = {
  optimized_recipe: Recipe;
  swaps: Swap[];
  deltas: Macros;
  original_macros: Macros;
  unmatched: string[];
  /** Whole-recipe numbers per original ingredient (divide by portions for one portion). */
  breakdown: BreakdownLine[];
  unmatched_detail: { name: string; reason: string }[];
};

/** A recipe as saved on the phone. `note` is set when the server could only read the caption. */
export type SavedRecipe = { id: string; recipe: Recipe; note: string | null; savedAt: number };

/** What actually goes on the plan / gets cooked: the original or the goal-optimized version with chosen swaps. */
export type Dish = {
  recipeId: string;
  version: "original" | "optimized";
  goal: Goal | null;
  title: string;
  creator: Recipe["creator"];
  ingredients: Ingredient[];
  instructions: Recipe["instructions"];
  /** Per portion. */
  macros: Macros;
  totalMin: number;
  swapsOn: string[];
};

export type Slot = "breakfast" | "lunch" | "dinner";
export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];

export type Cook = {
  at: number;
  dish: Dish;
  xp: { base: number; protein: number; noWaste: number };
};

export type Targets = { calories: number; protein_g: number };

export type CartItem = { name: string; quantity: number | null; unit: string; from: string[]; isStaple: boolean };
export type Store = "instacart" | "costco" | "doordash";
export type CartResult = {
  store: Store;
  mode: "list_link" | "search_links";
  list_url: string | null;
  items: { name: string; search_url: string }[];
  prices: null;
  note: string;
};
