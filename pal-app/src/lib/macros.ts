import type { Goal, GoalFit, Macros } from "./types";

export const KEYS = ["calories", "protein_g", "carbs_g", "fat_g"] as const;
export type MacroKey = (typeof KEYS)[number];

const trunc1 = (n: number) => Math.trunc(n * 10 + 1e-9 * Math.sign(n)) / 10; // toward zero: never rounds up

/**
 * Totals and deltas for the swaps currently switched on. Pure arithmetic on numbers the server already
 * returned (same sums the server does), so toggling needs no network call.
 */
export function applySwaps(fit: GoalFit, off: Set<string>): { deltas: Macros; total: Macros } {
  const deltas = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const s of fit.swaps) {
    if (off.has(s.original) || !s.delta) continue;
    for (const k of KEYS) deltas[k] += s.delta[k];
  }
  const total = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const k of KEYS) {
    deltas[k] = trunc1(deltas[k]);
    total[k] = trunc1(fit.original_macros[k] + deltas[k]);
  }
  return { deltas, total };
}

// Which direction is "better" for each goal: 1 = higher is better, -1 = lower is better, 0 = no opinion.
const WANT: Record<Goal, Record<MacroKey, 1 | -1 | 0>> = {
  bulk: { calories: 1, protein_g: 1, carbs_g: 1, fat_g: 0 },
  cut: { calories: -1, protein_g: 1, carbs_g: -1, fat_g: -1 },
  maintain: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  keto: { calories: 0, protein_g: 0, carbs_g: -1, fat_g: 1 },
  high_protein: { calories: 0, protein_g: 1, carbs_g: 0, fat_g: 0 },
};

export type Verdict = "good" | "bad" | "neutral";
export const verdict = (goal: Goal, key: MacroKey, delta: number): Verdict => {
  const want = WANT[goal][key];
  if (delta === 0 || want === 0) return "neutral";
  return delta * want > 0 ? "good" : "bad";
};

export const LABEL: Record<MacroKey, string> = { calories: "Calories", protein_g: "Protein", carbs_g: "Carbs", fat_g: "Fat" };
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "");
export const badgeText = (key: MacroKey, delta: number) =>
  key === "calories" ? `${sign(delta)}${Math.abs(delta)} kcal` : `${sign(delta)}${Math.abs(delta)}g ${LABEL[key]}`;
export const amount = (key: MacroKey, n: number) => (key === "calories" ? `${n} kcal` : `${n}g`);
