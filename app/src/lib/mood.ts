import type { PalMood } from "../components/Pal";
import type { PlanSlot } from "./types";
import { localDay, type XpEvent } from "./xp";


// Monday 00:00 of this week, in the phone's time zone.
export function weekStart(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d;
}

export function cooksThisWeek(events: XpEvent[], now = new Date()): number {
  const start = weekStart(now).getTime();
  return events.filter((e) => e.type === "cook" && new Date(e.at).getTime() >= start).length;
}

// The ring's target: the cooks in your current plan (plans are at most 7 days). 3 if there's no plan yet.
export function weeklyTarget(slots: PlanSlot[] | undefined): number {
  if (!slots?.length) return 3;
  return Math.max(1, slots.filter((s) => s.kind === "cook").length);
}

// A planned cook whose day has passed without Done counts as missed.
export function missedCooks(slots: PlanSlot[] | undefined, now = new Date()): PlanSlot[] {
  const today = localDay(now.toISOString());
  return (slots ?? []).filter((s) => s.kind === "cook" && s.status === "planned" && s.date < today);
}

// Pal goes slow after a skip (or a missed cook) and stays slow until the next Done.
export function isSlow(events: XpEvent[], slots: PlanSlot[] | undefined, now = new Date()): boolean {
  const lastCook = [...events].reverse().find((e) => e.type === "cook")?.at ?? "";
  const lastSkip = [...events].reverse().find((e) => e.type === "skip")?.at ?? "";
  if (lastSkip && lastSkip > lastCook) return true;
  // A missed day "happens" at the end of that day.
  return missedCooks(slots, now).some((s) => {
    const [y, m, d] = s.date.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59).toISOString() > lastCook;
  });
}

export type Mood = { pal: PalMood; label: string; line: string };

// What Pal looks like and says on Home. Pal starts a little chubby and gets fit once you've cooked a few meals.
export const FIT_AFTER_COOKS = 3;

export function mood(slow: boolean, weekCooks: number, target: number, totalCooks: number): Mood {
  const body: PalMood = totalCooks >= FIT_AFTER_COOKS ? "fit" : "chubby";
  if (slow) return { pal: "worried", label: "Sluggish", line: "We missed a cook. I feel heavy. One meal and I'm back." };
  if (totalCooks === 0) return { pal: "cheeky", label: "Hungry", line: "Feed me a food video. I'll turn it into dinner." };
  const left = target - weekCooks;
  if (left <= 0) return { pal: "cheer", label: "Fired up", line: "Week done! Look at me glow." };
  if (weekCooks > 0) return { pal: body, label: "Happy", line: `${left} more ${left === 1 ? "cook" : "cooks"} and our week is done.` };
  return { pal: body, label: "Hungry", line: "Nothing cooked this week. Let's fix that." };
}
