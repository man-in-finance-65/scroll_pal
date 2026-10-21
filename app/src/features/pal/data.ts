// Demo recipes so the full flow works before any reel is processed.
// Per-100 g values are typical USDA FoodData Central figures, entered by hand and marked
// approximate; real recipes get live USDA lookups. Calories and protein are always computed
// by the engine from these grams, never written by an AI.
import type { Recipe } from "../../../../engine/recipe.ts";

type DemoRecipe = Recipe & { minutes: number; tag: string; steps: string[] };

const i = (name: string, grams: number, kcal: number, proteinG: number) => ({ name, grams, per100g: { kcal, proteinG }, confirmed: true });

export const DEMO_RECIPES: DemoRecipe[] = [
  {
    id: "yogurt-oats", title: "Berry Greek yogurt oats", servings: 1, minutes: 5, tag: "Breakfast",
    ingredients: [i("Greek yogurt, plain nonfat", 200, 59, 10.2), i("Rolled oats", 50, 379, 13.2), i("Blueberries", 80, 57, 0.7), i("Honey", 10, 304, 0.3)],
    steps: ["Stir the oats into the yogurt.", "Top with blueberries and a drizzle of honey.", "Eat now, or leave in the fridge overnight."],
  },
  {
    id: "egg-toast", title: "Spinach egg scramble on toast", servings: 1, minutes: 10, tag: "Breakfast",
    ingredients: [i("Eggs", 150, 143, 12.6), i("Spinach", 60, 23, 2.9), i("Whole-wheat bread", 70, 252, 12.4), i("Olive oil", 5, 884, 0)],
    steps: ["Warm the oil in a pan and wilt the spinach.", "Add the beaten eggs and stir gently until just set.", "Toast the bread and pile the eggs on top."],
  },
  {
    id: "cottage-bowl", title: "Cottage cheese peanut bowl", servings: 1, minutes: 3, tag: "Snack",
    ingredients: [i("Cottage cheese, 2%", 200, 81, 10.5), i("Banana", 100, 89, 1.1), i("Peanut butter", 15, 588, 25)],
    steps: ["Spoon the cottage cheese into a bowl.", "Slice the banana on top.", "Finish with peanut butter."],
  },
  {
    id: "chicken-bowl", title: "Garlic chicken rice bowl", servings: 2, minutes: 25, tag: "Lunch",
    ingredients: [i("Chicken breast, cooked", 300, 165, 31), i("White rice, cooked", 300, 130, 2.7), i("Broccoli", 200, 35, 2.4), i("Olive oil", 10, 884, 0)],
    steps: ["Cook the rice.", "Sear the chicken in the oil with garlic, then slice.", "Steam the broccoli for 4 minutes.", "Split everything across two bowls."],
  },
  {
    id: "turkey-wrap", title: "Turkey avocado wrap", servings: 1, minutes: 5, tag: "Lunch",
    ingredients: [i("Turkey breast, sliced", 100, 104, 17), i("Flour tortilla", 70, 310, 8.3), i("Avocado", 50, 160, 2), i("Spinach", 30, 23, 2.9)],
    steps: ["Lay out the tortilla.", "Layer the turkey, spinach and sliced avocado.", "Roll tightly and cut in half."],
  },
  {
    id: "salmon-potatoes", title: "Sheet-pan salmon and potatoes", servings: 2, minutes: 30, tag: "Dinner",
    ingredients: [i("Salmon, cooked", 300, 206, 22.1), i("Potatoes, baked", 400, 93, 2.5), i("Green beans", 200, 31, 1.8), i("Olive oil", 10, 884, 0)],
    steps: ["Heat the oven to 220 °C.", "Toss the potato chunks in oil and roast for 15 minutes.", "Add the salmon and green beans and roast 12 minutes more."],
  },
  {
    id: "beef-pasta", title: "Lean beef bolognese", servings: 3, minutes: 30, tag: "Dinner",
    ingredients: [i("Ground beef 90% lean, cooked", 400, 217, 26.1), i("Pasta, cooked", 450, 158, 5.8), i("Tomato sauce", 400, 29, 1.3), i("Onion", 100, 40, 1.1)],
    steps: ["Brown the beef with the chopped onion.", "Add the tomato sauce and simmer 15 minutes.", "Cook the pasta and toss it through the sauce."],
  },
  {
    id: "tofu-stirfry", title: "Crispy tofu stir-fry", servings: 2, minutes: 20, tag: "Dinner",
    ingredients: [i("Firm tofu", 400, 144, 17.3), i("White rice, cooked", 300, 130, 2.7), i("Bell pepper", 150, 26, 1), i("Soy sauce", 30, 53, 8.1)],
    steps: ["Press and cube the tofu, then pan-fry until golden.", "Add the sliced pepper for 3 minutes.", "Splash in the soy sauce and serve over rice."],
  },
  {
    id: "lentil-curry", title: "Coconut lentil curry", servings: 3, minutes: 35, tag: "Dinner",
    ingredients: [i("Lentils, cooked", 500, 116, 9), i("Coconut milk, canned", 200, 230, 2.3), i("Tomatoes, canned", 200, 32, 1.6), i("White rice, cooked", 300, 130, 2.7)],
    steps: ["Simmer the lentils, tomatoes and coconut milk with curry spices for 20 minutes.", "Season to taste.", "Serve over rice."],
  },
  {
    id: "bean-bowl", title: "Black bean burrito bowl", servings: 2, minutes: 15, tag: "Lunch",
    ingredients: [i("Black beans, cooked", 300, 132, 8.9), i("Chicken breast, cooked", 200, 165, 31), i("White rice, cooked", 250, 130, 2.7), i("Salsa", 100, 36, 1.5)],
    steps: ["Warm the beans and chicken.", "Build bowls on the rice.", "Top with salsa."],
  },
];
