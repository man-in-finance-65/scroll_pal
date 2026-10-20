import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { realDeps } from "./deps.ts";

const port = Number(process.env.PORT) || 8080; // Cloud Run sets PORT
serve({ fetch: createApp(await realDeps()).fetch, port });
console.log(`Pal API listening on :${port}`);
