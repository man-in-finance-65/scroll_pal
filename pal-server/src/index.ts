import { createApp } from "./app.js";
import { extractRecipe, proposeSwaps } from "./llm.js";
import { fetchMedia } from "./media.js";
import { createUsda } from "./usda.js";
import { transcribe } from "./whisper.js";

const app = createApp({
  fetchMedia,
  transcribe,
  extractRecipe,
  proposeSwaps,
  usda: createUsda(process.env.USDA_API_KEY),
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`pal-server listening on http://localhost:${port}`));
