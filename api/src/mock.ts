import type { Plan, Recipe } from "./schema.js";

export const MOCK_RECIPE: Recipe = {
  title: "Gochujang Chicken Rice Bowl",
  creator: "@mockchef",
  cuisine: "Korean",
  servings: 2,
  ingredients: [
    { name: "chicken thighs, boneless", qty: 400, unit: "g", source: "stated" },
    { name: "gochujang", qty: 2, unit: "tbsp", source: "stated" },
    { name: "soy sauce", qty: 1, unit: "tbsp", source: "stated" },
    { name: "honey", qty: 1, unit: "tbsp", source: "estimated" },
    { name: "garlic", qty: 3, unit: "cloves", source: "stated" },
    { name: "cooked rice", qty: 2, unit: "cups", source: "estimated" },
    { name: "cucumber", qty: 1, unit: "", source: "stated" },
    { name: "spring onion", qty: 2, unit: "stalks", source: "estimated" },
  ],
  steps: [
    "Mix gochujang, soy sauce, honey and grated garlic.",
    "Toss the chicken in half the sauce and rest 10 minutes.",
    "Sear the chicken 5–6 minutes per side until charred and cooked through.",
    "Slice, brush with the rest of the sauce.",
    "Serve over rice with sliced cucumber and spring onion.",
  ],
  prep_minutes: 15,
  cook_minutes: 12,
  macros_per_serving: { kcal: 640, protein_g: 46, carbs_g: 72, fat_g: 17, source: "estimated" },
  confidence: 0.82,
};

export function mockPlan(goal: string, days: number): Plan {
  const extra =
    goal === "bulk" ? "Add a second scoop of rice." : goal === "cut" ? "Swap half the rice for extra cucumber." : "Keep the portion as written.";
  return {
    summary: `${days}-day ${goal} plan built around your gochujang bowl.`,
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      slots: [
        { slot: "lunch" as const, meal: "Greek yogurt, berries and granola", uses_recipe: false, note: "Quick, high protein." },
        i % 2 === 0
          ? { slot: "dinner" as const, meal: "Gochujang Chicken Rice Bowl", uses_recipe: true, note: extra }
          : { slot: "dinner" as const, meal: "Leftover gochujang chicken wrap", uses_recipe: true, note: "Use last night's chicken." },
      ],
    })),
  };
}
