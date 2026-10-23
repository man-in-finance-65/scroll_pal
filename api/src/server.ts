import express, { type Request, type Response } from "express";
import { buildPlan } from "./claude.js";
import { IngestError, ingest } from "./ingest.js";
import { mockPlan } from "./mock.js";
import { EventBody, IngestBody, PlanBody } from "./schema.js";

const app = express();
app.use(express.json({ limit: "200kb" }));
// Phones don't need this; it lets the web preview of the app call the API too.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

const bad = (res: Response, message: string) => res.status(400).json({ error: "bad_request", message });

app.get("/", (_req, res) => res.json({ ok: true, mock: process.env.MOCK_AI === "1" }));

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
    res.status(500).json({ error: "server_error", message: "Something broke on Pal's side. Try again." });
  }
});

app.post("/v1/plan", async (req: Request, res: Response) => {
  const body = PlanBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {recipe, goal: bulk|cut|maintain, days: 1-7}.");
  const { recipe, goal, days } = body.data;
  try {
    const plan = process.env.MOCK_AI === "1" ? mockPlan(goal, days) : await buildPlan(recipe, goal, days);
    res.json(plan);
  } catch (e) {
    console.error("plan failed", e);
    res.status(502).json({ error: "plan_failed", message: "Pal couldn't build the plan just now. Try again in a moment." });
  }
});

// One line per tap, so you can count them in Cloud Run logs:  grep "EVENT type=done"
app.post("/v1/event", (req: Request, res: Response) => {
  const body = EventBody.safeParse(req.body);
  if (!body.success) return bad(res, "Send {type: share|plan|done|skip}.");
  const { type, device = "unknown", ref = "" } = body.data;
  console.log(`EVENT type=${type} device=${device} ref="${ref.replace(/"/g, "'")}" ts=${new Date().toISOString()}`);
  res.status(204).end();
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`Pal API listening on :${port} (MOCK_AI=${process.env.MOCK_AI ?? "0"})`));
