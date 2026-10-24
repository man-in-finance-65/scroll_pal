import express from "express";
import { HttpError } from "./errors.js";
import {
  perPortion, resolveLine, sumLines, swapDelta, truncMacros, addMacros, ZERO,
  type Line, type UsdaLookup,
} from "./nutrition.js";
import { GoalFitRequest, LlmRecipe, RecipeSchema, StrictSwaps, type Goal, type Recipe } from "./schema.js";
import { parseSupportedUrl, unsupportedUrlMessage, type Platform } from "./urls.js";
import type { Media } from "./media.js";
import type { Segment } from "./whisper.js";
import type { ExtractInput } from "./llm.js";

export type Deps = {
  fetchMedia: (url: string, platform: Platform) => Promise<Media>;
  transcribe: (audioPath: string) => Promise<Segment[]>;
  extractRecipe: (input: ExtractInput) => Promise<unknown>;
  proposeSwaps: (recipe: Recipe, goal: Goal) => Promise<unknown>;
  usda: UsdaLookup;
};

type ZodLike = { issues: unknown[] };
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

export function createApp(deps: Deps) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const ingestCache = new Map<string, Recipe>();
  const fitCache = new Map<string, unknown>();

  app.post("/v1/ingest", async (req, res) => {
    const parsed = parseSupportedUrl(req.body?.url);
    if (!parsed) throw new HttpError(400, unsupportedUrlMessage(req.body?.url));
    const cached = ingestCache.get(parsed.url);
    if (cached) return void res.json(cached);

    let media: Media;
    try {
      media = await deps.fetchMedia(parsed.url, parsed.platform);
    } catch (e) {
      throw new HttpError(502, `Could not download the video: ${(e as Error).message}`);
    }
    try {
      const transcript = await deps.transcribe(media.audioPath).catch((e) => {
        throw new HttpError(502, `Transcription failed: ${(e as Error).message}`);
      });
      let raw: unknown;
      try {
        raw = await deps.extractRecipe({ caption: media.caption, transcript });
      } catch (e) {
        throw badModelOutput("output", e as Error);
      }
      const llm = LlmRecipe.safeParse(raw);
      if (!llm.success) throw badModelOutput("a recipe", llm.error);

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
      ingestCache.set(parsed.url, strict.data);
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
      throw badModelOutput("output", e as Error);
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

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message, ...err.extra });
    if (err instanceof SyntaxError) return void res.status(400).json({ error: "Request body is not valid JSON." });
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  });
  return app;
}
