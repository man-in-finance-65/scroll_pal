// The API the phone talks to. It holds every key; the phone only sends a Clerk session token.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { screen, DECLINE_MESSAGE, type ScreeningAnswers } from "../../engine/screening.ts";
import { createPod, joinPod, PodError, SAMPLE_DISHES, seedDemoPod, setGoal, setReceipt, submitDish, viewPod, type PodStore } from "../../engine/pods.ts";
import type { PriceTable } from "../../engine/swap.ts";
import type { Extractor } from "./extract.ts";
import type { GroceryLine } from "../../engine/swap.ts";

export type UserRow = { clerk_id: string; eligible: boolean | null };

export type Deps = {
  // Returns the Clerk user id for a valid session token, or null.
  verify: (token: string) => Promise<string | null>;
  users: {
    upsert: (clerkId: string) => Promise<UserRow>;
    setEligible: (clerkId: string, eligible: boolean) => Promise<void>;
  };
  pods: PodStore;
  extract: Extractor;
  prices: PriceTable;
  // Returns an Instacart shopping-page link for the list, or null when no Instacart key is set.
  instacart: ((title: string, lines: GroceryLine[]) => Promise<string>) | null;
};

type Env = { Variables: { userId: string } };

export function createApp(deps: Deps) {
  const app = new Hono<Env>();

  app.use("*", cors());
  app.onError((err, c) => {
    if (err instanceof PodError) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Something went wrong on Pal's side. Try again." }, 500);
  });

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

  // ---------- Meal Prep Swap ----------
  const me = async (c: { req: { json: () => Promise<unknown> } ; get: (k: "userId") => string }) => {
    const body = (await c.req.json().catch(() => ({}))) as { displayName?: string };
    return { userId: c.get("userId"), name: (body.displayName ?? "").trim().slice(0, 40) || "Pal friend" };
  };

  app.get("/v1/pods", async (c) => c.json(await deps.pods.listForUser(c.get("userId"))));

  app.post("/v1/pods", async (c) => {
    const body = (await c.req.json()) as { name?: string; displayName?: string };
    const user = { userId: c.get("userId"), name: body.displayName?.trim().slice(0, 40) || "Pal friend" };
    return c.json(await createPod(deps.pods, user, body.name ?? ""));
  });

  app.post("/v1/pods/join", async (c) => {
    const body = (await c.req.json()) as { code?: string; displayName?: string };
    const user = { userId: c.get("userId"), name: body.displayName?.trim().slice(0, 40) || "Pal friend" };
    return c.json(await joinPod(deps.pods, user, body.code ?? ""));
  });

  app.post("/v1/pods/demo", async (c) => c.json(await seedDemoPod(deps.pods, await me(c))));

  app.get("/v1/pods/:id", async (c) => c.json(await viewPod(deps.pods, c.req.param("id"), c.get("userId"), deps.prices)));

  app.put("/v1/pods/:id/goal", async (c) => {
    const { goal } = (await c.req.json()) as { goal?: unknown };
    await setGoal(deps.pods, c.req.param("id"), c.get("userId"), goal);
    return c.json(await viewPod(deps.pods, c.req.param("id"), c.get("userId"), deps.prices));
  });

  // A reel link (Pal watches the video; the caption is optional), a screenshot, or a sample dish.
  app.post("/v1/pods/:id/dish", async (c) => {
    const podId = c.req.param("id"), userId = c.get("userId");
    const body = (await c.req.json()) as Record<string, unknown>;
    if (body.kind === "sample") {
      const dish = SAMPLE_DISHES[String(body.sample)];
      if (!dish) throw new PodError("Unknown sample dish.", 404);
      await submitDish(deps.pods, podId, userId, dish, { kind: "sample" });
    } else if (body.kind === "reel") {
      const url = String(body.url ?? "").trim(), caption = String(body.caption ?? "").trim();
      if (!/^https?:\/\//.test(url)) throw new PodError("Paste the reel's full link (it starts with https://).");
      const dish = await deps.extract({ kind: "reel", url, caption: caption ? caption.slice(0, 8000) : undefined });
      await submitDish(deps.pods, podId, userId, dish, { kind: "reel", url, caption });
    } else if (body.kind === "screenshot") {
      const mediaType = String(body.mediaType);
      if (!["image/png", "image/jpeg", "image/webp"].includes(mediaType)) throw new PodError("Upload a PNG, JPEG or WebP screenshot.");
      const data = String(body.data ?? "");
      if (!data || data.length > 7_000_000) throw new PodError("That screenshot is empty or too big (5 MB max).");
      const dish = await deps.extract({ kind: "screenshot", mediaType: mediaType as "image/png", data });
      await submitDish(deps.pods, podId, userId, dish, { kind: "screenshot" });
    } else throw new PodError("Send a reel link and caption, or a screenshot.");
    return c.json(await viewPod(deps.pods, podId, userId, deps.prices));
  });

  app.put("/v1/pods/:id/receipt", async (c) => {
    const { total } = (await c.req.json()) as { total?: unknown };
    await setReceipt(deps.pods, c.req.param("id"), c.get("userId"), total ?? null);
    return c.json(await viewPod(deps.pods, c.req.param("id"), c.get("userId"), deps.prices));
  });

  // Sends the pod's grocery list to Instacart and returns the shopping-page link.
  app.post("/v1/pods/:id/instacart", async (c) => {
    if (!deps.instacart) throw new PodError("Instacart isn't connected yet: the server needs an Instacart API key.", 409);
    const view = await viewPod(deps.pods, c.req.param("id"), c.get("userId"), deps.prices);
    if (!view.swap) throw new PodError("Add all 3 dishes first; then Pal can build the cart.");
    const url = await deps.instacart(`${view.pod.name}: 27 portions`, view.swap.grocery);
    await deps.pods.savePodFields(view.pod.id, { instacartUrl: url });
    return c.json({ url });
  });

  return app;
}
