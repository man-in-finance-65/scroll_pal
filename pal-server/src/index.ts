import { createApp } from "./app.js";
import { extractRecipe, proposeSwaps, scanPantry } from "./llm.js";
import { fetchMedia } from "./media.js";
import { createUsda } from "./usda.js";
import { transcribe } from "./whisper.js";

const appSecret = process.env.APP_SECRET;
if (!appSecret || appSecret.length < 16) {
  throw new Error("APP_SECRET must be set to a random string of at least 16 characters (see .env.example).");
}
const KEY_VARS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "USDA_API_KEY", "INSTACART_API_KEY", "APP_SECRET", "YTDLP_COOKIES"];
const missing = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "USDA_API_KEY"].filter((k) => !process.env[k]);
if (missing.length) console.warn(`Warning: ${missing.join(", ")} not set. Endpoints that need them will return an error.`);

const app = createApp(
  { fetchMedia, transcribe, extractRecipe, proposeSwaps, scanPantry, usda: createUsda(process.env.USDA_API_KEY) },
  {
    appSecret,
    instacartKey: process.env.INSTACART_API_KEY || undefined,
    secrets: KEY_VARS.map((k) => process.env[k] ?? ""),
  },
);
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`pal-server listening on http://localhost:${port}`));
