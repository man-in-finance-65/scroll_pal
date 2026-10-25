// XP and level rules. Pure functions, no React, so they are easy to test (see xp.test.ts).
//
// Plain English:
// - Feeding Pal a link gives 10 XP. Only the first 3 links each day count.
// - Cooking a meal gives 50 XP.
// - Eating it gives 25 XP. Only the first 3 meals each day count.
// - Every 100 XP is one level. One full loop (link, cook, eat) is 85 XP.
// - Skipping a planned cook never takes XP or a level away.
// (Owner's call, 2026-10-25: share 10, eat 25, cook 50.)

export const SHARE_XP = 10;
export const SHARE_CAP_PER_DAY = 3;
export const COOK_XP = 50;
export const EAT_XP = 25;
export const EAT_CAP_PER_DAY = 3;
export const XP_PER_LEVEL = 100;

export type XpEvent = { type: "share" | "cook" | "eat" | "skip"; at: string };

export type Progress = {
  level: number;
  xp: number;
  cooks: number;
  cookXp: number;
  eats: number;
  eatXp: number;
  sharesTotal: number;
  sharesCounted: number;
  shareXp: number;
  xpIntoLevel: number; // XP earned since the start of the current level
  xpForNext: number; // XP needed to reach the next level, measured from the start of the current level
};

// Calendar day in the phone's own time zone, e.g. "2026-10-23".
export function localDay(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const levelForXp = (xp: number) => 1 + Math.floor(xp / XP_PER_LEVEL);

export function computeProgress(events: XpEvent[]): Progress {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const perDay = new Map<string, number>(); // "share:2026-10-23" -> how many counted that day
  let xp = 0;
  let level = 1;
  let cooks = 0;
  let eats = 0;
  let sharesTotal = 0;
  let sharesCounted = 0;

  // True when this event still fits under its daily cap (and counts it).
  const underCap = (kind: string, at: string, cap: number) => {
    const key = `${kind}:${localDay(at)}`;
    const n = perDay.get(key) ?? 0;
    if (n >= cap) return false;
    perDay.set(key, n + 1);
    return true;
  };

  for (const e of sorted) {
    if (e.type === "share") {
      sharesTotal++;
      if (underCap("share", e.at, SHARE_CAP_PER_DAY)) {
        sharesCounted++;
        xp += SHARE_XP;
      }
    } else if (e.type === "cook") {
      cooks++;
      xp += COOK_XP;
    } else if (e.type === "eat") {
      if (underCap("eat", e.at, EAT_CAP_PER_DAY)) {
        eats++;
        xp += EAT_XP;
      }
    }
    // "skip": no XP change, level kept.
    level = Math.max(level, levelForXp(xp)); // a level never goes down
  }

  const levelStart = (level - 1) * XP_PER_LEVEL;
  return {
    level,
    xp,
    cooks,
    cookXp: cooks * COOK_XP,
    eats,
    eatXp: eats * EAT_XP,
    sharesTotal,
    sharesCounted,
    shareXp: sharesCounted * SHARE_XP,
    xpIntoLevel: xp - levelStart,
    xpForNext: XP_PER_LEVEL,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The maths shown under the XP bar, e.g. "2 links × 10 = 20 · 1 cook × 50 = 50 · 1 meal × 25 = 25 · total 95 XP".
export function xpMath(p: Progress): string {
  return [
    `${plural(p.sharesCounted, "link", "links")} × ${SHARE_XP} = ${p.shareXp}`,
    `${plural(p.cooks, "cook", "cooks")} × ${COOK_XP} = ${p.cookXp}`,
    `${plural(p.eats, "meal", "meals")} × ${EAT_XP} = ${p.eatXp}`,
    `total ${p.xp} XP`,
  ].join(" · ");
}

// What's between the user and the next level, in words.
export function nextLevelHint(p: Progress): string {
  return `${p.xpForNext - p.xpIntoLevel} XP to Lv.${p.level + 1}`;
}
