import { describe, expect, it } from "vitest";
import { computeProgress, nextLevelHint, xpMath, type XpEvent } from "./xp";

// Builds events at local noon on the given day, plus `n` minutes, so day boundaries are clear.
const at = (day: number, n = 0) => new Date(2026, 9, day, 12, n).toISOString();
const shares = (day: number, count: number): XpEvent[] =>
  Array.from({ length: count }, (_, i) => ({ type: "share", at: at(day, i) }));
const cooks = (day: number, count: number): XpEvent[] =>
  Array.from({ length: count }, (_, i) => ({ type: "cook", at: at(day, 30 + i) }));

describe("share XP", () => {
  it("gives 10 XP per link, capped at 3 per day", () => {
    const p = computeProgress(shares(1, 5));
    expect(p.sharesTotal).toBe(5);
    expect(p.sharesCounted).toBe(3);
    expect(p.xp).toBe(30);
  });

  it("resets the cap on a new day", () => {
    const p = computeProgress([...shares(1, 3), ...shares(2, 3)]);
    expect(p.xp).toBe(60);
  });
});

describe("levels", () => {
  it("starts at Lv.1", () => {
    expect(computeProgress([]).level).toBe(1);
  });

  it("3 links = Lv.2, 6 links = Lv.3 (same pace every level)", () => {
    expect(computeProgress(shares(1, 2)).level).toBe(1);
    expect(computeProgress(shares(1, 3)).level).toBe(2);
    expect(computeProgress([...shares(1, 3), ...shares(2, 3)]).level).toBe(3);
  });

  it("3 cooks also reach Lv.2, and links and cooks mix", () => {
    expect(computeProgress(cooks(1, 3)).level).toBe(2);
    expect(computeProgress([...shares(1, 2), ...cooks(1, 1)]).level).toBe(2);
  });

  it("skipping a planned cook keeps XP and level", () => {
    const base = cooks(1, 3);
    const withSkips: XpEvent[] = [...base, { type: "skip", at: at(2) }, { type: "skip", at: at(3) }];
    const a = computeProgress(base);
    const b = computeProgress(withSkips);
    expect(b.level).toBe(a.level);
    expect(b.xp).toBe(a.xp);
  });
});

describe("maths shown on screen", () => {
  it("spells out the sum", () => {
    const p = computeProgress([...cooks(1, 3), ...shares(1, 2)]);
    expect(xpMath(p)).toBe("3 cooks × 10 = 30 · 2 links × 10 = 20 · total 50 XP");
  });

  it("tells you what's left", () => {
    const p = computeProgress(shares(1, 1));
    expect(p.xpIntoLevel).toBe(10);
    expect(nextLevelHint(p)).toBe("20 XP to Lv.2 · 2 more links or cooks");
  });
});
