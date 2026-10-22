import { PalResult } from './types';

const MODEL = 'gemini-flash-latest';

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
};

export async function askPal({ apiKey, url, caption, image }: PalInput): Promise<PalResult> {
  const parts: object[] = [{ text: PROMPT }];
  if (url) parts.push({ text: `Reel link: ${url}` });
  if (caption) parts.push({ text: `Caption / notes: ${caption}` });
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `Gemini error ${res.status}`);
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Pal returned an empty answer. Try adding the caption.');
  return JSON.parse(text);
}
