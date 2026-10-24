// Turns what the vision model saw ("Extra Virgin Olive Oil", "kosher salt", "2 garlic bulbs") into plain names
// that match recipe ingredients. Copy of pal-server/src/pantry.ts so the app matches names the same way as the server;
// keep them in sync.

const DESCRIPTORS = /\b(extra virgin|virgin|kosher|sea|table|iodized|fine|coarse|ground|dried|fresh|organic|whole|large|small|jar of|bottle of|bag of|can of|box of)\b/g;

// Different words for the same staple. Keys and values are already normalized.
const SYNONYMS: Record<string, string> = {
  "evoo": "olive oil",
  "black pepper": "pepper",
  "peppercorn": "pepper",
  "garlic clove": "garlic",
  "garlic bulb": "garlic",
  "soya sauce": "soy sauce",
  "all purpose flour": "flour",
  "white sugar": "sugar",
  "granulated sugar": "sugar",
  "canola oil": "vegetable oil",
};

const singular = (w: string) =>
  w.length > 3 && !/(ss|us|is)$/.test(w) ? w.replace(/ies$/, "y").replace(/(oes|ches|shes)$/, (m) => m.slice(0, -2)).replace(/s$/, "") : w;

export function normalizeName(raw: string): string {
  const base = raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[\d/.,]+\s*(g|kg|ml|l|oz|lb)?\b/g, " ")
    .replace(/-/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(DESCRIPTORS, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(" ");
  return SYNONYMS[base] ?? base;
}

/** Normalized, de-duplicated, sorted list. Throws on anything that is not a list of strings. */
export function normalizePantryList(items: unknown): string[] {
  if (!Array.isArray(items) || items.some((i) => typeof i !== "string")) {
    throw new Error(`expected a list of ingredient names, got ${JSON.stringify(items)?.slice(0, 200)}`);
  }
  return [...new Set(items.map(normalizeName).filter(Boolean))].sort();
}
