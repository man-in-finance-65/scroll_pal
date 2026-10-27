import { cache, normalizeUrl, urlHash, youtubeId } from "./cache.js";
import { readRecipe, readRecipeFromUrl, type GeminiInfo } from "./gemini.js";
import { MOCK_RECIPE } from "./mock.js";
import { pageToCaption, readPage } from "./page.js";
import type { Recipe } from "./schema.js";

export class IngestError extends Error {
  constructor(public status: number, public code: string, message: string, public detail?: string) {
    super(message);
  }
}

const CAPTION_ASK = "That link was too hard to digest. Paste the caption and I'll try that instead.";
const HIDDEN_ASK = "That one was hard to digest. The site keeps its caption to itself. Copy the caption and paste it below, and I'll take it from there.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Attempt 1 uses the main model. Attempt 2 (the one retry) uses a smaller, faster model with a shorter limit.
// Total stays under the app's own 150 s wait.
const attempts = () => [
  { model: process.env.GEMINI_MODEL || "gemini-flash-latest", timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 80_000 },
  { model: process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest", timeoutMs: 50_000 },
];

// Short, safe text about what went wrong. Never includes a key.
const cleanDetail = (e: unknown) => {
  let text = String((e as Error)?.message ?? e);
  try { text = JSON.parse(text)?.error?.message ?? text; } catch {} // Google errors arrive as JSON: keep just the message
  return text.replace(/AIza[0-9A-Za-z_-]{20,}/g, "***").replace(/\s+/g, " ").slice(0, 220);
};

async function callOnce(input: { youtubeUrl?: string; caption?: string }, a: { model: string; timeoutMs: number }): Promise<{ recipe: Recipe; info?: GeminiInfo }> {
  const mode = process.env.MOCK_AI;
  if (mode === "1") {
    await sleep(1200); // long enough to see Pal "Thinking"
    return { recipe: MOCK_RECIPE };
  }
  if (mode === "fail") throw new Error("Simulated Gemini failure (MOCK_AI=fail)");
  return readRecipe(input, a);
}

async function withRetry(input: { youtubeUrl?: string; caption?: string }): Promise<{ recipe: Recipe; info?: GeminiInfo }> {
  const tries = attempts();
  let detail = "";
  for (let i = 0; i < tries.length; i++) {
    const t0 = Date.now();
    try {
      const out = await callOnce(input, tries[i]);
      if (i > 0) console.warn(`ingest recovered on attempt ${i + 1} with ${tries[i].model}`);
      return out;
    } catch (e) {
      detail = `${tries[i].model}: ${cleanDetail(e)} (after ${((Date.now() - t0) / 1000).toFixed(0)}s)`;
      console.warn(`ingest attempt ${i + 1} failed: ${detail}`);
      // YouTube refuses Gemini for private, removed or age restricted videos. A retry can't help.
      if (input.youtubeUrl && /does not have permission|PERMISSION_DENIED/i.test(detail)) {
        throw new IngestError(422, "video_unavailable", "I can't open that video. It might be private or removed. Paste the caption and I'll read that instead.", detail);
      }
      // No credits left (HTTP 402): a retry can't help, and the owner needs to know.
      if (/\b402\b|prepayment|credits are depleted|billing/i.test(detail)) {
        throw new IngestError(503, "gemini_billing", "I've run out of brain power for now. Whoever runs me needs to top up my Gemini credits.", detail);
      }
      if (i < tries.length - 1) await sleep(500);
    }
  }
  throw new IngestError(502, "gemini_failed", CAPTION_ASK, detail);
}

// Gemini opens the link itself. Returns null (so Pal asks for the caption) when it can't find a real recipe there.
async function readLinkWithGemini(url: string): Promise<{ recipe: Recipe; info: GeminiInfo } | null> {
  const a = attempts()[0];
  try {
    const { recipe, info, opened } = await readRecipeFromUrl(url, { model: a.model, timeoutMs: 60_000 });
    console.log(`ingest via Gemini link reading: opened=${opened} confidence=${recipe.confidence} title="${recipe.title}"`);
    // Higher bar than usual: with no page text of our own, a low score usually means a guess.
    return recipe.confidence >= 0.5 ? { recipe, info } : null;
  } catch (e) {
    console.warn(`ingest via Gemini link reading failed: ${a.model}: ${cleanDetail(e)}`);
    return null;
  }
}

export type Digested = Recipe & { image: string | null; source_url: string };

export async function ingest(url: string, caption?: string): Promise<{ recipe: Digested; cached: boolean; info?: GeminiInfo }> {
  const ytId = youtubeId(url);
  // Caption text changes the answer, so it is part of the cache key.
  const key = urlHash(url) + (caption ? ":" + urlHash(caption) : "");
  const hit = cache.get<Digested>(key);
  if (hit) return { recipe: hit, cached: true };

  // YouTube: Gemini watches the video itself. Anything else: Pal reads the page (caption, recipe data, text),
  // plus whatever the user pasted.
  let image: string | null = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
  let text = caption;
  if (!ytId) {
    if (!/^https?:\/\//i.test(url.trim())) throw new IngestError(422, "bad_link", "That doesn't look like a link. Paste the full address, starting with https://");
    const page = process.env.MOCK_AI === "1" ? null : await readPage(url).catch(() => null);
    if (page) {
      image = page.image;
      const body = pageToCaption(page, caption && `Caption pasted by the user: ${caption}`);
      // Almost nothing readable (a login wall, a video-only page): ask for the caption instead of guessing.
      text = body.replace(/Title: [^\n]*\n?/, "").trim().length >= 40 || caption ? body : undefined;
    }
    // Our server couldn't read it (many sites block servers): let Gemini open the link from Google's side.
    if (!text && process.env.MOCK_AI !== "1") {
      const viaGemini = await readLinkWithGemini(url.trim());
      if (!viaGemini) throw new IngestError(422, "caption_needed", HIDDEN_ASK);
      const out: Digested = { ...viaGemini.recipe, image, source_url: url.trim() };
      cache.set(key, out);
      return { recipe: out, cached: false, info: viaGemini.info };
    }
  }

  const { recipe, info } = await withRetry({ youtubeUrl: ytId ? normalizeUrl(url) : undefined, caption: text });
  if (recipe.confidence < 0.2) {
    throw new IngestError(422, "not_a_recipe", "I couldn't find a recipe in that one. If there is one, paste the caption and I'll take another bite.");
  }
  const out: Digested = { ...recipe, image, source_url: url.trim() };
  cache.set(key, out);
  return { recipe: out, cached: false, info };
}
