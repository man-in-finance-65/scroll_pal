import { cache, normalizeUrl, urlHash, youtubeId } from "./cache.js";
import { readRecipe } from "./gemini.js";
import { MOCK_RECIPE } from "./mock.js";
import type { Recipe } from "./schema.js";

export class IngestError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const CAPTION_ASK = "That link was too hard to digest. Paste the caption and I'll try that instead.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOnce(input: { youtubeUrl?: string; caption?: string }): Promise<Recipe> {
  const mode = process.env.MOCK_AI;
  if (mode === "1") {
    await sleep(1200); // long enough to see Pal "Thinking"
    return MOCK_RECIPE;
  }
  if (mode === "fail") throw new Error("Simulated Gemini failure (MOCK_AI=fail)");
  return readRecipe(input);
}

// Try, retry once, then give up with a plain-English error.
async function withRetry(input: { youtubeUrl?: string; caption?: string }): Promise<Recipe> {
  try {
    return await callOnce(input);
  } catch (e) {
    console.warn(`ingest attempt 1 failed: ${(e as Error).message}; retrying once`);
    await sleep(800);
    try {
      return await callOnce(input);
    } catch (e2) {
      console.error(`ingest attempt 2 failed: ${(e2 as Error).message}`);
      throw new IngestError(502, "gemini_failed", CAPTION_ASK);
    }
  }
}

export async function ingest(url: string, caption?: string): Promise<{ recipe: Recipe; cached: boolean }> {
  const ytId = youtubeId(url);
  if (!ytId && !caption) {
    throw new IngestError(422, "caption_needed", "I can only watch YouTube links for now. Paste the caption and I'll digest that.");
  }
  // Caption text changes the answer, so it is part of the cache key.
  const key = urlHash(url) + (caption ? ":" + urlHash(caption) : "");
  const hit = cache.get<Recipe>(key);
  if (hit) return { recipe: hit, cached: true };

  const recipe = await withRetry({ youtubeUrl: ytId ? normalizeUrl(url) : undefined, caption });
  if (recipe.confidence < 0.2) {
    throw new IngestError(422, "not_a_recipe", "I couldn't find a recipe in that one. If there is one, paste the caption and I'll take another bite.");
  }
  cache.set(key, recipe);
  return { recipe, cached: false };
}
