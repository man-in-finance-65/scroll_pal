import { useMemo } from "react";
import { cooksThisWeek, isSlow, mood, weeklyTarget } from "./mood";
import { useStore } from "./store";

// Everything Pal's look on Home depends on, in one place.
export function usePal() {
  const s = useStore();
  return useMemo(() => {
    const slots = s.plan?.slots;
    const slow = isSlow(s.events, slots);
    const weekCooks = cooksThisWeek(s.events);
    const target = weeklyTarget(slots);
    return { slow, weekCooks, target, mood: mood(slow, weekCooks, target, s.progress.cooks), level: s.progress.level };
  }, [s.events, s.plan, s.progress]);
}
