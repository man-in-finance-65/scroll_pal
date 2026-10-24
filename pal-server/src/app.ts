import { timingSafeEqual } from "node:crypto";
import express from "express";
import { buildCart, CartRequest } from "./cart.js";
import { HttpError } from "./errors.js";
import { normalizePantryList } from "./pantry.js";
import {
  perPortion, resolveLine, sumLines, swapDelta, truncMacros, addMacros, ZERO,
  type Line, type UsdaLookup,
} from "./nutrition.js";
import { GoalFitRequest, LlmPantry, LlmRecipe, RecipeSchema, StrictSwaps, type Goal, type Recipe } from "./schema.js";
import { parseSupportedUrl, unsupportedUrlMessage, type Platform } from "./urls.js";
import type { Media } from "./media.js";
import type { Segment } from "./whisper.js";
import type { ExtractInput, ImageType } from "./llm.js";

export type Deps = {
  fetchMedia: (url: string, platform: Platform) => Promise<Media>;
  transcribe: (audioPath: string) => Promise<Segment[]>;
  extractRecipe: (input: ExtractInput) => Promise<unknown>;
  proposeSwaps: (recipe: Recipe, goal: Goal) => Promise<unknown>;
  scanPantry: (base64: string, mediaType: ImageType) => Promise<unknown>;
  usda: UsdaLookup;
};

export type Config = {
  /** Every /v1 request must send this in the X-App-Secret header. */
  appSecret: string;
  instacartKey?: string;
  /** Requests allowed per IP per window, across all /v1 endpoints. */
  rateLimit?: { max: number; windowMs: number };
  /** Values that must never appear in logs or error responses (API keys). */
  secrets?: string[];
};

type ZodLike = { issues: unknown[] };
/** A failed call to the model (no key, network, API error) is not a validation failure; JSON garbage is. */
const modelFailed = (e: unknown) =>
  e instanceof SyntaxError ? badModelOutput("output", e) : new HttpError(502, `The AI request failed: ${(e as Error).message}`);
const badModelOutput = (what: string, err: ZodLike | Error) =>
  new HttpError(502, `The model returned ${what} that failed validation. Nothing was returned.`, {
    validation_error: "issues" in err ? err.issues : err.message,
  });

/** Per-portion macros of a recipe, from USDA. Unmatched ingredients are listed and left out. */
async function analyse(ingredients: Recipe["ingredients"], portions: number, usda: UsdaLookup) {
  const lines = await Promise.all(ingredients.map((i) => resolveLine(i, usda)));
  return { lines, macros: truncMacros(perPortion(sumLines(lines), portions)) };
}
const unmatchedOf = (lines: Line[]) => lines.filter((l) => l.status === "unmatched").map((l) => l.name);

function checkSecret(expected: string): express.RequestHandler {
  const want = Buffer.from(expected);
  return (req, _res, next) => {
    const got = Buffer.from(String(req.get("x-app-secret") ?? ""));
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      throw new HttpError(401, "Missing or wrong X-App-Secret header. The app and server must use the same APP_SECRET.");
    }
    next();
  };
}

/** Fixed-window per-IP limiter, in memory (resets when the server restarts; fine for one small instance). */
function rateLimit({ max, windowMs }: { max: number; windowMs: number }): express.RequestHandler {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++h.n > max) {
      const wait = Math.ceil((h.reset - now) / 1000);
      res.set("retry-after", String(wait));
      throw new HttpError(429, `Too many requests: limit is ${max} per ${windowMs / 60_000} min. Try again in ${wait} s.`);
    }
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
}

/** Image magic bytes -> media type. Only formats the vision model accepts. */
function sniffImage(buf: Buffer): ImageType | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export function createApp(deps: Deps, config: Config) {
  const app = express();
  // Cloud Run sits behind Google's proxy; trust it so req.ip is the phone's address, not the proxy's.
  app.set("trust proxy", true);
  const redact = (text: string) =>
    (config.secrets ?? []).filter((k) => k.length >= 8).reduce((t, k) => t.split(k).join("[redacted]"), text);

  app.get("/health", (_req, res) => void res.json({ ok: true }));
  app.use("/v1", rateLimit(config.rateLimit ?? { max: 60, windowMs: 15 * 60_000 }), checkSecret(config.appSecret));
  // Pantry photos arrive as base64; a phone photo resized by the app is well under this.
  app.use(express.json({ limit: "8mb" }));

  const ingestCache = new Map<string, { recipe: Recipe; note: string | null }>();
  const fitCache = new Map<string, unknown>();

  app.post("/v1/ingest", async (req, res) => {
    const parsed = parseSupportedUrl(req.body?.url);
    if (!parsed) throw new HttpError(400, unsupportedUrlMessage(req.body?.url));
    const cached = ingestCache.get(parsed.url);
    if (cached) {
      if (cached.note) res.set("x-pal-note", cached.note);
      return void res.json(cached.recipe);
    }

    let media: Media;
    try {
      media = await deps.fetchMedia(parsed.url, parsed.platform);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(502, `Could not download the video: ${(e as Error).message}`);
    }
    try {
      const transcript = media.audioPath
        ? await deps.transcribe(media.audioPath).catch((e) => {
            throw new HttpError(502, `Transcription failed: ${(e as Error).message}`);
          })
        : null;
      let raw: unknown;
      try {
        raw = await deps.extractRecipe({ caption: media.caption, transcript });
      } catch (e) {
        throw modelFailed(e);
      }
      const llm = LlmRecipe.safeParse(raw);
      if (!llm.success) throw badModelOutput("a recipe", llm.error);
      if (!llm.data.ingredients.length && media.audioError) {
        throw new HttpError(502, `No recipe found. Pal could only read the caption (${media.audioError}) and it has no recipe in it.`);
      }

      // The model never does macro math: they come from USDA.
      const { macros, lines } = await analyse(
        llm.data.ingredients as Recipe["ingredients"],
        Math.max(1, Math.floor(llm.data.recipe.portions)),
        deps.usda,
      );
      const candidate = {
        creator: { ...media.creator, platform: parsed.platform, video_url: parsed.url },
        ...llm.data,
        macros,
      };
      const strict = RecipeSchema.safeParse(candidate);
      if (!strict.success) throw badModelOutput("a recipe", strict.error);
      if (lines.every((l) => l.status === "unmatched")) {
        throw new HttpError(502, "No ingredient could be matched in USDA, so macros cannot be computed.", {
          unmatched: lines,
        });
      }
      // Header, not a body field, so the body stays exactly the agreed recipe shape.
      const note = media.audioError ? `Built from the caption only (${media.audioError}).` : null;
      ingestCache.set(parsed.url, { recipe: strict.data, note });
      if (note) res.set("x-pal-note", note);
      res.json(strict.data);
    } finally {
      await media.cleanup();
    }
  });

  app.post("/v1/goal-fit", async (req, res) => {
    const body = GoalFitRequest.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Invalid goal-fit request.", { validation_error: body.error.issues });
    const { recipe, goal } = body.data;
    const cacheKey = JSON.stringify([recipe.ingredients, recipe.recipe.portions, goal]);
    const hit = fitCache.get(cacheKey);
    if (hit) return void res.json(hit);

    let raw: unknown;
    try {
      raw = await deps.proposeSwaps(recipe, goal);
    } catch (e) {
      throw modelFailed(e);
    }
    const proposed = StrictSwaps.safeParse(raw);
    if (!proposed.success) throw badModelOutput("swaps", proposed.error);

    // Keep only swaps whose `original` is really in the recipe; one swap per ingredient.
    const portions = recipe.recipe.portions;
    const used = new Set<number>();
    const picked = proposed.data.swaps.flatMap((s) => {
      const idx = recipe.ingredients.findIndex((i, n) => !used.has(n) && i.name.toLowerCase() === s.original.trim().toLowerCase());
      if (idx < 0) return [];
      used.add(idx);
      return [{ idx, swap: s }];
    });

    const original = await analyse(recipe.ingredients, portions, deps.usda);
    const results = await Promise.all(
      picked.map(async ({ idx, swap }) => {
        const repl = await resolveLine(swap.replacement, deps.usda);
        const delta = swapDelta(original.lines[idx], repl, portions);
        return {
          idx,
          swap,
          delta,
          unmatched: [original.lines[idx], repl].filter((l) => l.status === "unmatched").map((l) => l.name),
          replLine: repl,
        };
      }),
    );

    // Totals = original + the swap deltas, so the app can reproduce them exactly when swaps are toggled.
    const deltas = truncMacros(results.reduce((acc, r) => (r.delta ? addMacros(acc, r.delta) : acc), ZERO));
    const optimizedIngredients = recipe.ingredients.map((ing, i) => {
      const r = results.find((x) => x.idx === i);
      return r ? { ...ing, name: r.swap.replacement.name, quantity: r.swap.replacement.quantity, unit: r.swap.replacement.unit } : ing;
    });
    const optimizedMacros = truncMacros(addMacros(original.macros, deltas));

    const out = {
      optimized_recipe: { ...recipe, ingredients: optimizedIngredients, macros: optimizedMacros },
      swaps: results.map((r) => ({
        original: recipe.ingredients[r.idx].name,
        replacement: r.swap.replacement.name,
        reason: r.swap.reason,
        delta: r.delta,
        unmatched: r.unmatched,
      })),
      deltas,
      original_macros: original.macros,
      unmatched: [...new Set([...unmatchedOf(original.lines), ...results.flatMap((r) => r.unmatched)])],
    };
    fitCache.set(cacheKey, out);
    res.json(out);
  });

  app.post("/v1/pantry-scan", async (req, res) => {
    const image = req.body?.image;
    if (typeof image !== "string" || !image) throw new HttpError(400, `Expected { image: "<base64>" }, got ${typeof image}.`);
    const data = image.replace(/^data:[^,]*,/, "");
    const mediaType = sniffImage(Buffer.from(data.slice(0, 32), "base64"));
    if (!mediaType) throw new HttpError(400, "The image must be a base64 JPEG, PNG or WebP. Its first bytes match none of those.");
    let raw: unknown;
    try {
      raw = await deps.scanPantry(data, mediaType);
    } catch (e) {
      throw modelFailed(e);
    }
    const parsed = LlmPantry.safeParse(raw);
    if (!parsed.success) throw badModelOutput("a pantry list", parsed.error);
    res.json({ staples: normalizePantryList(parsed.data.staples) });
  });

  app.post("/v1/cart", async (req, res) => {
    const body = CartRequest.safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Invalid cart request.", { validation_error: body.error.issues });
    try {
      res.json(await buildCart(body.data, config.instacartKey));
    } catch (e) {
      throw new HttpError(502, (e as Error).message);
    }
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return void res.status(err.status).json(JSON.parse(redact(JSON.stringify({ error: err.message, ...err.extra }))));
    }
    if (err instanceof SyntaxError) return void res.status(400).json({ error: "Request body is not valid JSON." });
    const type = (err as { type?: string }).type;
    if (type === "entity.too.large") return void res.status(413).json({ error: "Request is too large (limit 8 MB). Use a smaller photo." });
    console.error(redact(err instanceof Error ? (err.stack ?? err.message) : String(err)));
    res.status(500).json({ error: redact(err instanceof Error ? err.message : "Internal error") });
  });
  return app;
}
