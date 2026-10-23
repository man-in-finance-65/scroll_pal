// Runs real YouTube links through the same code the API uses (real Gemini, real cost: a few cents).
// Usage:  npm run test:links -- <url1> <url2> <url3>
import { ingest } from "../src/ingest.js";

const urls = process.argv.slice(2);
if (urls.length === 0) {
  console.error("Give me 1-3 YouTube Shorts recipe links:  npm run test:links -- <url1> <url2> <url3>");
  process.exit(1);
}
if (process.env.MOCK_AI === "1") console.warn("MOCK_AI=1 is on, so this is NOT a real test. Unset it in api/.env.");

let failed = 0;
for (const url of urls) {
  const t0 = Date.now();
  try {
    const { recipe: r } = await ingest(url);
    const est = r.ingredients.filter((i) => i.source === "estimated").length;
    console.log(`PASS ${url}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    console.log(`  ${r.title} by ${r.creator} | ${r.cuisine} | serves ${r.servings} | confidence ${r.confidence}`);
    console.log(`  ${r.ingredients.length} ingredients (${est} estimated), ${r.steps.length} steps, ` +
      `${r.macros_per_serving.kcal} kcal/serving (${r.macros_per_serving.source})`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${url}: ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
