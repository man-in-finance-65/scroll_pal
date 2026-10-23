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
};

export type Goal = "bulk" | "cut" | "maintain";
export type SlotKind = "cook" | "leftovers" | "simple";

export type PlanFromApi = {
  summary: string;
  days: { day: number; slots: { slot: string; meal: string; kind: SlotKind; note: string }[] }[];
};

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
export type ChecklistItem = { name: string; amount: string; math: string | null; estimated: boolean; checked: boolean };
