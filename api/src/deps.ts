// Real Clerk and SurrealDB wiring. Kept apart from app.ts so tests can swap in fakes.
import { verifyToken } from "@clerk/backend";
import { RecordId, Surreal } from "surrealdb";
import type { Deps, UserRow } from "./app.ts";

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
  return {
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
