import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";
import { createApp, type Deps } from "./app.js";
import type { UsdaFood } from "./nutrition.js";

const chicken = (cal: number, p: number, f: number): UsdaFood => ({
  fdcId: 1, description: "x", per100g: { calories: cal, protein_g: p, carbs_g: 0, fat_g: f }, portions: [],
});
const FOODS: Record<string, UsdaFood> = { "chicken thigh": chicken(200, 20, 10), "chicken breast": chicken(120, 24, 2) };

const goodLlm = {
  recipe: { title: "Chicken", prep_min: 5, cook_min: 10, difficulty: "easy", portions: 2 },
  ingredients: [
    { name: "chicken thigh", quantity: 400, unit: "g", category: "meat", is_staple: false },
    { name: "mystery sauce", quantity: 50, unit: "g", category: "pantry", is_staple: false },
  ],
  instructions: [{ step_number: 1, text: "Cook it", video_timestamp_sec: null, chef_tip: null }],
};

const servers: { close: () => void }[] = [];
async function start(over: Partial<Deps> = {}) {
  const deps: Deps = {
    fetchMedia: async () => ({ caption: "c", audioPath: "/x", creator: { handle: "@chef", avatar_url: "" }, cleanup: async () => {} }),
    transcribe: async () => [{ start: 1, text: "hi" }],
    extractRecipe: async () => goodLlm,
    proposeSwaps: async () => ({
      swaps: [
        { original: "chicken thigh", replacement: { name: "chicken breast", quantity: 400, unit: "g" }, reason: "leaner" },
        { original: "mystery sauce", replacement: { name: "chicken breast", quantity: 50, unit: "g" }, reason: "x" },
        { original: "not in recipe", replacement: { name: "chicken breast", quantity: 50, unit: "g" }, reason: "x" },
      ],
    }),
    usda: async (n) => FOODS[n] ?? null,
    ...over,
  };
  const s = createApp(deps).listen(0);
  servers.push(s);
  const base = `http://localhost:${(s.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { post };
}
after(() => servers.forEach((s) => s.close()));

test("ingest: unsupported URL -> 400 naming patterns and the received URL", async () => {
  const { post } = await start();
  const r = await post("/v1/ingest", { url: "https://example.com/video/1" });
  assert.equal(r.status, 400);
  const j = (await r.json()) as { error: string };
  assert.match(j.error, /instagram\.com\/reel\/\*/);
  assert.match(j.error, /Received: https:\/\/example\.com\/video\/1/);
});

test("ingest: model output failing validation -> 502 with the validation error, no recipe", async () => {
  const { post } = await start({ extractRecipe: async () => ({ recipe: { title: "x" }, ingredients: "nope" }) });
  const r = await post("/v1/ingest", { url: "https://www.tiktok.com/@chef/video/123" });
  assert.equal(r.status, 502);
  const j = (await r.json()) as Record<string, unknown>;
  assert.ok(Array.isArray(j.validation_error) && j.validation_error.length > 0);
  assert.equal(j.recipe, undefined);
});

test("ingest: model returning empty ingredients (not a recipe) -> 502", async () => {
  const { post } = await start({ extractRecipe: async () => ({ ...goodLlm, ingredients: [], instructions: [] }) });
  const r = await post("/v1/ingest", { url: "https://www.tiktok.com/@chef/video/123" });
  assert.equal(r.status, 502);
});

test("ingest: success returns the recipe shape with macros computed from USDA (unmatched excluded)", async () => {
  const { post } = await start();
  const r = await post("/v1/ingest", { url: "https://www.tiktok.com/@chef/video/123?x=1" });
  assert.equal(r.status, 200);
  const j = (await r.json()) as any;
  assert.deepEqual(j.creator, { handle: "@chef", platform: "tiktok", avatar_url: "", video_url: "https://www.tiktok.com/@chef/video/123" });
  // 400 g thigh = 800 kcal, 80 P, 40 F ; /2 portions ; sauce unmatched and excluded
  assert.deepEqual(j.macros, { calories: 400, protein_g: 40, carbs_g: 0, fat_g: 20 });
});

test("goal-fit: unmatched ingredient excluded from totals and reported; unknown originals dropped", async () => {
  const { post } = await start();
  const ing = await (await post("/v1/ingest", { url: "https://www.tiktok.com/@chef/video/123" })).json();
  const r = await post("/v1/goal-fit", { recipe: ing, goal: "high_protein" });
  assert.equal(r.status, 200);
  const j = (await r.json()) as any;
  assert.equal(j.swaps.length, 2);
  assert.deepEqual(j.swaps[0].delta, { calories: -160, protein_g: 8, carbs_g: 0, fat_g: -16 }); // 400 g: (120-200)*4/2 kcal, (24-20)*4/2 protein
  assert.equal(j.swaps[1].delta, null);
  assert.deepEqual(j.swaps[1].unmatched, ["mystery sauce"]);
  assert.deepEqual(j.deltas, { calories: -160, protein_g: 8, carbs_g: 0, fat_g: -16 });
  assert.deepEqual(j.unmatched, ["mystery sauce"]);
  assert.deepEqual(j.optimized_recipe.macros, { calories: 240, protein_g: 48, carbs_g: 0, fat_g: 4 });
});

test("goal-fit: bad swaps from the model -> 502", async () => {
  const { post } = await start({ proposeSwaps: async () => ({ swaps: [{ original: "x" }] }) });
  const ing = await (await post("/v1/ingest", { url: "https://www.tiktok.com/@chef/video/123" })).json();
  const r = await post("/v1/goal-fit", { recipe: ing, goal: "cut" });
  assert.equal(r.status, 502);
});
