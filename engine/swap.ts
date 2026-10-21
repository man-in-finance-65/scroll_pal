// Meal Prep Swap: three pod members each bring one dish; a chef cooks 9 portions of each
// (27 in total) and every member takes home 3 portions of every dish.
// Everything here is plain code: scaling, merging, pricing, splitting and ordering.

export type Ingredient = { name: string; qty: number; unit: string }; // per serving
export type Macros = { kcal: number; proteinG: number; carbsG: number; fatG: number }; // per serving
export type Dish = { name: string; ingredients: Ingredient[]; steps: string[]; macros: Macros };

export type Goal =
  | { kind: "high-protein"; minProteinG: number }
  | { kind: "calorie-target"; dailyKcal: number; mealsPerDay: number }
  | { kind: "low-carb"; maxCarbsG: number }
  | { kind: "vegetarian" };

export type Chef = { id: string; name: string; ratePerPortion: number; bio: string; specialty: string };
export type PriceItem = { per: "kg" | "l" | "each"; price: number; gEach?: number; gPerMl?: number; aliases?: string[] };
export type PriceTable = { currency: string; items: Record<string, PriceItem> };

export const MEMBERS_PER_POD = 3;
export const PORTIONS_PER_MEMBER_PER_DISH = 3;
export const PORTIONS_PER_DISH = MEMBERS_PER_POD * PORTIONS_PER_MEMBER_PER_DISH; // 9
export const TOTAL_PORTIONS = PORTIONS_PER_DISH * MEMBERS_PER_POD; // 27

// ---------- Goal conflicts ----------

const MEAT_WORDS = ["chicken", "beef", "pork", "turkey", "lamb", "bacon", "ham", "sausage", "salmon", "tuna", "shrimp", "prawn", "fish", "anchov", "duck", "veal", "chorizo", "pepperoni", "gelatin"];

export function goalLabel(g: Goal): string {
  switch (g.kind) {
    case "high-protein": return `High protein (${g.minProteinG} g+ per meal)`;
    case "calorie-target": return `${g.dailyKcal} kcal a day over ${g.mealsPerDay} meals`;
    case "low-carb": return `Low carb (under ${g.maxCarbsG} g per meal)`;
    case "vegetarian": return "Vegetarian";
  }
}

// One portion is one meal. Returns a plain-English reason for each clash, or nothing.
export function goalConflicts(dish: Dish, goal: Goal): string[] {
  const m = dish.macros;
  switch (goal.kind) {
    case "high-protein":
      return m.proteinG < goal.minProteinG ? [`${Math.round(m.proteinG)} g protein per portion, goal is ${goal.minProteinG} g+`] : [];
    case "calorie-target": {
      const perMeal = goal.dailyKcal / goal.mealsPerDay;
      return m.kcal > perMeal * 1.15 ? [`${Math.round(m.kcal)} kcal per portion, meals should be about ${Math.round(perMeal)}`] : [];
    }
    case "low-carb":
      return m.carbsG > goal.maxCarbsG ? [`${Math.round(m.carbsG)} g carbs per portion, goal is under ${goal.maxCarbsG} g`] : [];
    case "vegetarian": {
      const meat = dish.ingredients.map((i) => i.name).filter((n) => MEAT_WORDS.some((w) => n.toLowerCase().includes(w)));
      return meat.length ? [`contains ${meat.join(", ")}`] : [];
    }
  }
}

// ---------- Units and names ----------

type Base = "g" | "ml" | "count";
const TO_BASE: Record<string, [Base, number]> = {
  g: ["g", 1], gram: ["g", 1], grams: ["g", 1], kg: ["g", 1000], oz: ["g", 28.35], lb: ["g", 453.6], lbs: ["g", 453.6],
  ml: ["ml", 1], l: ["ml", 1000], liter: ["ml", 1000], litre: ["ml", 1000], tsp: ["ml", 4.93], teaspoon: ["ml", 4.93], teaspoons: ["ml", 4.93],
  tbsp: ["ml", 14.79], tablespoon: ["ml", 14.79], tablespoons: ["ml", 14.79], cup: ["ml", 240], cups: ["ml", 240], "fl oz": ["ml", 29.57],
  "": ["count", 1], each: ["count", 1], whole: ["count", 1], piece: ["count", 1], pieces: ["count", 1], clove: ["count", 1], cloves: ["count", 1],
  can: ["count", 1], cans: ["count", 1], large: ["count", 1], medium: ["count", 1], small: ["count", 1], pinch: ["count", 1], bunch: ["count", 1],
};

export function toBase(qty: number, unit: string): { qty: number; base: Base | string } {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  const hit = TO_BASE[u];
  return hit ? { qty: qty * hit[1], base: hit[0] } : { qty, base: u };
}

const FILLER = /\b(fresh|chopped|diced|minced|sliced|grated|large|small|medium|boneless|skinless|raw|cooked|dried|ground fresh|to taste)\b/g;
export function canonicalName(name: string, prices?: PriceTable): string {
  const clean = name.toLowerCase().replace(/\(.*?\)/g, "").replace(/,.*$/, "").replace(FILLER, "").replace(/\s+/g, " ").trim();
  if (prices) {
    for (const [key, item] of Object.entries(prices.items)) {
      if (key === clean || item.aliases?.includes(clean)) return key;
    }
    const singular = clean.replace(/(?<!s)s$/, "");
    for (const [key, item] of Object.entries(prices.items)) {
      if (key === singular || item.aliases?.includes(singular)) return key;
    }
  }
  return clean;
}

// ---------- Grocery list ----------

export type GroceryLine = { name: string; qty: number; base: string; display: string; dishes: string[]; cost: number | null };

export function display(qty: number, base: string): string {
  if (base === "g") return qty >= 1000 ? `${(qty / 1000).toFixed(2).replace(/\.?0+$/, "")} kg` : `${Math.ceil(qty)} g`;
  if (base === "ml") return qty >= 1000 ? `${(qty / 1000).toFixed(2).replace(/\.?0+$/, "")} L` : `${Math.ceil(qty)} ml`;
  if (base === "count") return `${Math.ceil(qty)}`;
  return `${Math.round(qty * 10) / 10} ${base}`;
}

function lineCost(qty: number, base: string, item: PriceItem | undefined): number | null {
  if (!item) return null;
  let grams: number | null = null, ml: number | null = null, count: number | null = null;
  if (base === "g") grams = qty;
  else if (base === "ml") ml = qty;
  else if (base === "count") count = Math.ceil(qty);
  else return null;
  if (item.per === "each") {
    if (count !== null) return count * item.price;
    const g = grams ?? (ml !== null && item.gPerMl ? ml * item.gPerMl : null);
    return g !== null && item.gEach ? Math.ceil(g / item.gEach) * item.price : null;
  }
  if (item.per === "kg") {
    const g = grams ?? (ml !== null && item.gPerMl ? ml * item.gPerMl : null) ?? (count !== null && item.gEach ? count * item.gEach : null);
    return g !== null ? (g / 1000) * item.price : null;
  }
  const v = ml ?? (grams !== null && item.gPerMl ? grams / item.gPerMl : null);
  return v !== null ? (v / 1000) * item.price : null;
}

// Express an amount in the unit the store sells it by, so "1 cup rice" and "200 g rice" merge.
function toShelfUnit(qty: number, base: string, item: PriceItem | undefined): { qty: number; base: string } {
  if (!item) return { qty, base };
  if (item.per === "kg") {
    if (base === "ml" && item.gPerMl) return { qty: qty * item.gPerMl, base: "g" };
  } else if (item.per === "l") {
    if (base === "g" && item.gPerMl) return { qty: qty / item.gPerMl, base: "ml" };
  } else if (base === "g" && item.gEach) return { qty: qty / item.gEach, base: "count" };
  return { qty, base };
}

// Each dish's per-serving ingredients times 9 portions, merged by ingredient and unit family.
export function groceryList(dishes: Dish[], prices: PriceTable): GroceryLine[] {
  const lines = new Map<string, GroceryLine>();
  for (const d of dishes)
    for (const ing of d.ingredients) {
      const name = canonicalName(ing.name, prices);
      const raw = toBase(ing.qty * PORTIONS_PER_DISH, ing.unit);
      const { qty, base } = toShelfUnit(raw.qty, raw.base, prices.items[name]);
      const key = `${name}|${base}`;
      const line = lines.get(key) ?? { name, qty: 0, base, display: "", dishes: [], cost: null };
      line.qty += qty;
      if (!line.dishes.includes(d.name)) line.dishes.push(d.name);
      lines.set(key, line);
    }
  return [...lines.values()]
    .map((l) => ({ ...l, display: display(l.qty, l.base), cost: lineCost(l.qty, l.base, prices.items[l.name]) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Cost split ----------

export type CostSplit = { ingredients: number; chef: number; total: number; perMember: number[]; unpriced: string[]; currency: string };

export function costSplit(grocery: GroceryLine[], chef: Chef | null, currency: string): CostSplit {
  const cents = (n: number) => Math.round(n * 100);
  const ingredients = cents(grocery.reduce((t, l) => t + (l.cost ?? 0), 0));
  const chefCost = chef ? cents(chef.ratePerPortion * TOTAL_PORTIONS) : 0;
  const total = ingredients + chefCost;
  // Split to the cent; any leftover cents go to the first members so the shares add up exactly.
  const base = Math.floor(total / MEMBERS_PER_POD);
  const perMember = Array.from({ length: MEMBERS_PER_POD }, (_, k) => (base + (k < total - base * MEMBERS_PER_POD ? 1 : 0)) / 100);
  return { ingredients: ingredients / 100, chef: chefCost / 100, total: total / 100, perMember, unpriced: grocery.filter((l) => l.cost === null).map((l) => l.name), currency };
}

// ---------- Chef prep sheet ----------

export type PrepPhase = "Set up" | "Prep" | "Start the long cooks" | "Cook while those run" | "Finish and portion";
export type PrepStep = { phase: PrepPhase; dish: string | null; text: string; minutes: number | null };

const LONG = /\b(bake|roast|simmer|boil|braise|slow[- ]cook|oven|pressure)\b/i;
const COOK = /\b(sear|saut[eé]|fry|stir[- ]fry|grill|brown|cook|toast|heat|melt|steam|reduce|wilt)\b/i;
const FINISH = /\b(serve|garnish|top|assemble|divide|portion|cool|rest|stir in|fold in|squeeze|sprinkle|pack)\b/i;
const PREP = /\b(chop|dice|slice|mince|grate|peel|rinse|wash|marinate|mix|whisk|combine|season|toss|measure|cut|trim|drain|mash|blend)\b/i;
const minutesIn = (t: string) => { const m = t.match(/(\d+)\s*(?:-|to)?\s*(\d+)?\s*(?:min|minutes)/i); return m ? Number(m[2] ?? m[1]) : null; };

type CookPhase = Exclude<PrepPhase, "Set up">;
function phaseOf(step: string): CookPhase {
  if (LONG.test(step)) return "Start the long cooks";
  if (PREP.test(step) && !COOK.test(step)) return "Prep";
  if (COOK.test(step)) return "Cook while those run";
  if (FINISH.test(step)) return "Finish and portion";
  return "Prep";
}
const PHASE_ORDER: CookPhase[] = ["Prep", "Start the long cooks", "Cook while those run", "Finish and portion"];

// Phases for one dish's steps. Knife work moves to the front; everything else keeps the
// dish's own order. Steps that lead into a long cook (brown the meat, then simmer) start
// with it, and nothing is ever scheduled before a step that came earlier in the recipe.
export function dishPhases(steps: string[]): CookPhase[] {
  const raw = steps.map(phaseOf);
  const lastLong = raw.lastIndexOf("Start the long cooks");
  const phases: CookPhase[] = [];
  let floor = 0;
  raw.forEach((p, i) => {
    if (p === "Prep") return phases.push("Prep");
    const wanted = i < lastLong ? 1 : PHASE_ORDER.indexOf(p);
    floor = Math.max(floor, wanted);
    phases.push(PHASE_ORDER[floor]);
  });
  return phases;
}

const qtyLabel = (l: GroceryLine) => (l.base === "count" ? `${Math.ceil(l.qty)} × ${l.name}` : `${l.display} ${l.name}`);

// One cook session: set up, do all the knife work, start the longest cooks first,
// cook the rest while they run, then finish and portion 27 containers.
export function prepSheet(dishes: Dish[], prices: PriceTable): PrepStep[] {
  const steps: PrepStep[] = [];
  const needsOven = dishes.some((d) => d.steps.some((s) => /\b(bake|roast|oven)\b/i.test(s)));
  if (needsOven) steps.push({ phase: "Set up", dish: null, text: "Preheat the oven first; the roast or bake goes in early.", minutes: null });
  steps.push({ phase: "Set up", dish: null, text: `Lay out ${TOTAL_PORTIONS} containers in 3 rows of ${PORTIONS_PER_DISH}, one row per dish, and label them.`, minutes: null });

  // Ingredients shared by 2+ dishes get one batch of knife work.
  const shared = groceryList(dishes, prices).filter((l) => l.dishes.length > 1 && /onion|garlic|pepper|tomato|cilantro|spinach|broccoli|lime|lemon/.test(l.name));
  for (const l of shared) steps.push({ phase: "Prep", dish: null, text: `Batch prep: ${qtyLabel(l)}, enough for ${l.dishes.join(", ")}.`, minutes: null });

  const byPhase = new Map<CookPhase, PrepStep[][]>();
  for (const d of dishes) {
    const phases = dishPhases(d.steps);
    const chunks = new Map<CookPhase, PrepStep[]>();
    d.steps.forEach((s, i) => {
      const list = chunks.get(phases[i]) ?? [];
      list.push({ phase: phases[i], dish: d.name, text: `${s} (×${PORTIONS_PER_DISH} batch)`, minutes: minutesIn(s) });
      chunks.set(phases[i], list);
    });
    for (const [p, chunk] of chunks) byPhase.set(p, [...(byPhase.get(p) ?? []), chunk]);
  }
  // Longest cooks start first; each dish's chain stays together and in order.
  const longest = (c: PrepStep[]) => Math.max(0, ...c.map((x) => x.minutes ?? 0));
  byPhase.get("Start the long cooks")?.sort((a, b) => longest(b) - longest(a));
  for (const p of PHASE_ORDER) for (const chunk of byPhase.get(p) ?? []) steps.push(...chunk);
  steps.push({ phase: "Finish and portion", dish: null, text: `Fill ${PORTIONS_PER_DISH} containers of each dish. Each member takes ${PORTIONS_PER_MEMBER_PER_DISH} of every dish (9 meals each).`, minutes: null });
  return steps;
}

// ---------- The whole swap ----------

export type Swap = { grocery: GroceryLine[]; prep: PrepStep[]; cost: CostSplit; portionsPerDish: number; totalPortions: number; mealsPerMember: number };

export function computeSwap(dishes: Dish[], prices: PriceTable, chef: Chef | null): Swap {
  if (dishes.length !== MEMBERS_PER_POD) throw new Error(`a swap needs ${MEMBERS_PER_POD} dishes, got ${dishes.length}`);
  const grocery = groceryList(dishes, prices);
  return {
    grocery,
    prep: prepSheet(dishes, prices),
    cost: costSplit(grocery, chef, prices.currency),
    portionsPerDish: PORTIONS_PER_DISH,
    totalPortions: TOTAL_PORTIONS,
    mealsPerMember: PORTIONS_PER_MEMBER_PER_DISH * MEMBERS_PER_POD,
  };
}
