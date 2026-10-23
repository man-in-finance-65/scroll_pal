import { useMemo } from "react";
import { bodyFor, cooksThisWeek, isSlow, mood, weeklyTarget } from "./mood";
import { useStore } from "./store";

// Everything Pal's look depends on, in one place.
export function usePal() {
  const s = useStore();
  return useMemo(() => {
    const slots = s.plan?.slots;
    const slow = isSlow(s.events, slots);
    const weekCooks = cooksThisWeek(s.events);
    const target = weeklyTarget(slots);
    const m = mood(slow, weekCooks, target, s.progress.cooks);
    return { slow, weekCooks, target, mood: m, body: bodyFor(s.goal, s.progress.cooks), level: s.progress.level };
  }, [s.events, s.plan, s.goal, s.progress]);
}
