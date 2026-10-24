import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeName } from "./pantry";
import type { CartItem, Cook, Dish, Goal, Recipe, SavedRecipe, Slot, Targets } from "./types";

// Everything Pal knows about you lives here, on the phone (AsyncStorage). No accounts, no cloud copy.

export type Plan = Record<string, Partial<Record<Slot, Dish>>>; // key: "2026-10-26"

type State = {
  goal: Goal;
  targets: Record<Goal, Targets>;
  recipes: SavedRecipe[];
  plan: Plan;
  /** Staples you have at home (normalized names), from pantry scans and your own edits. */
  pantry: string[];
  cart: CartItem[];
  /** Cart lines you un-ticked by hand (normalized names), on top of what the pantry covers. */
  cartOff: string[];
  cooks: Cook[];
};

// Starting targets per goal. They are your targets, not facts: edit them on the Sous Chef tab.
const DEFAULT_TARGETS: Record<Goal, Targets> = {
  bulk: { calories: 2800, protein_g: 160 },
  cut: { calories: 1800, protein_g: 150 },
  maintain: { calories: 2200, protein_g: 120 },
  keto: { calories: 2000, protein_g: 110 },
  high_protein: { calories: 2200, protein_g: 170 },
};

const INITIAL: State = { goal: "high_protein", targets: DEFAULT_TARGETS, recipes: [], plan: {}, pantry: [], cart: [], cartOff: [], cooks: [] };
const KEY = "pal-state-v1";

export function dishFrom(saved: SavedRecipe, version: Dish["version"] = "original", over: Partial<Dish> = {}): Dish {
  const r = saved.recipe;
  return {
    recipeId: saved.id,
    version,
    goal: null,
    title: r.recipe.title,
    creator: r.creator,
    ingredients: r.ingredients,
    instructions: r.instructions,
    macros: r.macros,
    totalMin: r.recipe.prep_min + r.recipe.cook_min,
    swapsOn: [],
    ...over,
  };
}

/** Adds a dish's ingredients to the cart. Same name + same unit add up; anything else stays its own line. */
function mergeCart(cart: CartItem[], dish: Dish): CartItem[] {
  const out = cart.map((c) => ({ ...c, from: [...c.from] }));
  for (const i of dish.ingredients) {
    const key = normalizeName(i.name);
    const hit = out.find((c) => normalizeName(c.name) === key && c.unit === i.unit);
    if (hit) {
      if (hit.quantity !== null) hit.quantity = Number((hit.quantity + i.quantity).toFixed(3));
      if (!hit.from.includes(dish.title)) hit.from.push(dish.title);
    } else {
      out.push({ name: i.name, quantity: i.quantity, unit: i.unit, from: [dish.title], isStaple: i.is_staple });
    }
  }
  return out;
}

function useActions(set: (f: (s: State) => State) => void) {
  return useMemo(
    () => ({
      setGoal: (goal: Goal) => set((s) => ({ ...s, goal })),
      setTargets: (goal: Goal, t: Targets) => set((s) => ({ ...s, targets: { ...s.targets, [goal]: t } })),
      saveRecipe: (recipe: Recipe, note: string | null): string => {
        const id = recipe.creator.video_url;
        set((s) => ({ ...s, recipes: [{ id, recipe, note, savedAt: Date.now() }, ...s.recipes.filter((r) => r.id !== id)] }));
        return id;
      },
      deleteRecipe: (id: string) => set((s) => ({ ...s, recipes: s.recipes.filter((r) => r.id !== id) })),
      planDish: (day: string, slot: Slot, dish: Dish) => set((s) => ({ ...s, plan: { ...s.plan, [day]: { ...s.plan[day], [slot]: dish } } })),
      unplan: (day: string, slot: Slot) =>
        set((s) => {
          const d = { ...s.plan[day] };
          delete d[slot];
          return { ...s, plan: { ...s.plan, [day]: d } };
        }),
      addToCart: (dishes: Dish[]) => set((s) => ({ ...s, cart: dishes.reduce(mergeCart, s.cart) })),
      clearCart: () => set((s) => ({ ...s, cart: [], cartOff: [] })),
      toggleCartLine: (name: string) =>
        set((s) => {
          const k = normalizeName(name);
          return { ...s, cartOff: s.cartOff.includes(k) ? s.cartOff.filter((x) => x !== k) : [...s.cartOff, k] };
        }),
      addPantry: (names: string[]) => set((s) => ({ ...s, pantry: [...new Set([...s.pantry, ...names.map(normalizeName).filter(Boolean)])].sort() })),
      removePantry: (name: string) => set((s) => ({ ...s, pantry: s.pantry.filter((p) => p !== name) })),
      logCook: (cook: Cook) => set((s) => ({ ...s, cooks: [...s.cooks, cook] })),
      reset: () => set(() => INITIAL),
    }),
    [set],
  );
}

type Store = State & { ready: boolean } & ReturnType<typeof useActions>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(INITIAL);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setState({ ...INITIAL, ...(JSON.parse(raw) as Partial<State>) });
      })
      .catch((e) => console.error("Could not read saved Pal data:", e))
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    // Never overwrite saved data with the empty starting state before it has been read.
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch((e) => console.error("Could not save Pal data:", e));
  }, [state]);

  const actions = useActions(setState);
  return <Ctx.Provider value={{ ...state, ready, ...actions }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

/** Monday-first dates of the week containing `d`, as "YYYY-MM-DD" (local time). */
export function weekDays(d = new Date()): string[] {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
}
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
