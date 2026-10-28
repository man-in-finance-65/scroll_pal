// What a user never wants Pal to suggest. The AI is told, and every suggestion is checked here too,
// so a vegan never sees eggs even if the AI slips.

export const DIETS: Record<string, { label: string; never: RegExp }> = {
  vegetarian: { label: "vegetarian (no meat or fish)", never: /chicken|beef|pork|bacon|ham\b|turkey|lamb|steak|mince|sausage|salami|prosciutto|chorizo|fish|salmon|tuna|cod\b|shrimp|prawn|crab|lobster|anchov|sardine|gelatin|meat/i },
  vegan: { label: "vegan (no animal products)", never: /chicken|beef|pork|bacon|ham\b|turkey|lamb|steak|mince|sausage|salami|prosciutto|chorizo|fish|salmon|tuna|cod\b|shrimp|prawn|crab|lobster|anchov|sardine|gelatin|meat|egg|milk|cheese|yogh?urt|cream|butter|ghee|whey|honey|cottage|paneer|skyr|kefir|ricotta|feta|parmesan|mozzarella/i },
  no_dairy: { label: "no dairy", never: /milk|cheese|yogh?urt|cream|butter|ghee|whey|cottage|paneer|skyr|kefir|ricotta|feta|parmesan|mozzarella/i },
  no_eggs: { label: "no eggs", never: /egg/i },
  gluten_free: { label: "gluten free", never: /wheat|bread|pasta|couscous|barley|\brye\b|seitan|wrap|tortilla|pita|bagel|noodle|flour|bulgur/i },
  no_pork: { label: "no pork", never: /pork|bacon|ham\b|salami|prosciutto|chorizo|lard/i },
  no_nuts: { label: "nut allergy", never: /nut\b|nuts|almond|cashew|walnut|pecan|pistachio|hazelnut|peanut|macadamia/i },
  no_shellfish: { label: "shellfish allergy", never: /shrimp|prawn|crab|lobster|scallop|mussel|clam|oyster|shellfish/i },
};

// Plant versions are fine for vegan and dairy free: "soy yogurt" is not yogurt, "almond milk" is not milk.
const PLANT = /\b(soy|soya|coconut|oat|almond|cashew|rice|plant|vegan|dairy free|pea|flax)\s+(milk|yogh?urt|cream|cheese|butter)\b/gi;
// "Egg free", "no cheese" and "skip the butter" say what to leave out, which is fine.
// Only the one word right after, so "less oil and add chicken" still catches the chicken.
const LEAVE_OUT = /\b(no|without|skip|instead of|swap out|less|halve|half|drop)\s+(the\s+)?[a-z]+/gi;

export function breaksDiet(text: string, diet: string[] = []): string | null {
  const t = text.replace(PLANT, " ").replace(LEAVE_OUT, " ");
  for (const id of diet) {
    const d = DIETS[id];
    if (!d) continue;
    if (id === "no_nuts" && /\b(nuts?|almond|cashew)\s+(milk|butter)\b/i.test(text)) return id; // plant milks still have nuts
    if (d.never.test(t)) return id;
  }
  return null;
}

export const dietWords = (diet: string[] = []) => diet.map((id) => DIETS[id]?.label).filter(Boolean).join(", ");
