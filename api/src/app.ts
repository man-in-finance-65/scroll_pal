// The API the phone talks to. It holds every key; the phone only sends a Clerk session token.
import { Hono } from "hono";
import { screen, DECLINE_MESSAGE, type ScreeningAnswers } from "../../engine/screening.ts";

export type UserRow = { clerk_id: string; eligible: boolean | null };

export type Deps = {
  // Returns the Clerk user id for a valid session token, or null.
  verify: (token: string) => Promise<string | null>;
  users: {
    upsert: (clerkId: string) => Promise<UserRow>;
    setEligible: (clerkId: string, eligible: boolean) => Promise<void>;
  };
};

type Env = { Variables: { userId: string } };

export function createApp(deps: Deps) {
  const app = new Hono<Env>();

  app.get("/health", (c) => c.json({ ok: true }));

  app.use("/v1/*", async (c, next) => {
    const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const userId = token ? await deps.verify(token) : null;
    if (!userId) return c.json({ error: "sign in required" }, 401);
    c.set("userId", userId);
    await next();
  });

  // Gate A: signing in creates (or finds) the user's row.
  app.get("/v1/me", async (c) => c.json(await deps.users.upsert(c.get("userId"))));

  // Health screen. Only eligible true/false is stored, never the answers.
  app.post("/v1/screening", async (c) => {
    const a = (await c.req.json()) as ScreeningAnswers;
    const numbers = [a.age, a.weightKg, a.heightCm];
    const flags = [a.pregnantOrBreastfeeding, a.eatingDisorderNowOrPast, a.diabetesOrGlucoseMedication, a.otherConditionNeedingSupervisedDiet];
    if (!numbers.every((n) => typeof n === "number" && n > 0) || !flags.every((f) => typeof f === "boolean"))
      return c.json({ error: "answer every question" }, 400);
    const { eligible } = screen(a);
    await deps.users.setEligible(c.get("userId"), eligible);
    return c.json(eligible ? { eligible } : { eligible, message: DECLINE_MESSAGE });
  });

  return app;
}
