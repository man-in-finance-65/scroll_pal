import type { Goal, Recipe, Swap } from "./types";

// In a published app there is no fallback: if the server address is missing, say so plainly.
const BASE = (process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? "http://localhost:8080" : "")).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public code: string, message: string, public detail?: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, timeoutMs = 150_000): Promise<T> {
  if (!BASE) throw new ApiError("no_server", "I'm not connected to my server yet. Whoever set up this app needs to finish deploying it.");
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
    throw new ApiError("offline", "I can't reach my server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "server_error", data.message ?? "Something went wrong. Try again.", data.detail);
  return data as T;
}

export const api = {
  ingest: (url: string, caption?: string) => post<Recipe & { cached?: boolean }>("/v1/ingest", { url, caption }),
  // Pal tunes the recipe to your goal: ingredient swaps, each with the energy it saves per serving.
  swaps: (recipe: Recipe, goal: Goal, mealKcal: number | null) => post<{ swaps: Swap[]; planner: string }>("/v1/swaps", { recipe, goal, mealKcal }),
  // A photo of your shelves: which of the recipe's ingredients Pal can see.
  pantry: (imageBase64: string, mimeType: string, ingredients: string[]) =>
    post<{ have: string[] }>("/v1/pantry", { image: imageBase64, mimeType, ingredients }, 90_000),
  // One row per answer in the team sheet. Anonymous: a random device id, no name, no email.
  feedback: (body: { device: string; milestone: number; level: number; cooks: number; id: string; q: string; a: string }) =>
    post<void>("/v1/feedback", body, 15_000),
  // Fire-and-forget: counting taps must never block or break the app.
  event: (type: "share" | "plan" | "done" | "eat" | "skip", device: string, ref?: string) => {
    post("/v1/event", { type, device, ref: ref?.slice(0, 200) }, 8000).catch(() => {});
  },
};
