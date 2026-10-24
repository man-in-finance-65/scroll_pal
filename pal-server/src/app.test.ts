import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";
import { createApp, type Config, type Deps } from "./app.js";
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
const SECRET = "test-secret-0123456789";
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function start(over: Partial<Deps> = {}, config: Partial<Config> = {}) {
  const deps: Deps = {
    fetchMedia: async () => ({ caption: "c", audioPath: "/x", audioError: null, creator: { handle: "@chef", avatar_url: "" }, cleanup: async () => {} }),
    transcribe: async () => [{ start: 1, text: "hi" }],
    extractRecipe: async () => goodLlm,
    proposeSwaps: async () => ({
      swaps: [
        { original: "chicken thigh", replacement: { name: "chicken breast", quantity: 400, unit: "g" }, reason: "leaner" },
        { original: "mystery sauce", replacement: { name: "chicken breast", quantity: 50, unit: "g" }, reason: "x" },
        { original: "not in recipe", replacement: { name: "chicken breast", quantity: 50, unit: "g" }, reason: "x" },
      ],
    }),
    scanPantry: async () => ({ staples: ["Extra Virgin Olive Oil", "kosher salt", "Black Pepper", "olive oil", "2 garlic bulbs"] }),
    usda: async (names) => new Map(names.map((n) => [n, FOODS[n] ?? null])),
    ...over,
  };
  const s = createApp(deps, { appSecret: SECRET, secrets: ["sk-ant-SUPERSECRETKEY"], ...config }).listen(0);
  servers.push(s);
  const base = `http://localhost:${(s.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, secret: string | null = SECRET) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret === null ? {} : { "x-app-secret": secret }) },
      body: JSON.stringify(body),
    });
  return { post, base };
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

test("auth: missing or wrong X-App-Secret -> 401; right one passes; /health is open", async () => {
  const { post, base } = await start();
  const body = { url: "https://www.tiktok.com/@chef/video/123" };
  assert.equal((await post("/v1/ingest", body, null)).status, 401);
  assert.equal((await post("/v1/ingest", body, "wrong")).status, 401);
  assert.equal((await post("/v1/ingest", body, SECRET.slice(0, -1) + "X")).status, 401);
  assert.equal((await post("/v1/ingest", body)).status, 200);
  assert.equal((await fetch(base + "/health")).status, 200);
});

test("rate limit: requests over the per-IP limit -> 429", async () => {
  const { post } = await start({}, { rateLimit: { max: 2, windowMs: 60_000 } });
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await post("/v1/cart", { store: "costco", items: [{ name: "egg", quantity: 1, unit: "" }] })).status);
  assert.deepEqual(codes, [200, 200, 429]);
});

test("ingest: caption-only fallback is flagged in the X-Pal-Note header, body keeps the recipe shape", async () => {
  const { post } = await start({
    fetchMedia: async () => ({ caption: "c", audioPath: null, audioError: "audio unavailable: blocked", creator: { handle: "@chef", avatar_url: "" }, cleanup: async () => {} }),
    transcribe: async () => { throw new Error("must not be called without audio"); },
  });
  const r = await post("/v1/ingest", { url: "https://youtube.com/shorts/abc" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("x-pal-note") ?? "", /caption only.*blocked/);
  assert.deepEqual(Object.keys((await r.json()) as object), ["creator", "recipe", "ingredients", "instructions", "macros"]);
});

test("errors never echo an API key", async () => {
  const { post } = await start({ fetchMedia: async () => { throw new Error("failed with key sk-ant-SUPERSECRETKEY"); } });
  const text = await (await post("/v1/ingest", { url: "https://youtube.com/shorts/abc" })).text();
  assert.doesNotMatch(text, /SUPERSECRETKEY/);
  assert.match(text, /\[redacted\]/);
});

test("pantry-scan: returns the normalized staple list", async () => {
  const { post } = await start();
  const r = await post("/v1/pantry-scan", { image: "data:image/png;base64," + PNG_1PX });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { staples: ["garlic", "olive oil", "pepper", "salt"] });
});

test("pantry-scan: non-image -> 400; bad model output -> 502", async () => {
  const { post } = await start({ scanPantry: async () => ({ staples: "salt" }) });
  assert.equal((await post("/v1/pantry-scan", { image: Buffer.from("hello world").toString("base64") })).status, 400);
  assert.equal((await post("/v1/pantry-scan", { image: PNG_1PX })).status, 502);
});

test("cart: costco gives search links and no prices", async () => {
  const { post } = await start();
  const r = await post("/v1/cart", { store: "costco", items: [{ name: "heavy cream", quantity: 0.5, unit: "cup" }] });
  const j = (await r.json()) as any;
  assert.equal(j.mode, "search_links");
  assert.equal(j.prices, null);
  assert.equal(j.items[0].search_url, "https://www.costco.ca/s?keyword=heavy%20cream");
  assert.equal((await post("/v1/cart", { store: "walmart", items: [] })).status, 400);
});
