import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type Shot } from "./api";
import { fx } from "./fx";
import { plain } from "./format";
import { fillPlan, mondayOf, pactPlan, planWith } from "./meal";
import type { Body, ChatSave, CookLog, DietId, Goal, Job, Meal, MealStage, Plan, Recipe, Recommendation, Stamp, Swap } from "./types";
import { computeProgress, xpMath, type Progress, type XpEvent } from "./xp";

// Everything lives on the phone (AsyncStorage). No accounts, no database.
type State = {
  deviceId: string;
  onboarded: boolean;
  name: string;
  goal: Goal;
  diet: DietId[]; // what Pal never suggests
  body: Body | null;
  recipe: Recipe | null; // the recipe currently open
  recipes: Recipe[];
  meal: Meal | null; // the meal you're on, from link to plate
  plan: Plan | null;
  pactWeek: string | null; // Monday of the week you made a Kitchen Pact
  events: XpEvent[];
  cookLog: CookLog[];
  stamps: Stamp[];
  feedbackAsked: number; // highest cook milestone Pal has already chatted about (1 or 3)
  feedbackPending: number; // milestone to chat about once any celebration closes (0 = none)
  chats: Record<string, ChatSave>; // saved conversations, by chat kind ("0", "1", "3")
};

const KEY = "scrollpal:v2"; // v2: the Stitch flow (onboarding, meal, pact). v1 saves are left alone.
const initial = (): State => ({
  deviceId: Math.random().toString(36).slice(2, 10),
  onboarded: false,
  name: "",
  goal: "maintain",
  diet: [],
  body: null,
  recipe: null,
  recipes: [],
  meal: null,
  plan: null,
  pactWeek: null,
  events: [],
  cookLog: [],
  stamps: [],
  feedbackAsked: 0,
  feedbackPending: 0,
  chats: {},
});

export type Celebration = { kind: "level"; level: number; math: string } | { kind: "stamp"; stamp: Stamp };
export type DoneResult = { leveledUp: boolean; level: number; stamp: Stamp | null; cooks: number };

type Ctx = State & {
  ready: boolean;
  progress: Progress;
  celebration: Celebration | null;
  clearCelebration: () => void;
  jobs: Job[];
  digest: (url: string, caption?: string, shot?: Shot) => string; // starts digesting and returns the job id; many can run at once
  dismissJob: (id: string) => void;
  saveChat: (key: string, chat: ChatSave) => void;
  clearChat: (key: string) => void;
  openRecipe: (recipe: Recipe) => void;
  setName: (name: string) => void;
  setGoal: (g: Goal) => void;
  setDiet: (d: DietId[]) => void;
  setBody: (b: Body) => void;
  finishOnboarding: () => void;
  startMeal: (recipe: Recipe, slotId?: string, tweaks?: Recommendation[]) => void;
  setSwaps: (swaps: Swap[]) => void;
  setHave: (have: string[]) => void;
  setTweaks: (tweaks: Recommendation[]) => void;
  addMealToPlan: () => void; // puts the meal you're on (with your picked fixes) into this week's plan
  setOrderUrl: (url: string) => void;
  setStage: (stage: MealStage) => void;
  cookMeal: () => DoneResult | null; // +50 XP
  eatMeal: (title?: string) => boolean; // +25 XP; true when it levelled Pal up
  makePact: (meals: number) => void;
  skipSlot: (id: string) => void;
  markFeedbackAsked: (milestone: number) => void;
  resetAll: () => void;
};

const StoreCtx = createContext<Ctx | null>(null);
const newId = () => Math.random().toString(36).slice(2, 9);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const handled = useRef(new Set<string>()); // stops a fast double tap from counting one cook or meal twice

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

  // Adds an XP event and shows the level up moment when it crosses a level.
  const addEvent = useCallback((type: XpEvent["type"]): boolean => {
    const before = computeProgress(stateRef.current.events);
    const event = { type, at: new Date().toISOString() };
    const after = computeProgress([...stateRef.current.events, event]);
    stateRef.current = { ...stateRef.current, events: [...stateRef.current.events, event] };
    update((s) => ({ ...s, events: [...s.events, event] }));
    const up = after.level > before.level;
    if (up) setCelebration({ kind: "level", level: after.level, math: xpMath(after) });
    return up;
  }, [update]);

  const addShare = useCallback((raw: Recipe): boolean => {
    const recipe: Recipe = {
      ...raw,
      title: plain(raw.title),
      steps: raw.steps.map(plain),
      ingredients: raw.ingredients.map((i) => ({ ...i, name: plain(i.name) })),
    };
    const up = addEvent("share");
    update((s) => {
      const recipes = [recipe, ...s.recipes.filter((r) => r.title !== recipe.title)].slice(0, 30);
      return { ...s, recipe, recipes, plan: s.plan && fillPlan(s.plan, recipes) };
    });
    api.event("share", stateRef.current.deviceId, recipe.title);
    return up;
  }, [update, addEvent]);

  // Pal can chew on several links at once: each one is a job with its own status.
  const [jobs, setJobs] = useState<Job[]>([]);
  const digest = useCallback((url: string, caption?: string, shot?: Shot) => {
    const id = newId();
    setJobs((j) => [{ id, url, caption, status: "digesting" }, ...j]);
    api.ingest(url, caption, shot).then(
      (recipe) => {
        if (addShare(recipe)) fx.levelUp();
        else fx.ready();
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, status: "done", title: recipe.title } : x)));
      },
      (e: ApiError) => {
        fx.error();
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, status: "failed", error: e.message, detail: e.detail, code: e.code } : x)));
      },
    );
    return id;
  }, [addShare]);
  const dismissJob = useCallback((id: string) => setJobs((j) => j.filter((x) => x.id !== id)), []);
  const saveChat = useCallback((key: string, chat: ChatSave) => update((s) => ({ ...s, chats: { ...s.chats, [key]: chat } })), [update]);
  const clearChat = useCallback((key: string) => update((s) => { const { [key]: _, ...rest } = s.chats; return { ...s, chats: rest }; }), [update]);

  const openRecipe = useCallback((recipe: Recipe) => update((s) => ({ ...s, recipe })), [update]);
  const setName = useCallback((name: string) => update((s) => ({ ...s, name })), [update]);
  const setGoal = useCallback((goal: Goal) => update((s) => ({ ...s, goal })), [update]);
  const setDiet = useCallback((diet: DietId[]) => update((s) => ({ ...s, diet })), [update]);
  const setBody = useCallback((body: Body) => update((s) => ({ ...s, body })), [update]);
  const finishOnboarding = useCallback(() => update((s) => ({ ...s, onboarded: true })), [update]);

  const setMeal = useCallback((fn: (m: Meal) => Meal) => update((s) => (s.meal ? { ...s, meal: fn(s.meal) } : s)), [update]);
  const startMeal = useCallback((recipe: Recipe, slotId?: string, tweaks?: Recommendation[]) =>
    update((s) => ({ ...s, recipe, meal: { id: newId(), recipe, swaps: [], have: [], stage: "swaps", slotId, tweaks } })), [update]);
  // Swap "from" stays exact (it matches an ingredient); what Pal says is cleaned to house style.
  const setSwaps = useCallback((swaps: Swap[]) => setMeal((m) => ({ ...m, swaps: swaps.map((x) => ({ ...x, to: plain(x.to), why: plain(x.why) })) })), [setMeal]);
  const setTweaks = useCallback((tweaks: Recommendation[]) => setMeal((m) => ({ ...m, tweaks })), [setMeal]);
  // A plan from an earlier week is finished, so the meal starts this week's plan instead.
  const addMealToPlan = useCallback(() => update((s) => {
    if (!s.meal) return s;
    const current = s.pactWeek === mondayOf() ? s.plan : null;
    return { ...s, meal: null, pactWeek: mondayOf(), plan: planWith(current, s.meal.recipe, s.meal.tweaks ?? [], s.goal) };
  }), [update]);
  const setHave = useCallback((have: string[]) => setMeal((m) => ({ ...m, have })), [setMeal]);
  const setOrderUrl = useCallback((orderUrl: string) => setMeal((m) => ({ ...m, orderUrl })), [setMeal]);
  const setStage = useCallback((stage: MealStage) => setMeal((m) => ({ ...m, stage })), [setMeal]);

  const cookMeal = useCallback((): DoneResult | null => {
    const s = stateRef.current;
    const meal = s.meal;
    if (!meal || meal.cookedAt || handled.current.has(`cook:${meal.id}`)) return null;
    handled.current.add(`cook:${meal.id}`);
    const now = new Date().toISOString();
    const recipe = meal.recipe;

    // Passport: first time cooking a cuisine stamps the cuisine; after that, a new creator gets a stamp.
    const has = (key: string) => s.stamps.some((x) => x.key === key);
    const cuisineKey = `cuisine:${recipe.cuisine.toLowerCase()}`;
    const creatorKey = `creator:${recipe.creator.toLowerCase()}`;
    const stamp: Stamp | null = !has(cuisineKey)
      ? { key: cuisineKey, label: recipe.cuisine, kind: "cuisine", at: now }
      : !has(creatorKey) && recipe.creator !== "Unknown"
        ? { key: creatorKey, label: recipe.creator, kind: "creator", at: now }
        : null;

    const leveledUp = addEvent("cook");
    const cooks = computeProgress(stateRef.current.events).cooks;
    // Pal chats after the 1st cook (one quick question) and the 3rd (a proper catch up).
    const milestone = cooks === 1 ? 1 : cooks === 3 ? 3 : 0;
    const askFeedback = milestone > 0 && s.feedbackAsked < milestone;
    update((st) => ({
      ...st,
      meal: st.meal && { ...st.meal, cookedAt: now, stage: "eat" },
      plan: st.plan && meal.slotId ? { ...st.plan, slots: st.plan.slots.map((x) => (x.id === meal.slotId ? { ...x, status: "done" } : x)) } : st.plan,
      cookLog: [...st.cookLog, { at: now, title: recipe.title, cuisine: recipe.cuisine, creator: recipe.creator }],
      stamps: stamp ? [...st.stamps, stamp] : st.stamps,
      feedbackPending: askFeedback ? milestone : st.feedbackPending,
    }));
    api.event("done", s.deviceId, recipe.title);
    if (!leveledUp && stamp) setCelebration({ kind: "stamp", stamp });
    return { leveledUp, level: computeProgress(stateRef.current.events).level, stamp, cooks };
  }, [update, addEvent]);

  // Eating the meal you cooked, or logging any meal from Home.
  const eatMeal = useCallback((title?: string): boolean => {
    const meal = stateRef.current.meal;
    const pending = meal && meal.stage === "eat" && !meal.eatenAt ? meal : null;
    const key = pending ? `eat:${pending.id}` : `eat:${Date.now()}`;
    if (handled.current.has(key)) return false;
    handled.current.add(key);
    const up = addEvent("eat");
    if (pending) update((s) => ({ ...s, meal: s.meal && { ...s.meal, eatenAt: new Date().toISOString(), stage: "done" } }));
    api.event("eat", stateRef.current.deviceId, pending?.recipe.title ?? title);
    return up;
  }, [update, addEvent]);

  const makePact = useCallback((meals: number) =>
    update((s) => ({ ...s, pactWeek: mondayOf(), plan: pactPlan({ weekStart: mondayOf(), meals }, s.recipes, s.goal) })), [update]);

  const skipSlot = useCallback((id: string) => {
    const s = stateRef.current;
    const slot = s.plan?.slots.find((x) => x.id === id);
    if (!slot || slot.status !== "planned" || handled.current.has(id)) return;
    handled.current.add(id);
    addEvent("skip");
    update((st) => ({ ...st, plan: st.plan && { ...st.plan, slots: st.plan.slots.map((x) => (x.id === id ? { ...x, status: "skipped" } : x)) } }));
    api.event("skip", s.deviceId, slot.meal);
  }, [update, addEvent]);

  const markFeedbackAsked = useCallback(
    (milestone: number) => update((s) => ({ ...s, feedbackAsked: Math.max(s.feedbackAsked, milestone), feedbackPending: 0 })),
    [update],
  );
  const resetAll = useCallback(() => update((s) => ({ ...initial(), deviceId: s.deviceId })), [update]);
  const clearCelebration = useCallback(() => setCelebration(null), []);

  const value: Ctx = {
    ...state, ready, progress, jobs, digest, dismissJob, saveChat, clearChat, celebration, clearCelebration, openRecipe,
    setName, setGoal, setDiet, setBody, finishOnboarding, startMeal, setSwaps, setHave, setTweaks, addMealToPlan, setOrderUrl, setStage, cookMeal, eatMeal,
    makePact, skipSlot, markFeedbackAsked, resetAll,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
