import { describe, expect, it } from "vitest";
import { plain } from "./format";
import { computeProgress, nextLevelHint, xpMath, type XpEvent } from "./xp";

// Builds events at local noon on the given day, plus `n` minutes, so day boundaries are clear.
const at = (day: number, n = 0) => new Date(2026, 9, day, 12, n).toISOString();
const many = (type: XpEvent["type"], day: number, count: number, offset = 0): XpEvent[] =>
  Array.from({ length: count }, (_, i) => ({ type, at: at(day, offset + i) }));

describe("share XP", () => {
  it("gives 10 XP per link, capped at 3 per day", () => {
    const p = computeProgress(many("share", 1, 5));
    expect(p.sharesTotal).toBe(5);
    expect(p.sharesCounted).toBe(3);
    expect(p.xp).toBe(30);
  });

  it("resets the cap on a new day", () => {
    expect(computeProgress([...many("share", 1, 3), ...many("share", 2, 3)]).xp).toBe(60);
  });
});

describe("cook and eat XP", () => {
  it("gives 50 per cook, no cap", () => {
    expect(computeProgress(many("cook", 1, 4)).xp).toBe(200);
  });

  it("gives 25 per meal eaten, capped at 3 per day", () => {
    const p = computeProgress(many("eat", 1, 5));
    expect(p.eats).toBe(3);
    expect(p.xp).toBe(75);
  });
});

describe("levels", () => {
  it("starts at Lv.1", () => {
    expect(computeProgress([]).level).toBe(1);
  });

  it("every 100 XP is a level", () => {
    expect(computeProgress(many("cook", 1, 1)).level).toBe(1); // 50
    expect(computeProgress(many("cook", 1, 2)).level).toBe(2); // 100
    expect(computeProgress(many("cook", 1, 4)).level).toBe(3); // 200
  });

  it("one link, cook and meal is 85 XP; a second loop levels up", () => {
    const loop = (day: number): XpEvent[] => [{ type: "share", at: at(day, 0) }, { type: "cook", at: at(day, 1) }, { type: "eat", at: at(day, 2) }];
    expect(computeProgress(loop(1)).xp).toBe(85);
    expect(computeProgress([...loop(1), ...loop(2)]).level).toBe(2);
  });

  it("skipping a planned cook keeps XP and level", () => {
    const base = many("cook", 1, 3);
    const a = computeProgress(base);
    const b = computeProgress([...base, { type: "skip", at: at(2) }, { type: "skip", at: at(3) }]);
    expect(b.level).toBe(a.level);
    expect(b.xp).toBe(a.xp);
  });
});

describe("maths shown on screen", () => {
  it("spells out the sum", () => {
    const p = computeProgress([...many("cook", 1, 1, 30), ...many("share", 1, 2), ...many("eat", 1, 1, 40)]);
    expect(xpMath(p)).toBe("2 links × 10 = 20 · 1 cook × 50 = 50 · 1 meal × 25 = 25 · total 95 XP");
  });

  it("tells you what's left", () => {
    const p = computeProgress(many("share", 1, 1));
    expect(p.xpIntoLevel).toBe(10);
    expect(nextLevelHint(p)).toBe("90 XP to Lv.2");
  });
});

describe("house style", () => {
  it("removes hyphens and dashes from AI recipe text", () => {
    expect(plain("Sear 5–6 minutes per side")).toBe("Sear 5 to 6 minutes per side");
    expect(plain("Quick stir-fry")).toBe("Quick stir fry");
    expect(plain("Taste it — then salt")).toBe("Taste it, then salt");
    expect(plain("Rest 10-15 min")).toBe("Rest 10 to 15 min");
  });
});
