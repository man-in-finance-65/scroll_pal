import type { Macros } from "./schema.js";
import { z } from "zod";
import type { Portion, UsdaFood, UsdaMatcher } from "./nutrition.js";

const BASE = "https://api.nal.usda.gov/fdc/v1";

type Nutrient = { nutrient?: { number?: string; unitName?: string }; amount?: number };
type Detail = {
  fdcId: number;
  description: string;
  foodNutrients?: Nutrient[];
  foodPortions?: { amount?: number; gramWeight?: number; modifier?: string; measureUnit?: { name?: string } }[];
};

function nutrientAmount(list: Nutrient[], ...numbers: string[]): number | null {
  for (const n of numbers) {
    const hit = list.find((x) => x.nutrient?.number === n && typeof x.amount === "number");
    if (hit) return hit.amount!;
  }
  return null;
}

export function parseFood(d: Detail): UsdaFood | null {
  const list = d.foodNutrients ?? [];
  // 208 = Energy (kcal); Foundation foods often only carry the Atwater values 957/958.
  const calories = nutrientAmount(list, "208", "957", "958");
  const protein = nutrientAmount(list, "203");
  const fat = nutrientAmount(list, "204");
  const carbs = nutrientAmount(list, "205");
  if (calories === null || protein === null || fat === null || carbs === null) return null;
  const per100g: Macros = { calories, protein_g: protein, carbs_g: carbs, fat_g: fat };
  const portions: Portion[] = (d.foodPortions ?? [])
    .filter((p) => p.gramWeight && p.amount)
    .map((p) => {
      const unit = p.measureUnit?.name && p.measureUnit.name !== "undetermined" ? p.measureUnit.name : "";
      return { label: `${unit} ${p.modifier ?? ""}`.trim(), amount: p.amount!, gramWeight: p.gramWeight! };
    });
  return { fdcId: d.fdcId, description: d.description, per100g, portions };
}

type SearchHit = { fdcId: number; description: string; foodNutrients?: { nutrientNumber?: string; value?: number }[] };
// Foundation foods often leave out a macro (meat usually has no carbs row), so a hit only counts if it has all four.
const hasAllMacros = (h: SearchHit) => {
  const nums = new Set((h.foodNutrients ?? []).filter((n) => typeof n.value === "number").map((n) => n.nutrientNumber));
  return ["203", "204", "205"].every((n) => nums.has(n)) && ["208", "957", "958"].some((n) => nums.has(n));
};

export type Candidate = { fdcId: number; description: string };
/** Picks, for each ingredient, which USDA candidate it really is (or null). Only a choice: never numbers. */
export type FoodPicker = (items: { name: string; candidates: Candidate[] }[]) => Promise<unknown>;
const PicksSchema = z.object({ picks: z.array(z.object({ name: z.string(), fdc_id: z.number().nullable() })) });

/**
 * USDA FoodData Central lookup for a whole ingredient list at once. USDA's own ranking is poor ("chicken breast"
 * can come back as fried and battered), so we fetch the top candidates and let the model pick the right one.
 * Macros always come from the USDA record itself. Curated datasets only (Foundation, SR Legacy). Cached per name.
 */
export function createUsda(apiKey: string | undefined, pick: FoodPicker, fetchImpl: typeof fetch = fetch): UsdaMatcher {
  const cache = new Map<string, UsdaFood | null>();
  const get = async (path: string, params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...params, api_key: apiKey! });
    const res = await fetchImpl(`${BASE}${path}?${qs}`);
    if (!res.ok) throw new Error(`USDA ${path} returned ${res.status}`);
    return res.json();
  };
  return async (names) => {
    if (!apiKey) throw new Error("USDA_API_KEY is not set");
    const keys = [...new Set(names.map((n) => n.trim().toLowerCase()))].filter((k) => !cache.has(k));
    const searched = await Promise.all(
      keys.map(async (name) => {
        const r = (await get("/foods/search", { query: name, dataType: "Foundation,SR Legacy", pageSize: "10" })) as { foods?: SearchHit[] };
        return { name, candidates: (r.foods ?? []).filter(hasAllMacros).map((h) => ({ fdcId: h.fdcId, description: h.description })) };
      }),
    );
    const toPick = searched.filter((s) => s.candidates.length);
    for (const s of searched) if (!s.candidates.length) cache.set(s.name, null);
    if (toPick.length) {
      const parsed = PicksSchema.safeParse(await pick(toPick));
      if (!parsed.success) throw new Error(`the model's USDA picks failed validation: ${parsed.error.message}`);
      const chosen = new Map(parsed.data.picks.map((p) => [p.name.trim().toLowerCase(), p.fdc_id]));
      await Promise.all(
        toPick.map(async (s) => {
          const id = chosen.get(s.name);
          // An id that was not offered is treated as no match, never trusted.
          if (id == null || !s.candidates.some((c) => c.fdcId === id)) return void cache.set(s.name, null);
          cache.set(s.name, parseFood((await get(`/food/${id}`, {})) as Detail));
        }),
      );
    }
    return new Map(names.map((n) => [n, cache.get(n.trim().toLowerCase()) ?? null]));
  };
}
