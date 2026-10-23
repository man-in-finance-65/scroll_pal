// Speed test for reading real recipe videos with Gemini. Run by the "Gemini speed test" GitHub workflow (uses GEMINI_TOKEN).
// Prints which models exist, then how long each setting takes on real Shorts. Never prints the key.
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { Recipe } from "../src/schema.js";

const key = process.env.GEMINI_API_KEY;
if (!key) { console.error("GEMINI_API_KEY missing"); process.exit(1); }
const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 170_000 } });

const URLS = (process.env.BENCH_URLS || "https://www.youtube.com/watch?v=chl5Fx_-Fmk,https://www.youtube.com/watch?v=GKT0ZKpidMc").split(",");
const schema = (() => { const { $schema, ...rest } = z.toJSONSchema(Recipe) as Record<string, unknown>; return rest; })();
const PROMPT = `Write the recipe from this cooking video as JSON. source "stated" = said or shown on screen, "estimated" = your guess.
Keep it SHORT: at most 8 steps, each under 20 words; ingredient names plain. macros are per ONE serving. cuisine is one or two words.`;

type Cfg = { name: string; model: string; config: Record<string, unknown> };
const CFGS: Cfg[] = [
  { name: "A current (latest, default thinking)", model: "gemini-flash-latest", config: {} },
  { name: "B latest + thinking budget 0", model: "gemini-flash-latest", config: { thinkingConfig: { thinkingBudget: 0 } } },
  { name: "C latest + thinking MINIMAL", model: "gemini-flash-latest", config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } },
  { name: "D latest + thinking LOW + low media res", model: "gemini-flash-latest", config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, mediaResolution: "MEDIA_RESOLUTION_LOW" } },
  { name: "E 2.5-flash + budget 0", model: "gemini-2.5-flash", config: { thinkingConfig: { thinkingBudget: 0 } } },
  { name: "F flash-lite-latest + budget 0", model: "gemini-flash-lite-latest", config: { thinkingConfig: { thinkingBudget: 0 } } },
];

async function run(cfg: Cfg, url: string) {
  const t0 = Date.now();
  try {
    const res = await ai.models.generateContent({
      model: cfg.model,
      contents: [{ role: "user", parts: [{ fileData: { fileUri: url } }, { text: PROMPT }] }],
      config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.2, ...cfg.config },
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const r = Recipe.parse(JSON.parse(res.text ?? ""));
    const u = res.usageMetadata;
    return `${secs}s OK  "${r.title}" | ${r.ingredients.length} ingr | ${r.steps.length} steps | conf ${r.confidence} | tokens in ${u?.promptTokenCount} out ${u?.candidatesTokenCount} think ${u?.thoughtsTokenCount ?? 0}`;
  } catch (e) {
    return `${((Date.now() - t0) / 1000).toFixed(1)}s FAIL ${(e as Error).message.replace(key!, "***").slice(0, 160)}`;
  }
}

console.log("== Flash models this key can use:");
try {
  const names: string[] = [];
  for await (const m of await ai.models.list({ config: { pageSize: 100 } })) if (/flash/i.test(m.name ?? "")) names.push((m.name ?? "").replace("models/", ""));
  console.log(names.join(", "));
} catch (e) { console.log("list failed:", (e as Error).message.slice(0, 120)); }

for (const url of URLS) {
  console.log(`\n== ${url}`);
  const out = await Promise.all(CFGS.map(async (c) => `${c.name.padEnd(42)} ${await run(c, url)}`));
  console.log(out.join("\n"));
}
