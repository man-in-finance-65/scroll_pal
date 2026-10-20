// Gate B: reel URL in, recipe JSON out. No app, no database.
// Usage: npm run gate:b                                   (reels.food.txt, video only)
//        npm run gate:b -- --caption                      (fallback 1: caption text plus video)
//        npm run gate:b -- --file reels.not-food.txt --expect-none   (filter test: no recipes allowed)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { score, scoreFilter, type ReelResult } from "./score.ts";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env (see docs/GATE0_CHECKLIST.md)`);
  return v;
};
const GEMINI_KEY = env("GEMINI_API_KEY");
const APIFY_TOKEN = env("APIFY_TOKEN");
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PRICE_IN = Number(process.env.GEMINI_PRICE_INPUT_PER_M) || null;
const PRICE_OUT = Number(process.env.GEMINI_PRICE_OUTPUT_PER_M) || null;
const APIFY_PER_1000 = Number(process.env.APIFY_PRICE_PER_1000) || null;
const WITH_CAPTION = process.argv.includes("--caption");
const DIR = "scripts/gate-b";
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const FILE = arg("--file") ?? "reels.food.txt";
const EXPECT_NONE = process.argv.includes("--expect-none");
const MAX_INLINE_BYTES = 18 * 1024 * 1024; // Gemini inline request limit is about 20 MB

const urls = readFileSync(`${DIR}/${FILE}`, "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

// Apify: fetch the media for a URL the user gave us. No Instagram login involved.
async function fetchReel(url: string) {
  const res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/runs?waitForFinish=120`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${APIFY_TOKEN}` },
    body: JSON.stringify({ directUrls: [url], resultsType: "posts", resultsLimit: 1 }),
  });
  if (!res.ok) throw new Error(`Apify run ${res.status}: ${await res.text()}`);
  const run = (await res.json()).data;
  if (run.status !== "SUCCEEDED") throw new Error(`Apify run ended ${run.status}`);
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items`, {
    headers: { authorization: `Bearer ${APIFY_TOKEN}` },
  })).json();
  const item = items[0];
  if (!item) throw new Error("Apify returned no post");
  return {
    videoUrl: item.videoUrl as string | undefined,
    caption: (item.caption as string | undefined) ?? "",
    // The actor bills per result (pay per event), so cost = results x price.
    apifyUsd: APIFY_PER_1000 ? (items.length * APIFY_PER_1000) / 1000 : null,
  };
}

const RECIPE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_recipe: { type: "BOOLEAN" },
    title: { type: "STRING" },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          qty: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true },
          estimate: { type: "BOOLEAN" },
        },
        required: ["name", "qty", "unit", "estimate"],
      },
    },
    steps: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["is_recipe", "title", "ingredients", "steps"],
};

const PROMPT = `Watch this Instagram reel. If it shows how to make a dish, write the recipe.
- ingredients: every ingredient shown, said or written on screen.
- qty and unit: only when the reel shows or says them. If you are judging the amount from what you see, give your best number and set estimate to true. If you cannot tell at all, set qty to null and estimate to false.
- steps: short, in order.
- Do not include calories, macros or health claims.
If the reel is not a recipe, set is_recipe to false and leave the lists empty.`;

async function watchReel(videoUrl: string, caption: string) {
  const video = Buffer.from(await (await fetch(videoUrl)).arrayBuffer());
  if (video.length > MAX_INLINE_BYTES) throw new Error(`video is ${(video.length / 1e6).toFixed(1)} MB, over the inline limit`);
  const parts: object[] = [{ inlineData: { mimeType: "video/mp4", data: video.toString("base64") } }];
  parts.push({ text: WITH_CAPTION && caption ? `${PROMPT}\n\nThe reel's caption:\n${caption}` : PROMPT });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RECIPE_SCHEMA },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(body).slice(0, 300)}`);
  const u = body.usageMetadata ?? {};
  return { recipe: JSON.parse(text), tokensIn: u.promptTokenCount ?? 0, tokensOut: u.candidatesTokenCount ?? 0 };
}

const results: (ReelResult & { tokensIn?: number; tokensOut?: number; apifyUsd?: number | null })[] = [];
for (const url of urls) {
  const start = Date.now();
  try {
    const reel = await fetchReel(url);
    if (!reel.videoUrl) throw new Error("post has no video");
    const { recipe, tokensIn, tokensOut } = await watchReel(reel.videoUrl, reel.caption);
    const geminiUsd = PRICE_IN && PRICE_OUT ? (tokensIn * PRICE_IN + tokensOut * PRICE_OUT) / 1e6 : null;
    const costUsd = geminiUsd !== null && reel.apifyUsd !== null ? geminiUsd + reel.apifyUsd : null;
    results.push({ url, ok: true, recipe, seconds: (Date.now() - start) / 1000, costUsd, tokensIn, tokensOut, apifyUsd: reel.apifyUsd });
  } catch (e) {
    results.push({ url, ok: false, recipe: null, seconds: (Date.now() - start) / 1000, costUsd: null, error: String(e) });
  }
  const r = results.at(-1)!;
  console.log(`${r.ok ? "OK  " : "FAIL"} ${r.seconds.toFixed(0)}s ${r.costUsd !== null ? "$" + r.costUsd.toFixed(4) : "$?"} ${url} ${r.error ?? r.recipe?.title ?? ""}`);
}

const verdict = EXPECT_NONE ? scoreFilter(results) : score(results);
mkdirSync(`${DIR}/out`, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(`${DIR}/out/results-${stamp}.json`, JSON.stringify({ model: MODEL, file: FILE, withCaption: WITH_CAPTION, verdict, results }, null, 2));
console.log(`\nGate B: ${verdict.pass ? "PASS" : "FAIL"}`);
for (const [name, c] of Object.entries(verdict.checks)) console.log(`  ${c.pass ? "pass" : "FAIL"}  ${name}: ${c.value}`);
console.log(`Saved scripts/gate-b/out/results-${stamp}.json`);
