import type { Goal, PlanFromApi, Recipe } from "./types";

const BASE = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError("offline", "Pal can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "server_error", data.message ?? "Something went wrong. Try again.");
  return data as T;
}

export const api = {
  ingest: (url: string, caption?: string) => post<Recipe & { cached?: boolean }>("/v1/ingest", { url, caption }),
  plan: (recipe: Recipe, goal: Goal, days: number) => post<PlanFromApi>("/v1/plan", { recipe, goal, days }),
  // Fire-and-forget: counting taps must never block or break the app.
  event: (type: "share" | "plan" | "done" | "skip", device: string, ref?: string) => {
    post("/v1/event", { type, device, ref: ref?.slice(0, 200) }, 8000).catch(() => {});
  },
};
