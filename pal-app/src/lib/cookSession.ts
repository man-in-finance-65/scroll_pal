import type { Dish, Slot } from "./types";

// The dish being cooked, handed from the screen that opened Cook with Me. Kept in memory only: if the app is
// closed mid-cook you start again from the plan or the recipe.
let current: { dish: Dish; day?: string; slot?: Slot } | null = null;
export const startCook = (dish: Dish, day?: string, slot?: Slot) => void (current = { dish, day, slot });
export const currentCook = () => current;
