// Gate B pass test, kept separate from the network code so it can be unit tested.

export type Ingredient = { name: string; qty: number | null; unit: string | null; estimate: boolean };

export type ReelResult = {
  url: string;
  ok: boolean; // pipeline finished without an error
  recipe: { is_recipe: boolean; title: string; ingredients: Ingredient[]; steps: string[] } | null;
  seconds: number;
  costUsd: number | null; // null when a price is not configured
  error?: string;
};

export const LIMITS = { minRecipes: 7, minQuantifiedShare: 0.8, maxSeconds: 90 };

export function isRecipe(r: ReelResult): boolean {
  return r.ok && !!r.recipe?.is_recipe && r.recipe.ingredients.length > 0;
}

export function score(results: ReelResult[]) {
  const recipes = results.filter(isRecipe);
  const ingredients = recipes.flatMap((r) => r.recipe!.ingredients);
  const quantified = ingredients.filter((i) => i.qty !== null || i.estimate).length;
  const quantifiedShare = ingredients.length ? quantified / ingredients.length : 0;
  const slow = results.filter((r) => r.seconds > LIMITS.maxSeconds).map((r) => r.url);
  const missingCost = results.filter((r) => r.costUsd === null).map((r) => r.url);

  const checks = {
    recipes: { pass: recipes.length >= LIMITS.minRecipes, value: `${recipes.length} of ${results.length}` },
    quantities: { pass: quantifiedShare >= LIMITS.minQuantifiedShare, value: `${Math.round(quantifiedShare * 100)}% of ${ingredients.length}` },
    speed: { pass: slow.length === 0, value: slow.length ? `over ${LIMITS.maxSeconds}s: ${slow.join(", ")}` : `all under ${LIMITS.maxSeconds}s` },
    costLogged: { pass: missingCost.length === 0, value: missingCost.length ? `no cost for ${missingCost.length} reel(s)` : "logged for every reel" },
  };
  return { pass: Object.values(checks).every((c) => c.pass), checks };
}
