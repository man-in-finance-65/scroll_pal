// Watching a reel: Apify fetches the video file for a link the user pasted (no Instagram login),
// then Gemini watches it and writes the recipe. This is how Pal "reads" a reel from just a link.
import type { Dish } from "../../engine/swap.ts";
import { PodError } from "../../engine/pods.ts";
import { toDish } from "./extract.ts";

const MAX_INLINE_BYTES = 18 * 1024 * 1024; // Gemini's inline limit is about 20 MB

const RECIPE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_dish: { type: "BOOLEAN" },
    name: { type: "STRING" },
    ingredients: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { name: { type: "STRING" }, qty_per_serving: { type: "NUMBER" }, unit: { type: "STRING" } }, required: ["name", "qty_per_serving", "unit"] },
    },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    macros_per_serving: {
      type: "OBJECT",
      properties: { kcal: { type: "NUMBER" }, protein_g: { type: "NUMBER" }, carbs_g: { type: "NUMBER" }, fat_g: { type: "NUMBER" } },
      required: ["kcal", "protein_g", "carbs_g", "fat_g"],
    },
  },
  required: ["is_dish", "name", "ingredients", "steps", "macros_per_serving"],
};

const PROMPT = `Watch this food reel and write it up as a meal-prep recipe.
Give every ingredient shown, said or written on screen, with the quantity for ONE serving (divide if the reel makes several; estimate a normal portion if no amounts are given).
Use plain grocery names ("onion", not "finely diced onion"); put preparation in the steps. Units: g, kg, ml, l, tsp, tbsp, cup, oz, lb, or "" for a count.
Write short, ordered steps and estimate macros for one serving. Ignore health claims and promo codes.
If the reel is not a dish someone could cook, set is_dish to false.`;

export async function fetchReel(url: string, apifyToken: string): Promise<{ videoUrl?: string; caption: string }> {
  const res = await fetch("https://api.apify.com/v2/acts/apify~instagram-scraper/runs?waitForFinish=120", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apifyToken}` },
    body: JSON.stringify({ directUrls: [url], resultsType: "posts", resultsLimit: 1 }),
  });
  if (!res.ok) throw new PodError("Pal couldn't open that reel. Check the link, or upload a screenshot instead.");
  const run = (await res.json()).data;
  if (run.status !== "SUCCEEDED") throw new PodError("Pal couldn't open that reel. Is the account private?");
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items`, { headers: { authorization: `Bearer ${apifyToken}` } })).json();
  if (!items[0]) throw new PodError("Pal couldn't find that reel. It may be private or deleted.");
  return { videoUrl: items[0].videoUrl, caption: items[0].caption ?? "" };
}

export async function watchReel(url: string, opts: { apifyToken: string; geminiKey: string; model: string }): Promise<Dish> {
  const reel = await fetchReel(url, opts.apifyToken);
  if (!reel.videoUrl) throw new PodError("That post has no video. Try a reel, or upload a screenshot.");
  const video = Buffer.from(await (await fetch(reel.videoUrl)).arrayBuffer());
  if (video.length > MAX_INLINE_BYTES) throw new PodError("That reel is too long for Pal right now. Try a shorter one.");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": opts.geminiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType: "video/mp4", data: video.toString("base64") } }, { text: reel.caption ? `${PROMPT}\n\nThe reel's caption:\n${reel.caption}` : PROMPT }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RECIPE_SCHEMA },
    }),
  });
  if (!res.ok) throw new PodError("Pal couldn't watch that reel just now. Try again in a minute.");
  const text = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new PodError("Pal watched the reel but didn't get a recipe. Try another one.");
  return toDish(JSON.parse(text));
}
