import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, planPrompt } from "./claude.js";
import { planWithGemini } from "./gemini.js";
import { IngestError, ingest } from "./ingest.js";
import { KitchenError, readPantry, recommendFor, swapsFor } from "./kitchen.js";
import { limit } from "./limit.js";
import { mockPlan, simplePlan } from "./mock.js";
import { EventBody, FeedbackBody, IngestBody, PalBody, PantryBody, PlanBody, RecommendBody, SwapsBody } from "./schema.js";
import { sheetTime, toSheet } from "./sheet.js";

const app = express();
app.set("trust proxy", true); // behind Cloud Run: req.ip is the visitor, not Google
// Pantry photos are big; everything else is small text, so keep the tight limit there.
const smallJson = express.json({ limit: "200kb" });
const photoJson = express.json({ limit: "12mb" });
app.use((req, res, next) => (req.path === "/v1/pantry" || req.path === "/v1/ingest" ? photoJson : smallJson)(req, res, next));
// Phones don't need this; it lets the web preview of the app call the API too.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

const bad = (res: Response, message: string) => res.status(400).json({ error: "bad_request", message });

// Not "/healthz": Google Cloud Run reserves that path and answers it with its own 404.
app.get("/health", (_req, res) => res.json({ ok: true, mock: process.env.MOCK_AI === "1" }));

app.post("/v1/ingest", async (req: Request, res: Response) => {
  const body = IngestBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {url, caption?, shot?}.");
  try {
    const { recipe, cached, info } = await ingest(body.data.url, body.data.caption, body.data.shot);
    console.log(`ingest ok cached=${cached} title="${recipe.title}" ${info ? `model=${info.model} ms=${info.ms} tokens in/out/thinking=${info.promptTokens}/${info.outputTokens}/${info.thoughtTokens ?? 0} thinking=${info.thinking}` : ""}`);
    res.json({ ...recipe, cached, timing: info });
  } catch (e) {
    if (e instanceof IngestError) return res.status(e.status).json({ error: e.code, message: e.message, detail: e.detail });
    console.error("ingest crashed", e);
    res.status(500).json({ error: "server_error", message: "Something upset my tummy. Try again in a moment." });
  }
});

app.post("/v1/plan", async (req: Request, res: Response) => {
  const body = PlanBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {recipe, goal: bulk|cut|maintain, days: 1-7}.");
  const { recipe, goal, days } = body.data;
  // Claude writes the smartest plan. If it isn't set up, or it fails for any reason, the built-in planner still
  // gives a good plan, so nobody is ever stuck here. The reason is logged and returned for the owner.
  let plan;
  let planner = "claude";
  let note: string | undefined;
  if (process.env.MOCK_AI === "1") {
    plan = mockPlan(goal, days);
    planner = "mock";
  } else {
    // 1) Claude, 2) Gemini, 3) the built-in planner. Whoever answers first wins, so Pal can always dream up a plan.
    const tried: string[] = [];
    const clean = (e: unknown) => {
      let text = String((e as Error)?.message ?? e);
      try { text = JSON.parse(text)?.error?.message ?? text; } catch {}
      return text.replace(/sk-[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}/g, "***").replace(/\s+/g, " ").slice(0, 160);
    };
    if (process.env.ANTHROPIC_API_KEY) {
      try { plan = await buildPlan(recipe, goal, days); } catch (e) { tried.push(`claude: ${clean(e)}`); }
    } else tried.push("ANTHROPIC_API_KEY is not set");
    if (!plan && process.env.GEMINI_API_KEY) {
      try { plan = await planWithGemini(planPrompt(recipe, goal, days)); planner = "gemini"; } catch (e) { tried.push(`gemini: ${clean(e)}`); }
    }
    if (!plan) { plan = simplePlan(recipe, goal, days); planner = "built-in"; }
    if (tried.length) { note = tried.join(" | "); console.warn(`plan: ${planner} used. ${note}`); }
  }
  res.json({ ...plan, planner, note });
});

const kitchenFail = (res: Response, e: unknown, what: string) => {
  if (e instanceof KitchenError) {
    console.warn(`${what}: ${e.code} ${e.detail ?? ""}`);
    return res.status(e.status).json({ error: e.code, message: e.message, detail: e.detail });
  }
  console.error(`${what} crashed`, e);
  res.status(500).json({ error: "server_error", message: "Something went wrong in my kitchen. Try again." });
};

// Pal tunes a recipe to your goal. Never fails: plain rules answer when no AI is set up.
app.post("/v1/swaps", limit(60), async (req: Request, res: Response) => {
  const body = SwapsBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {recipe, goal, mealKcal?}.");
  try {
    const out = await swapsFor(body.data.recipe, body.data.goal, body.data.mealKcal ?? null);
    if (out.note) console.warn(`swaps: ${out.planner} used. ${out.note}`);
    res.json(out);
  } catch (e) {
    kitchenFail(res, e, "swaps");
  }
});

// The dish does not fit the goal: Pal recommends what to do about it. Never fails: plain rules answer without AI.
app.post("/v1/recommend", limit(60), async (req: Request, res: Response) => {
  const body = RecommendBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {recipe, goal, kcalAfter, misses[], mealKcal?}.");
  try {
    const out = await recommendFor(body.data.recipe, body.data.goal, body.data.mealKcal ?? null, body.data.kcalAfter, body.data.misses);
    if (out.note) console.warn(`recommend: ${out.planner} used. ${out.note}`);
    res.json(out);
  } catch (e) {
    kitchenFail(res, e, "recommend");
  }
});

// A photo of your shelves: which of the recipe's ingredients Gemini can see.
app.post("/v1/pantry", limit(30), async (req: Request, res: Response) => {
  const body = PantryBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {image (base64), mimeType, ingredients[]}.");
  try {
    res.json({ have: await readPantry(body.data.image, body.data.mimeType, body.data.ingredients) });
  } catch (e) {
    kitchenFail(res, e, "pantry");
  }
});

// One line per tap, so you can count them in Cloud Run logs:  grep "EVENT type=done"
app.post("/v1/event", limit(240), (req: Request, res: Response) => {
  const body = EventBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {type: share|plan|done|skip}.");
  const { type, device = "unknown", ref = "" } = body.data;
  console.log(`EVENT type=${type} device=${device} ref="${ref.replace(/"/g, "'")}" ts=${new Date().toISOString()}`);
  void toSheet("Events", [sheetTime(), device, type, ref]);
  res.status(204).end();
});

// "Do you want to be Pal's pal?" A yes is one row in the private sheet. The count lives there, never on the page.
app.post("/v1/pal", limit(10), (req: Request, res: Response) => {
  const body = PalBody.safeParse(req.body);
  if (!body.success) return bad(res, "Bad request.");
  const { ref = "", mobile = false } = body.data;
  console.log(`EVENT type=pal_yes mobile=${mobile} ref="${ref.replace(/"/g, "'")}" ts=${new Date().toISOString()}`);
  void toSheet("Pals", [sheetTime(), ref, mobile]);
  res.json({ ok: true });
});

// Pal asking a friend for advice. One row per answer. Anonymous (random device id, no name, no email).
app.post("/v1/feedback", limit(40), (req: Request, res: Response) => {
  const body = FeedbackBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {device, milestone, level, cooks, id, q, a}.");
  const f = body.data;
  // The full message is logged too, as a backup in case the sheet is ever unreachable.
  console.log(`EVENT type=feedback device=${f.device} step=${f.id} milestone=${f.milestone} level=${f.level} cooks=${f.cooks} said=${JSON.stringify(f.a)} ts=${new Date().toISOString()}`);
  const when = f.milestone === 1 ? "after 1st cook" : f.milestone === 3 ? "after 3rd cook" : "from the Pal tab";
  // Answer the app only once the sheet has the row (or we know it can't), so a failure shows "try again" in the chat.
  toSheet("Feedback", [sheetTime(), f.device, when, f.level, f.cooks, f.id, f.q, f.a]).then((saved) => {
    if (!saved && process.env.SHEET_ID) console.warn(`feedback NOT in sheet (still in logs): device=${f.device} step=${f.id}`);
    res.status(204).end();
  });
});

// The landing page lives in api/landing and is served at "/".
const landing = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "landing");
app.use(
  express.static(landing, {
    maxAge: "5m",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    },
  }),
);

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`Pal API listening on :${port} (MOCK_AI=${process.env.MOCK_AI ?? "0"})`));
