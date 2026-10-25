import { describe, expect, it } from "vitest";
import { computeProgress, COOK_XP, EAT_XP, SHARE_XP, XP_PER_LEVEL, type XpEvent } from "./xp";

// Builds events at local noon on the given day, plus `n` minutes, so day boundaries are clear.
const at = (day: number, n = 0) => new Date(2026, 9, day, 12, n).toISOString();
const shares = (day: number, count: number): XpEvent[] =>
  Array.from({ length: count }, (_, i) => ({ type: "share", at: at(day, i) }));
const cooks = (day: number, count: number): XpEvent[] =>
  Array.from({ length: count }, (_, i) => ({ type: "cook", at: at(day, 10 + i) }));
const eat = (ref: string, day = 1, n = 30): XpEvent => ({ type: "eat", ref, at: at(day, n) });

describe("XP values", () => {
  it("are exactly 10 / 25 / 50, and the level cost is flat", () => {
    expect([SHARE_XP, EAT_XP, COOK_XP]).toEqual([10, 25, 50]);
    expect(XP_PER_LEVEL).toBe(100);
  });

  it("no events = 0 XP, Lv.1, a full level to go", () => {
    const p = computeProgress([]);
    expect(p).toMatchObject({ xp: 0, level: 1, xpIntoLevel: 0, xpToNext: 100 });
  });

  it("share 10, eat 25, cook 50 add up", () => {
    const p = computeProgress([...shares(1, 1), eat("a"), ...cooks(1, 1)]);
    expect(p.xp).toBe(85);
  });

  it("ignores anything that isn't share, eat or cook", () => {
    const old = [{ type: "skip", at: at(1) }] as unknown as XpEvent[];
    expect(computeProgress(old).xp).toBe(0);
  });
});

describe("shares", () => {
  it("only the first 3 a day count", () => {
    const p = computeProgress(shares(1, 5));
    expect(p.shares).toBe(3);
    expect(p.xp).toBe(30);
  });

  it("the cap resets on a new day", () => {
    expect(computeProgress([...shares(1, 3), ...shares(2, 3)]).xp).toBe(60);
  });
});

describe("eating", () => {
  it("the same meal twice counts once", () => {
    const p = computeProgress([eat("mon-lunch", 1, 30), eat("mon-lunch", 1, 31)]);
    expect(p.eats).toBe(1);
    expect(p.xp).toBe(25);
  });

  it("different meals each count", () => {
    expect(computeProgress([eat("a"), eat("b")]).xp).toBe(50);
  });
});

describe("cooking", () => {
  it("has no cap", () => {
    const p = computeProgress(cooks(1, 10));
    expect(p.cooks).toBe(10);
    expect(p.xp).toBe(500);
  });
});

describe("levels", () => {
  it("just under the threshold is still Lv.1", () => {
    // 10/25/50 only make multiples of 5, so 95 is the closest you can get below 100.
    const p = computeProgress([...shares(1, 2), eat("a"), ...cooks(1, 1)]);
    expect(p.xp).toBe(95);
    expect(p.level).toBe(1);
    expect(p.xpToNext).toBe(5);
  });

  it("levels up exactly at the threshold", () => {
    const p = computeProgress(cooks(1, 2));
    expect(p.xp).toBe(100);
    expect(p.level).toBe(2);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.xpToNext).toBe(100);
  });

  it("every level costs the same (flat, not growing)", () => {
    expect(computeProgress(cooks(1, 4)).level).toBe(3); // 200 XP
    expect(computeProgress(cooks(1, 6)).level).toBe(4); // 300 XP
  });
});
