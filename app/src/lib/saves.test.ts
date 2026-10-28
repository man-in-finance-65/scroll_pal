import { describe, expect, it } from "vitest";
import { instagramSaves } from "./meal";

const csv = `creator,post_url,type,posted_date,caption,hashtags,bucket
a,https://www.instagram.com/reel/AAA111/,reel,2026-10-16 18:00:00,"Crispy chicken, 3 ingredients
and an air fryer. ""So good"" #recipe",#recipe,food_recipes
b,https://www.instagram.com/reel/BBB222/,reel,2026-10-16 19:00:00,me trying to make it as a pet creator #ai,#ai,ai_tech
c,https://www.instagram.com/p/CCC333/,reel,2026-10-17 09:00:00,Garlic butter salmon bowl with rice #dinner,#dinner,food_recipes
d,https://www.instagram.com/reel/DDD444/,reel,2026-10-18 09:00:00,The levels of content. Where is the line?,,food_recipes
e,https://www.instagram.com/p/CCC333/,reel,2026-10-17 09:00:00,Garlic butter salmon bowl with rice #dinner,#dinner,food_recipes`;

describe("Instagram saves file", () => {
  it("reads a CSV: food only, newest first, no repeats, with captions", () => {
    const r = instagramSaves(csv);
    expect(r.kind).toBe("csv");
    expect(r.total).toBe(5);
    expect(r.saves.map((x) => x.url)).toEqual(["https://www.instagram.com/p/CCC333/", "https://www.instagram.com/reel/AAA111/"]);
    expect(r.saves[1].caption).toContain('Crispy chicken, 3 ingredients\nand an air fryer. "So good"');
  });
  it("still reads Instagram's own JSON export", () => {
    const r = instagramSaves('{"x":[{"href":"https://www.instagram.com/reel/ZZZ/"},{"href":"https://www.instagram.com/p/YYY/"}]}');
    expect(r.kind).toBe("links");
    expect(r.saves.length).toBe(2);
  });
});
