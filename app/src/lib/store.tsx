import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { ApiError } from "./api";
import { fx } from "./fx";
import type { Goal, Job, Plan, PlanFromApi, Recipe } from "./types";
import { computeProgress, localDay, type Progress, type XpEvent } from "./xp";

// Everything lives on the phone (AsyncStorage). No accounts, no database.
type State = {
  deviceId: string;
  goal: Goal;
  recipe: Recipe | null; // the recipe currently open
  recipes: Recipe[];
  plan: Plan | null;
  events: XpEvent[];
};

// Same key as before, so nobody loses their Pal. Fields older versions saved (stamps, chats…) are just ignored.
const KEY = "scrollpal:v1";
const initial = (): State => ({
  deviceId: Math.random().toString(36).slice(2, 10),
  goal: "maintain",
  recipe: null,
  recipes: [],
  plan: null,
  events: [],
});

export type Celebration = { kind: "level"; level: number };

type Ctx = State & {
  ready: boolean;
  progress: Progress;
  celebration: Celebration | null;
  clearCelebration: () => void;
  jobs: Job[];
  digest: (url: string, caption?: string) => void; // Share: starts digesting; many can run at once
  dismissJob: (id: string) => void;
  openRecipe: (recipe: Recipe) => void;
  setGoal: (g: Goal) => void;
  savePlan: (p: PlanFromApi, recipe: Recipe, goal: Goal, days: number) => void;
  eatSlot: (id: string) => Award | null; // Eat: null if this meal was already counted
  cook: (recipe: Recipe) => Award;
};

export type Award = { xp: number; leveledUp: boolean };

const StoreCtx = createContext<Ctx | null>(null);

function addDays(day: Date, n: number): string {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate() + n, 12);
  return localDay(d.toISOString());
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const handled = useRef(new Set<string>()); // stops a fast double-tap from counting one meal twice

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setState({ ...initial(), ...JSON.parse(raw) }))
      .catch((e) => console.warn("store: could not load saved progress", e))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch((e) => console.warn("store: could not save progress", e));
  }, [state, ready]);

  const progress = useMemo(() => computeProgress(state.events), [state.events]);
  const update = useCallback((fn: (s: State) => State) => setState((s) => fn(s)), []);

  // The one place XP is added. Says how much XP the event really earned (a 4th link in a day earns 0)
  // and shows the celebration on a level-up.
  const award = useCallback((e: XpEvent, change: (s: State) => State = (s) => s): Award => {
    const before = computeProgress(stateRef.current.events);
    const after = computeProgress([...stateRef.current.events, e]);
    update((s) => change({ ...s, events: [...s.events, e] }));
    const leveledUp = after.level > before.level;
    if (leveledUp) setCelebration({ kind: "level", level: after.level });
    return { xp: after.xp - before.xp, leveledUp };
  }, [update]);

  // Pal can chew on several links at once: each one is a job with its own status.
  const [jobs, setJobs] = useState<Job[]>([]);
  const digest = useCallback((url: string, caption?: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setJobs((j) => [{ id, url, caption, status: "digesting" }, ...j]);
    api.ingest(url, caption).then(
      (recipe) => {
        const got = award({ type: "share", at: new Date().toISOString() }, (s) => ({
          ...s,
          recipe,
          recipes: [recipe, ...s.recipes.filter((r) => r.title !== recipe.title)].slice(0, 30),
        }));
        api.event("share", stateRef.current.deviceId, recipe.title);
        if (got.leveledUp) fx.levelUp();
        else fx.ready();
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, status: "done", title: recipe.title, xp: got.xp } : x)));
      },
      (e: ApiError) => {
        fx.error();
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, status: "failed", error: e.message, detail: e.detail, code: e.code } : x)));
      },
    );
  }, [award]);
  const dismissJob = useCallback((id: string) => setJobs((j) => j.filter((x) => x.id !== id)), []);

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
    const plan: Plan = { id: Date.now().toString(36), createdAt: today.toISOString(), goal, days, summary: p.summary, recipe, slots };
    update((s) => ({ ...s, plan, goal }));
    api.event("plan", stateRef.current.deviceId, recipe.title);
  }, [update]);

  const eatSlot = useCallback((id: string): Award | null => {
    const slot = stateRef.current.plan?.slots.find((x) => x.id === id);
    if (!slot || slot.status !== "planned" || handled.current.has(id)) return null;
    handled.current.add(id);
    return award({ type: "eat", ref: id, at: new Date().toISOString() }, (s) => ({
      ...s,
      plan: s.plan && { ...s.plan, slots: s.plan.slots.map((x) => (x.id === id ? { ...x, status: "eaten" } : x)) },
    }));
  }, [award]);

  const cook = useCallback((recipe: Recipe): Award => {
    // The API only knows the older event names; "done" is what it counts as a cook.
    api.event("done", stateRef.current.deviceId, recipe.title);
    return award({ type: "cook", at: new Date().toISOString() });
  }, [award]);

  const clearCelebration = useCallback(() => setCelebration(null), []);

  const value: Ctx = {
    ...state, ready, progress, jobs, digest, dismissJob, celebration, clearCelebration, openRecipe, setGoal, savePlan, eatSlot, cook,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
