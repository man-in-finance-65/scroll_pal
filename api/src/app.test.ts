import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp, type Deps, type UserRow } from "./app.ts";

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
