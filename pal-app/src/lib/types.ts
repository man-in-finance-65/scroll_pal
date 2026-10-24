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

export type GoalFit = {
  optimized_recipe: Recipe;
  swaps: Swap[];
  deltas: Macros;
  original_macros: Macros;
  unmatched: string[];
};
