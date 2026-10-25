import type { Goal, PlanSlot } from "./types";
import { localDay, type XpEvent } from "./xp";

export type PalState = "listening" | "thinking" | "excited" | "helping" | "slow";

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

// This week's target, which sets Pal's energy: the cooks in your current plan (plans are at most 7 days). 3 if there's no plan yet.
export function weeklyTarget(slots: PlanSlot[] | undefined): number {
  if (!slots?.length) return 3;
  return Math.max(1, slots.filter((s) => s.kind === "cook").length);
}

// A planned cook whose day has passed and is still untouched counts as missed.
export function missedCooks(slots: PlanSlot[] | undefined, now = new Date()): PlanSlot[] {
  const today = localDay(now.toISOString());
  return (slots ?? []).filter((s) => s.kind === "cook" && s.status === "planned" && s.date < today);
}

// Pal goes slow after a missed cook and stays slow until the next cook.
export function isSlow(events: XpEvent[], slots: PlanSlot[] | undefined, now = new Date()): boolean {
  const lastCook = [...events].reverse().find((e) => e.type === "cook")?.at ?? "";
  // A missed day "happens" at the end of that day.
  return missedCooks(slots, now).some((s) => {
    const [y, m, d] = s.date.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59).toISOString() > lastCook;
  });
}

export type Mood = { energy: number; label: string; line: string };

export function mood(slow: boolean, weekCooks: number, target: number, totalCooks: number): Mood {
  const ratio = Math.min(1, weekCooks / target);
  const energy = slow ? 0.25 : 0.45 + 0.55 * ratio;
  if (slow) return { energy, label: "Slow", line: "Feeling slow. Cook with me?" };
  if (totalCooks === 0) return { energy, label: "Curious", line: "Feed me a recipe!" };
  if (ratio >= 1) return { energy, label: "Fired up", line: "I'm so fired up!" };
  if (weekCooks > 0) return { energy, label: "Happy", line: "More, chef!" };
  return { energy, label: "Hungry", line: "I'm hungry. Cook with me?" };
}

// How Pal's body looks. Bulk builds up (broader, sturdier); cut gets leaner and lighter
// (taller, slimmer, floats higher). Pal never gets smaller as a reward.
export type Body = { sx: number; sy: number; float: number; glow: number };

export function bodyFor(goal: Goal, cooks: number): Body {
  const p = Math.min(cooks, 12) / 12;
  if (goal === "bulk") return { sx: 1 + 0.16 * p, sy: 1 + 0.06 * p, float: 0, glow: p };
  if (goal === "cut") return { sx: 1 - 0.1 * p, sy: 1 + 0.1 * p, float: 10 * p, glow: p };
  return { sx: 1 + 0.03 * p, sy: 1 + 0.03 * p, float: 3 * p, glow: p };
}
