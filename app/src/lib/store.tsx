import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { num } from "./format";
import type { ChecklistItem, CookLog, Goal, Plan, PlanFromApi, Recipe, Stamp } from "./types";
import { computeProgress, localDay, xpMath, type Progress, type XpEvent } from "./xp";

// Everything lives on the phone (AsyncStorage). No accounts, no database.
type State = {
  deviceId: string;
  goal: Goal;
  recipe: Recipe | null; // the recipe currently open
  recipes: Recipe[];
  plan: Plan | null;
  events: XpEvent[];
  cookLog: CookLog[];
  stamps: Stamp[];
  checklist: ChecklistItem[];
  feedbackShown: boolean;
  feedbackPending: boolean; // 3rd cook done; show the feedback screen once any celebration closes
};

const KEY = "scrollpal:v1";
const initial = (): State => ({
  deviceId: Math.random().toString(36).slice(2, 10),
  goal: "maintain",
  recipe: null,
  recipes: [],
  plan: null,
  events: [],
  cookLog: [],
  stamps: [],
  checklist: [],
  feedbackShown: false,
  feedbackPending: false,
});

export type Celebration = { kind: "level"; level: number; math: string } | { kind: "stamp"; stamp: Stamp };
export type DoneResult = { leveledUp: boolean; level: number; stamp: Stamp | null; cooks: number; askFeedback: boolean };

type Ctx = State & {
  ready: boolean;
  progress: Progress;
  celebration: Celebration | null;
  clearCelebration: () => void;
  addShare: (recipe: Recipe) => void;
  openRecipe: (recipe: Recipe) => void;
  setGoal: (g: Goal) => void;
  savePlan: (p: PlanFromApi, recipe: Recipe, goal: Goal, days: number) => void;
  confirmPlan: () => number;
  completeSlot: (id: string) => DoneResult | null;
  skipSlot: (id: string) => void;
  toggleItem: (i: number) => void;
  markFeedbackShown: () => void;
  resetAll: () => void;
};

const StoreCtx = createContext<Ctx | null>(null);

function addDays(day: Date, n: number): string {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate() + n, 12);
  return localDay(d.toISOString());
}

// Grocery checklist = the recipe's ingredients × the number of fresh batches in the plan.
function buildChecklist(plan: Plan): ChecklistItem[] {
  const batches = Math.max(1, plan.slots.filter((s) => s.kind === "cook").length);
  return plan.recipe.ingredients.map((i) => {
    if (i.qty === null) return { name: i.name, amount: i.unit || "to taste", math: null, estimated: i.source === "estimated", checked: false };
    const total = i.qty * batches;
    const unit = i.unit ? ` ${i.unit}` : "";
    return {
      name: i.name,
      amount: `${num(total, 2)}${unit}`,
      math: batches > 1 ? `${num(i.qty, 2)}${unit} × ${batches} batches` : null,
      estimated: i.source === "estimated",
      checked: false,
    };
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const handled = useRef(new Set<string>()); // stops a fast double-tap from counting one cook twice

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setState({ ...initial(), ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const progress = useMemo(() => computeProgress(state.events), [state.events]);
  const update = useCallback((fn: (s: State) => State) => setState((s) => fn(s)), []);

  const addShare = useCallback((recipe: Recipe) => {
    update((s) => ({
      ...s,
      recipe,
      recipes: [recipe, ...s.recipes.filter((r) => r.title !== recipe.title)].slice(0, 30),
      events: [...s.events, { type: "share", at: new Date().toISOString() }],
    }));
    api.event("share", stateRef.current.deviceId, recipe.title);
  }, [update]);

  const openRecipe = useCallback((recipe: Recipe) => update((s) => ({ ...s, recipe })), [update]);
  const setGoal = useCallback((goal: Goal) => update((s) => ({ ...s, goal })), [update]);

  const savePlan = useCallback((p: PlanFromApi, recipe: Recipe, goal: Goal, days: number) => {
    const today = new Date();
    const slots = p.days.flatMap((d) =>
      d.slots.map((sl, i) => ({
        id: `${d.day}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        day: d.day,
        date: addDays(today, d.day - 1),
        slot: sl.slot,
        meal: sl.meal,
        kind: sl.kind,
        note: sl.note,
        status: "planned" as const,
      })),
    );
    const plan: Plan = { id: Date.now().toString(36), createdAt: today.toISOString(), goal, days, summary: p.summary, recipe, slots, confirmed: false };
    update((s) => ({ ...s, plan, goal }));
    api.event("plan", stateRef.current.deviceId, recipe.title);
  }, [update]);

  const confirmPlan = useCallback(() => {
    const plan = stateRef.current.plan;
    if (!plan) return 0;
    const checklist = buildChecklist(plan);
    update((s) => ({ ...s, plan: s.plan && { ...s.plan, confirmed: true }, checklist }));
    return checklist.length;
  }, [update]);

  const completeSlot = useCallback((id: string): DoneResult | null => {
    const s = stateRef.current;
    const slot = s.plan?.slots.find((x) => x.id === id);
    if (!s.plan || !slot || slot.status === "done" || handled.current.has(id)) return null;
    handled.current.add(id);
    const now = new Date().toISOString();
    const recipe = s.plan.recipe;
    const before = computeProgress(s.events);
    const events = [...s.events, { type: "cook" as const, at: now }];
    const after = computeProgress(events);

    // Passport: first time cooking a cuisine stamps the cuisine; after that, a new creator gets a stamp.
    const has = (key: string) => s.stamps.some((x) => x.key === key);
    const cuisineKey = `cuisine:${recipe.cuisine.toLowerCase()}`;
    const creatorKey = `creator:${recipe.creator.toLowerCase()}`;
    const stamp: Stamp | null = !has(cuisineKey)
      ? { key: cuisineKey, label: recipe.cuisine, kind: "cuisine", at: now }
      : !has(creatorKey) && recipe.creator !== "Unknown"
        ? { key: creatorKey, label: recipe.creator, kind: "creator", at: now }
        : null;

    const askFeedback = after.cooks >= 3 && !s.feedbackShown;
    update((st) => ({
      ...st,
      events,
      plan: st.plan && { ...st.plan, slots: st.plan.slots.map((x) => (x.id === id ? { ...x, status: "done" } : x)) },
      cookLog: [...st.cookLog, { at: now, title: recipe.title, cuisine: recipe.cuisine, creator: recipe.creator }],
      stamps: stamp ? [...st.stamps, stamp] : st.stamps,
      feedbackPending: st.feedbackPending || askFeedback,
    }));
    api.event("done", s.deviceId, slot.meal);

    const leveledUp = after.level > before.level;
    if (leveledUp) setCelebration({ kind: "level", level: after.level, math: xpMath(after) });
    else if (stamp) setCelebration({ kind: "stamp", stamp });
    return { leveledUp, level: after.level, stamp, cooks: after.cooks, askFeedback };
  }, [update]);

  const skipSlot = useCallback((id: string) => {
    const s = stateRef.current;
    const slot = s.plan?.slots.find((x) => x.id === id);
    if (!slot || slot.status !== "planned" || handled.current.has(id)) return;
    handled.current.add(id);
    update((st) => ({
      ...st,
      events: [...st.events, { type: "skip", at: new Date().toISOString() }],
      plan: st.plan && { ...st.plan, slots: st.plan.slots.map((x) => (x.id === id ? { ...x, status: "skipped" } : x)) },
    }));
    api.event("skip", s.deviceId, slot.meal);
  }, [update]);

  const toggleItem = useCallback((i: number) =>
    update((s) => ({ ...s, checklist: s.checklist.map((c, j) => (j === i ? { ...c, checked: !c.checked } : c)) })), [update]);
  const markFeedbackShown = useCallback(() => update((s) => ({ ...s, feedbackShown: true, feedbackPending: false })), [update]);
  const resetAll = useCallback(() => update((s) => ({ ...initial(), deviceId: s.deviceId })), [update]);
  const clearCelebration = useCallback(() => setCelebration(null), []);

  const value: Ctx = {
    ...state, ready, progress, celebration, clearCelebration, addShare, openRecipe, setGoal, savePlan,
    confirmPlan, completeSlot, skipSlot, toggleItem, markFeedbackShown, resetAll,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
