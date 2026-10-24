import type { Macros } from "./schema.js";
import type { Portion, UsdaFood, UsdaLookup } from "./nutrition.js";

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

type SearchHit = { fdcId: number; foodNutrients?: { nutrientNumber?: string; value?: number }[] };
// Foundation foods often leave out a macro (meat usually has no carbs row), so a hit only counts if it has all four.
const hasAllMacros = (h: SearchHit) => {
  const nums = new Set((h.foodNutrients ?? []).filter((n) => typeof n.value === "number").map((n) => n.nutrientNumber));
  return ["203", "204", "205"].every((n) => nums.has(n)) && ["208", "957", "958"].some((n) => nums.has(n));
};

/** USDA FoodData Central lookup with an in-memory cache. Uses curated datasets only (Foundation, SR Legacy). */
export function createUsda(apiKey: string | undefined, fetchImpl: typeof fetch = fetch): UsdaLookup {
  const cache = new Map<string, Promise<UsdaFood | null>>();
  const get = async (path: string, params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...params, api_key: apiKey! });
    const res = await fetchImpl(`${BASE}${path}?${qs}`);
    if (!res.ok) throw new Error(`USDA ${path} returned ${res.status}`);
    return res.json();
  };
  return (name) => {
    const key = name.trim().toLowerCase();
    if (!apiKey) return Promise.reject(new Error("USDA_API_KEY is not set"));
    let hit = cache.get(key);
    if (!hit) {
      hit = (async () => {
        const search = (await get("/foods/search", { query: key, dataType: "Foundation,SR Legacy", pageSize: "5" })) as {
          foods?: SearchHit[];
        };
        for (const h of (search.foods ?? []).filter(hasAllMacros).slice(0, 2)) {
          const food = parseFood((await get(`/food/${h.fdcId}`, {})) as Detail);
          if (food) return food;
        }
        return null;
      })();
      hit.catch(() => cache.delete(key)); // do not cache failures
      cache.set(key, hit);
    }
    return hit;
  };
}
