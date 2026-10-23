import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { Plan, Recipe } from "./schema.js";

const PROMPT = `You are reading a cooking video, social post, or recipe page (or its caption) and writing the recipe down.
Return ONLY the JSON object described by the schema.
Keep it SHORT: at most 8 steps, each under 20 words. Plain ingredient names.
Rules:
- source "stated": the amount or number is said, shown on screen, or written in the caption.
- source "estimated": you are guessing. Use this whenever you are not sure.
- qty is a number (use decimals, e.g. 0.5) or null if the amount is not given and cannot be guessed.
- macros_per_serving is per ONE serving. Use "stated" only if the creator gives the numbers.
- creator is the channel or handle if visible, else "Unknown".
- cuisine is one or two words, e.g. "Korean", "Italian", "Mexican", "Home-style".
- confidence 0..1: how sure you are that this is the actual recipe.
- If this is not a cooking video, set confidence to 0 and fill fields with your best attempt.`;

const jsonSchema = (() => {
  const { $schema, ...rest } = z.toJSONSchema(Recipe) as Record<string, unknown>;
  return rest;
})();

let client: GoogleGenAI | null = null;
const ai = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  return (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
};

export type GeminiInfo = { model: string; ms: number; promptTokens?: number; outputTokens?: number; thoughtTokens?: number; thinking: string };

// How hard Gemini "thinks" before answering. Thinking is what makes video reading slow, and reading a recipe
// doesn't need much. Set GEMINI_THINKING to minimal (default), low, or default to try other settings.
function thinkingConfig() {
  switch ((process.env.GEMINI_THINKING || "minimal").toLowerCase()) {
    case "default": return undefined;
    case "low": return { thinkingLevel: ThinkingLevel.LOW };
    default: return { thinkingLevel: ThinkingLevel.MINIMAL };
  }
}

async function generate(model: string, parts: Array<Record<string, unknown>>, timeoutMs: number, withThinking: boolean) {
  return ai().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(timeoutMs), // never hang: Cloud Run gives up on the whole request after a while
      ...(withThinking && thinkingConfig() ? { thinkingConfig: thinkingConfig() } : {}),
    },
  });
}

export async function readRecipe(
  input: { youtubeUrl?: string; caption?: string },
  opts: { model: string; timeoutMs: number },
): Promise<{ recipe: Recipe; info: GeminiInfo }> {
  const parts: Array<Record<string, unknown>> = [];
  if (input.youtubeUrl) parts.push({ fileData: { fileUri: input.youtubeUrl } });
  if (input.caption) parts.push({ text: `Caption / description text:\n${input.caption}` });
  parts.push({ text: PROMPT });

  const t0 = Date.now();
  let thinking = process.env.GEMINI_THINKING || "minimal";
  let res;
  try {
    res = await generate(opts.model, parts, opts.timeoutMs, true);
  } catch (e) {
    // Some models reject the thinking setting right away (HTTP 400). Try once more without it.
    if (/thinking/i.test((e as Error).message) && /400|INVALID_ARGUMENT/i.test((e as Error).message)) {
      thinking = "default (model refused the setting)";
      res = await generate(opts.model, parts, Math.max(10_000, opts.timeoutMs - (Date.now() - t0)), false);
    } else throw e;
  }
  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty answer");
  const u = res.usageMetadata;
  return {
    recipe: Recipe.parse(JSON.parse(text)),
    info: { model: opts.model, ms: Date.now() - t0, promptTokens: u?.promptTokenCount, outputTokens: u?.candidatesTokenCount, thoughtTokens: u?.thoughtsTokenCount, thinking },
  };
}

// Meal plan from Gemini: the second choice when Claude isn't set up or is down, before the plain built-in planner.
const planSchema = (() => {
  const { $schema, ...rest } = z.toJSONSchema(Plan) as Record<string, unknown>;
  return rest;
})();

export async function planWithGemini(prompt: string): Promise<Plan> {
  const res = await ai().models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: planSchema,
      temperature: 0.8,
      abortSignal: AbortSignal.timeout(45_000),
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    },
  });
  if (!res.text) throw new Error("Gemini returned no plan");
  return Plan.parse(JSON.parse(res.text));
}
