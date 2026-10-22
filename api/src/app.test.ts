import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApp, type Deps, type UserRow } from "./app.ts";
import { MemoryPodStore, SAMPLE_DISHES } from "../../engine/pods.ts";
import { toDish } from "./extract.ts";

const PRICES = JSON.parse(readFileSync(new URL("../../data/prices.json", import.meta.url), "utf8"));

function fakeDeps() {
  const rows = new Map<string, UserRow>();
  const deps: Deps = {
    verify: async (t) => (t === "good-token" ? "user_123" : null),
    users: {
      upsert: async (id) => {
        if (!rows.has(id)) rows.set(id, { clerk_id: id, eligible: null });
        return rows.get(id)!;
      },
      setEligible: async (id, eligible) => void rows.set(id, { clerk_id: id, eligible }),
    },
    pods: new MemoryPodStore(),
    extract: async () => SAMPLE_DISHES.pesto,
    prices: PRICES,
    instacart: null as Deps["instacart"],
  };
  return { deps, rows };
}
const auth = { authorization: "Bearer good-token" };
const answers = { age: 30, weightKg: 80, heightCm: 180, pregnantOrBreastfeeding: false, eatingDisorderNowOrPast: false, diabetesOrGlucoseMedication: false, otherConditionNeedingSupervisedDiet: false };

test("health check needs no sign-in", async () => {
  const res = await createApp(fakeDeps().deps).request("/health");
  assert.equal(res.status, 200);
});
test("no token or a bad token is refused", async () => {
  const app = createApp(fakeDeps().deps);
  assert.equal((await app.request("/v1/me")).status, 401);
  assert.equal((await app.request("/v1/me", { headers: { authorization: "Bearer forged" } })).status, 401);
});
test("Gate A: signing in creates the user's row", async () => {
  const { deps, rows } = fakeDeps();
  const res = await createApp(deps).request("/v1/me", { headers: auth });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { clerk_id: "user_123", eligible: null });
  assert.ok(rows.has("user_123"));
});
test("screening stores only eligible, never the answers", async () => {
  const { deps, rows } = fakeDeps();
  const res = await createApp(deps).request("/v1/screening", { method: "POST", headers: auth, body: JSON.stringify({ ...answers, pregnantOrBreastfeeding: true }) });
  const body = await res.json();
  assert.equal(body.eligible, false);
  assert.ok(body.message.includes("doctor"));
  assert.deepEqual(rows.get("user_123"), { clerk_id: "user_123", eligible: false });
});
test("screening with a missing answer is rejected, not guessed", async () => {
  const { deps, rows } = fakeDeps();
  const { diabetesOrGlucoseMedication, ...partial } = answers;
  const res = await createApp(deps).request("/v1/screening", { method: "POST", headers: auth, body: JSON.stringify(partial) });
  assert.equal(res.status, 400);
  assert.equal(rows.size, 0);
});

// Meal Prep Swap
const post = (app: ReturnType<typeof createApp>, path: string, body: unknown, method = "POST") =>
  app.request(path, { method, headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });

test("demo pod runs to a full swap through the API", async () => {
  const app = createApp(fakeDeps().deps);
  const pod = await (await post(app, "/v1/pods/demo", { displayName: "Vicente" })).json();
  assert.equal((await post(app, `/v1/pods/${pod.id}/goal`, { goal: { kind: "high-protein", minProteinG: 35 } }, "PUT")).status, 200);
  const afterDish = await (await post(app, `/v1/pods/${pod.id}/dish`, { kind: "reel", url: "https://www.instagram.com/reel/abc/" })).json();
  assert.equal(afterDish.complete, true);
  assert.equal(afterDish.swap.totalPortions, 27);
  const view = await (await post(app, `/v1/pods/${pod.id}/receipt`, { total: 90 }, "PUT")).json();
  assert.deepEqual(view.swap.cost.perMember, [30, 30, 30]);
});
test("a reel needs a real link, checked before any AI call", async () => {
  let called = false;
  const { deps } = fakeDeps();
  deps.extract = async () => { called = true; return SAMPLE_DISHES.pesto; };
  const app = createApp(deps);
  const pod = await (await post(app, "/v1/pods", { name: "Test", displayName: "A" })).json();
  const res = await post(app, `/v1/pods/${pod.id}/dish`, { kind: "reel", url: "not a link" });
  assert.equal(res.status, 400);
  assert.equal(called, false);
});
test("Add to Instacart sends the merged list and saves the link", async () => {
  const { deps } = fakeDeps();
  let sent: { title: string; n: number } | null = null;
  deps.instacart = async (title, lines) => { sent = { title, n: lines.length }; return "https://www.instacart.com/store/shopping_lists/123"; };
  const app = createApp(deps);
  const pod = await (await post(app, "/v1/pods/demo", { displayName: "V" })).json();
  assert.equal((await post(app, `/v1/pods/${pod.id}/instacart`, {})).status, 400); // only 2 dishes so far
  await post(app, `/v1/pods/${pod.id}/dish`, { kind: "sample", sample: "pesto" });
  const res = await (await post(app, `/v1/pods/${pod.id}/instacart`, {})).json();
  assert.equal(res.url, "https://www.instacart.com/store/shopping_lists/123");
  assert.equal(sent!.n, 17);
});
test("without an Instacart key the button explains what's missing", async () => {
  const app = createApp(fakeDeps().deps);
  const pod = await (await post(app, "/v1/pods/demo", { displayName: "V" })).json();
  const res = await post(app, `/v1/pods/${pod.id}/instacart`, {});
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /Instacart API key/);
});
test("joining an unknown code returns 404 with a readable message", async () => {
  const res = await post(createApp(fakeDeps().deps), "/v1/pods/join", { code: "ZZZZZZ" });
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /invite code/);
});
test("Claude's JSON is validated and reshaped into a dish", () => {
  const dish = toDish({ is_dish: true, name: " Oats ", ingredients: [{ name: "oats", qty_per_serving: 50, unit: "g" }], steps: ["Mix."], macros_per_serving: { kcal: 300.4, protein_g: 12, carbs_g: 50, fat_g: 6 } });
  assert.equal(dish.name, "Oats");
  assert.equal(dish.macros.kcal, 300);
  assert.throws(() => toDish({ is_dish: false, name: "", ingredients: [], steps: [], macros_per_serving: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } }), /couldn't find a dish/);
  assert.throws(() => toDish({ name: "missing fields" }), /couldn't use/);
});
