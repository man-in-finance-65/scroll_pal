import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan } from "./claude.js";
import { IngestError, ingest } from "./ingest.js";
import { limit } from "./limit.js";
import { mockPlan, simplePlan } from "./mock.js";
import { EventBody, FeedbackBody, IngestBody, PalBody, PlanBody } from "./schema.js";
import { sheetTime, toSheet } from "./sheet.js";

const app = express();
app.set("trust proxy", true); // behind Cloud Run: req.ip is the visitor, not Google
app.use(express.json({ limit: "200kb" }));
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
  if (!body.success) return bad(res, "Send {url, caption?}.");
  try {
    const { recipe, cached } = await ingest(body.data.url, body.data.caption);
    console.log(`ingest ok cached=${cached} title="${recipe.title}"`);
    res.json({ ...recipe, cached });
  } catch (e) {
    if (e instanceof IngestError) return res.status(e.status).json({ error: e.code, message: e.message });
    console.error("ingest crashed", e);
    res.status(500).json({ error: "server_error", message: "Something upset my tummy. Try again in a moment." });
  }
});

app.post("/v1/plan", async (req: Request, res: Response) => {
  const body = PlanBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {recipe, goal: bulk|cut|maintain, days: 1-7}.");
  const { recipe, goal, days } = body.data;
  try {
    let plan;
    if (process.env.MOCK_AI === "1") plan = mockPlan(goal, days);
    else if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("plan: ANTHROPIC_API_KEY not set, using the simple built-in planner");
      plan = simplePlan(recipe, goal, days);
    } else plan = await buildPlan(recipe, goal, days);
    res.json(plan);
  } catch (e) {
    console.error("plan failed", e);
    res.status(502).json({ error: "plan_failed", message: "I couldn't dream up a plan just now. Try again in a moment." });
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
