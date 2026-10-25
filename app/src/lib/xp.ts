// XP and level rules. Pure functions, no React, so they are easy to test (see xp.test.ts).
//
// Plain English:
// - Only three things earn XP: share a recipe link (10), eat a planned meal (25), cook with Pal (50).
// - Shares: only the first 3 each day count (owner's rule from 2026-10-23, kept).
// - Eating: each planned meal counts once, however many times "I ate this" is tapped.
// - Cooking: no limit.
// - Every level costs the same flat amount of XP.

export const SHARE_XP = 10;
export const EAT_XP = 25;
export const COOK_XP = 50;
export const SHARE_CAP_PER_DAY = 3;
// Placeholder until the owner confirms the number.
export const XP_PER_LEVEL = 100;

// `ref` on an eat is the planned meal's id: that is what makes "once per meal" checkable here.
export type XpEvent = { type: "share" | "cook"; at: string } | { type: "eat"; at: string; ref: string };

export type Progress = {
  level: number;
  xp: number;
  shares: number; // shares that earned XP
  eats: number; // meals that earned XP
  cooks: number;
  xpIntoLevel: number; // XP earned since the start of the current level
  xpToNext: number; // XP still needed for the next level
};

// Calendar day in the phone's own time zone, e.g. "2026-10-23".
export function localDay(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function computeProgress(events: XpEvent[]): Progress {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const sharesPerDay = new Map<string, number>();
  const eaten = new Set<string>();
  let shares = 0;
  let cooks = 0;

  for (const e of sorted) {
    if (e.type === "share") {
      const day = localDay(e.at);
      const today = sharesPerDay.get(day) ?? 0;
      if (today < SHARE_CAP_PER_DAY) {
        sharesPerDay.set(day, today + 1);
        shares++;
      }
    } else if (e.type === "eat") {
      eaten.add(e.ref);
    } else if (e.type === "cook") {
      cooks++;
    }
    // Anything else (e.g. "skip" events saved by older versions of the app) earns nothing.
  }

  const eats = eaten.size;
  const xp = shares * SHARE_XP + eats * EAT_XP + cooks * COOK_XP;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return {
    level: 1 + Math.floor(xp / XP_PER_LEVEL),
    xp,
    shares,
    eats,
    cooks,
    xpIntoLevel,
    xpToNext: XP_PER_LEVEL - xpIntoLevel,
  };
}
