import Constants from "expo-constants";
import type { Goal, GoalFit, Recipe } from "./types";

// Default: the computer running `expo start`, port 3000. Override with EXPO_PUBLIC_API_URL.
function baseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
  return `http://${host}:3000`;
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(baseUrl() + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const why = (e as Error).name === "AbortError" ? "timed out" : "is not reachable";
    throw new Error(`The server at ${baseUrl()} ${why}. Is \`npm run dev\` running in pal-server?`);
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => null);
  // Show the server's own message, never a blank screen.
  if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`);
  return json as T;
}

export const ingest = (url: string) => post<Recipe>("/v1/ingest", { url }, 180_000);
export const goalFit = (recipe: Recipe, goal: Goal) => post<GoalFit>("/v1/goal-fit", { recipe, goal }, 120_000);
