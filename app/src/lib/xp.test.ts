import { describe, expect, it } from "vitest";
import { computeProgress, nextLevelHint, xpMath, type XpEvent } from "./xp";

// Builds events at local noon on the given day, plus `n` minutes, so day boundaries are clear.
const at = (day: number, n = 0) => new Date(2026, 9, day, 12, n).toISOString();
const shares = (day: number, count: number): XpEvent[] =>
  Array.from({ length: count }, (_, i) => ({ type: "share", at: at(day, i) }));
const cooks = (day: number, count: number): XpEvent[] =>
  Array.from({ length: count }, (_, i) => ({ type: "cook", at: at(day, 30 + i) }));

describe("share XP", () => {
  it("gives 1 XP per share, capped at 3 per day", () => {
    const p = computeProgress(shares(1, 5));
    expect(p.sharesTotal).toBe(5);
    expect(p.sharesCounted).toBe(3);
    expect(p.xp).toBe(3);
  });

  it("resets the cap on a new day", () => {
    const p = computeProgress([...shares(1, 3), ...shares(2, 3)]);
    expect(p.xp).toBe(6);
  });
});

describe("levels", () => {
  it("starts at Lv.1", () => {
    expect(computeProgress([]).level).toBe(1);
  });

  it("3 cooks x 10 = 30 XP reaches Lv.2", () => {
    const p = computeProgress(cooks(1, 3));
    expect(p.xp).toBe(30);
    expect(p.level).toBe(2);
  });

  it("30 XP from shares alone never reaches Lv.2", () => {
    const tenDays = Array.from({ length: 10 }, (_, d) => shares(d + 1, 3)).flat();
    const p = computeProgress(tenDays);
    expect(p.xp).toBe(30);
    expect(p.cooks).toBe(0);
    expect(p.level).toBe(1);
    expect(p.readyToLevel).toBe(true);
  });

  it("a share can't cross a level; the next cook does", () => {
    // 2 cooks (20) + 9 shares over 3 days (9) = 29, then a share makes 30
    const events = [...cooks(1, 2), ...shares(2, 3), ...shares(3, 3), ...shares(4, 3), ...shares(5, 1)];
    const before = computeProgress(events);
    expect(before.xp).toBe(30);
    expect(before.level).toBe(1);
    const after = computeProgress([...events, ...cooks(6, 1)]);
    expect(after.xp).toBe(40);
    expect(after.level).toBe(2);
  });

  it("1 cook + 20 share XP = 30 XP reaches Lv.2 when the cook comes last", () => {
    const sharesFirst = Array.from({ length: 7 }, (_, d) => shares(d + 1, 3)).flat().slice(0, 20);
    const p = computeProgress([...sharesFirst, ...cooks(9, 1)]);
    expect(p.xp).toBe(30);
    expect(p.level).toBe(2);
  });

  it("skipping a planned cook keeps XP and level", () => {
    const base = cooks(1, 3);
    const withSkips: XpEvent[] = [...base, { type: "skip", at: at(2) }, { type: "skip", at: at(3) }];
    const a = computeProgress(base);
    const b = computeProgress(withSkips);
    expect(b.level).toBe(a.level);
    expect(b.xp).toBe(a.xp);
  });

  it("6 cooks reach Lv.3", () => {
    expect(computeProgress(cooks(1, 6)).level).toBe(3);
  });
});

describe("maths shown on screen", () => {
  it("spells out the sum", () => {
    const p = computeProgress([...cooks(1, 3), ...shares(1, 2)]);
    expect(xpMath(p)).toBe("3 cooks × 10 = 30 · 2 shares × 1 = 2 · total 32 XP");
  });

  it("tells you what's left", () => {
    const p = computeProgress(cooks(1, 1));
    expect(p.xpIntoLevel).toBe(10);
    expect(nextLevelHint(p)).toBe("20 XP to Lv.2 · about 2 cooks");
  });
});
