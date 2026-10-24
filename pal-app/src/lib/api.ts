import type { CartItem, CartResult, Goal, GoalFit, Recipe, Store } from "./types";

// Set at publish time by the GitHub workflow (pal-app.yml). The app password is not an API key: it only stops
// strangers from using the server. Real keys never leave the server.
const BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.EXPO_PUBLIC_APP_SECRET ?? "";

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<{ data: T; headers: Headers }> {
  if (!BASE) throw new Error("This copy of Pal has no server address (EXPO_PUBLIC_API_URL was empty when it was published).");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-secret": SECRET },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const why = (e as Error).name === "AbortError" ? `took longer than ${timeoutMs / 1000} s` : "could not be reached (are you online?)";
    throw new Error(`Pal's server ${why}.`);
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => null);
  // Show the server's own message, never a blank screen.
  if (!res.ok) throw new Error(json?.error ?? `Pal's server answered ${res.status} with no message.`);
  return { data: json as T, headers: res.headers };
}

export async function ingest(url: string): Promise<{ recipe: Recipe; note: string | null }> {
  const { data, headers } = await post<Recipe>("/v1/ingest", { url }, 180_000);
  return { recipe: data, note: headers.get("x-pal-note") };
}
export const goalFit = async (recipe: Recipe, goal: Goal) => (await post<GoalFit>("/v1/goal-fit", { recipe, goal }, 120_000)).data;
export const pantryScan = async (image: string) => (await post<{ staples: string[] }>("/v1/pantry-scan", { image }, 90_000)).data.staples;
export const cart = async (items: CartItem[], store: Store) =>
  (await post<CartResult>("/v1/cart", { store, items: items.map(({ name, quantity, unit }) => ({ name, quantity, unit })) }, 30_000)).data;
