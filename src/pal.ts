import { PalResult } from './types';

// Tried in order; busy or rate-limited models fall through to the next one.
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const ROUNDS = 2;
const TIMEOUT_MS = 15000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PROMPT = `You are Pal, an assistant that turns social media reels into real-world action.
The user saved a reel. From the caption, link and/or screenshot, produce:
- title: short, specific (max 6 words)
- summary: 1-2 sentences on what the reel teaches or shows
- category: one of recipe, workout, learning, product, travel, other
- tasks: 3-6 concrete steps the user can do to act on it (imperative, short)
- shoppingList: items to buy to do it (ingredients for recipes, gear for workouts); empty if none
Respond with JSON only.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    category: {
      type: 'STRING',
      enum: ['recipe', 'workout', 'learning', 'product', 'travel', 'other'],
    },
    tasks: { type: 'ARRAY', items: { type: 'STRING' } },
    shoppingList: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'summary', 'category', 'tasks', 'shoppingList'],
};

export type PalInput = {
  apiKey: string;
  url?: string;
  caption?: string;
  image?: { base64: string; mimeType: string };
  onStatus?: (msg: string) => void;
};

export async function askPal({ apiKey, url, caption, image, onStatus }: PalInput): Promise<PalResult> {
  const parts: object[] = [{ text: PROMPT }];
  if (url) parts.push({ text: `Reel link: ${url}` });
  if (caption) parts.push({ text: `Caption / notes: ${caption}` });
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });

  const payload = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
  });

  let lastError = 'Gemini is busy. Try again in a minute.';
  for (let round = 0; round < ROUNDS; round++) {
    for (const model of MODELS) {
      onStatus?.(round === 0 && model === MODELS[0] ? 'Pal is reading your reel…' : 'Gemini is busy, trying another route…');
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: payload,
          signal: ctl.signal,
        },
      ).catch(() => null);
      clearTimeout(timer);
      if (!res) {
        lastError = 'Gemini took too long to answer.';
        continue;
      }
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Pal returned an empty answer. Try adding the caption.');
        return JSON.parse(text);
      }
      lastError = body?.error?.message ?? `Gemini error ${res.status}`;
      if (!RETRYABLE.has(res.status) && res.status !== 404) throw new Error(lastError);
    }
    await sleep(1000);
  }
  throw new Error(lastError);
}
