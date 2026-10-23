// XP and level rules. Pure functions, no React, so they are easy to test (see xp.test.ts).
//
// Plain English:
// - Sharing a recipe link gives 1 XP, but only the first 3 shares each day count.
// - Completing a cook gives 10 XP.
// - Every 30 XP is one level. Lv.2 needs 30 XP AND at least 1 completed cook.
// - Levels only go up at the moment you complete a cook. Shares fill the bar,
//   but a share can never push Pal over a level on its own.
// - Skipping a planned cook never takes XP or a level away.

export const SHARE_XP = 1;
export const SHARE_CAP_PER_DAY = 3;
export const COOK_XP = 10;
export const XP_PER_LEVEL = 30;

export type XpEvent = { type: "share" | "cook" | "skip"; at: string };

export type Progress = {
  level: number;
  xp: number;
  cooks: number;
  cookXp: number;
  sharesTotal: number;
  sharesCounted: number;
  shareXp: number;
  xpIntoLevel: number; // XP earned since the start of the current level
  xpForNext: number; // XP needed to reach the next level, measured from the start of the current level
  readyToLevel: boolean; // XP is there; the next completed cook levels Pal up
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
  const sharesPerDay = new Map<string, number>();
  let xp = 0;
  let level = 1;
  let cooks = 0;
  let sharesTotal = 0;
  let sharesCounted = 0;

  for (const e of sorted) {
    if (e.type === "share") {
      sharesTotal++;
      const day = localDay(e.at);
      const today = sharesPerDay.get(day) ?? 0;
      if (today < SHARE_CAP_PER_DAY) {
        sharesPerDay.set(day, today + 1);
        sharesCounted++;
        xp += SHARE_XP;
      }
    } else if (e.type === "cook") {
      cooks++;
      xp += COOK_XP;
      level = Math.max(level, levelForXp(xp)); // the only place a level can go up
    }
    // "skip": no XP change, level kept.
  }

  const levelStart = (level - 1) * XP_PER_LEVEL;
  return {
    level,
    xp,
    cooks,
    cookXp: cooks * COOK_XP,
    sharesTotal,
    sharesCounted,
    shareXp: sharesCounted * SHARE_XP,
    xpIntoLevel: xp - levelStart,
    xpForNext: XP_PER_LEVEL,
    readyToLevel: levelForXp(xp) > level,
  };
}

// The maths shown under the XP bar, e.g. "3 cooks × 10 = 30 · 2 shares × 1 = 2 · total 32 XP".
export function xpMath(p: Progress): string {
  const cook = `${p.cooks} ${p.cooks === 1 ? "cook" : "cooks"} × ${COOK_XP} = ${p.cookXp}`;
  const share = `${p.sharesCounted} ${p.sharesCounted === 1 ? "share" : "shares"} × ${SHARE_XP} = ${p.shareXp}`;
  return `${cook} · ${share} · total ${p.xp} XP`;
}

// What's between the user and the next level, in words.
export function nextLevelHint(p: Progress): string {
  if (p.readyToLevel) return `XP is there. Complete your next cook to reach Lv.${p.level + 1}.`;
  const missing = p.xpForNext - p.xpIntoLevel;
  const cooksNeeded = Math.ceil(missing / COOK_XP);
  return `${missing} XP to Lv.${p.level + 1} · about ${cooksNeeded} ${cooksNeeded === 1 ? "cook" : "cooks"}`;
}
