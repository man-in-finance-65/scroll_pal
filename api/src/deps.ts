// Real Clerk and SurrealDB wiring. Kept apart from app.ts so tests can swap in fakes.
import { readFileSync } from "node:fs";
import { verifyToken } from "@clerk/backend";
import { RecordId, Surreal } from "surrealdb";
import { PodError } from "../../engine/pods.ts";
import type { Deps, UserRow } from "./app.ts";
import { claudeExtractor, type Extractor } from "./extract.ts";
import { instacartLink } from "./instacart.ts";
import { watchReel } from "./reel.ts";
import { SurrealPodStore } from "./surreal-store.ts";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env (see docs/GATE0_CHECKLIST.md)`);
  return v;
};

export async function realDeps(): Promise<Deps> {
  const secretKey = env("CLERK_SECRET_KEY");
  const db = new Surreal();
  await db.connect(env("SURREAL_URL"), {
    namespace: env("SURREAL_NAMESPACE"),
    database: env("SURREAL_DATABASE"),
    authentication: process.env.SURREAL_TOKEN ?? { username: env("SURREAL_USER"), password: env("SURREAL_PASS") },
  });

  const rid = (clerkId: string) => new RecordId("user", clerkId);
  const prices = JSON.parse(readFileSync(new URL("../../data/prices.json", import.meta.url), "utf8"));
  const extract = pickExtractor();
  const instacartKey = process.env.INSTACART_API_KEY;
  const instacartBase = process.env.INSTACART_BASE_URL || "https://connect.dev.instacart.tools";
  return {
    pods: new SurrealPodStore(db),
    extract,
    prices,
    instacart: instacartKey ? (title, lines) => instacartLink(title, lines, { apiKey: instacartKey, baseUrl: instacartBase }) : null,
    verify: async (token) => {
      const { data } = await verifyToken(token, { secretKey });
      return (data as { sub?: string } | undefined)?.sub ?? null;
    },
    users: {
      upsert: async (clerkId) => {
        const row = (await db.upsert<UserRow>(rid(clerkId)).merge({ clerk_id: clerkId })) as UserRow;
        return { clerk_id: row.clerk_id, eligible: row.eligible ?? null };
      },
      setEligible: async (clerkId, eligible) => {
        await db.upsert(rid(clerkId)).merge({ clerk_id: clerkId, eligible });
      },
    },
  };
}

// Reel links: Pal watches the video when Apify and Gemini keys are set; otherwise Claude reads the caption.
// Screenshots always go to Claude.
function pickExtractor(): Extractor {
  const claude = process.env.ANTHROPIC_API_KEY ? claudeExtractor() : null;
  const apify = process.env.APIFY_TOKEN, gemini = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return async (input) => {
    if (input.kind === "reel" && apify && gemini) return watchReel(input.url, { apifyToken: apify, geminiKey: gemini, model });
    if (input.kind === "reel" && !input.caption) throw new PodError("Pal can't watch videos yet (the server needs Apify and Gemini keys). Paste the reel's caption too.");
    if (!claude) throw new PodError("The server has no Claude key yet, so it can't read recipes. Use a sample dish.");
    return claude(input);
  };
}
