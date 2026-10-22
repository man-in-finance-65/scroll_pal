// How the app talks to pods. Live mode goes through our API (Claude + SurrealDB, signed in with Clerk).
// Demo mode runs the exact same pod logic on the phone, in memory, with sample dishes.
import prices from "../../../../data/prices.json";
import { createPod, joinPod, MemoryPodStore, PodError, SAMPLE_DISHES, seedDemoPod, setGoal, setReceipt, submitDish, viewPod, type Pod, type PodView } from "../../../../engine/pods.ts";
import type { Goal, PriceTable } from "../../../../engine/swap.ts";

export type DishInput =
  | { kind: "reel"; url: string; caption?: string }
  | { kind: "screenshot"; mediaType: "image/jpeg"; data: string }
  | { kind: "sample"; sample: keyof typeof SAMPLE_DISHES };

export interface PodClient {
  mode: "demo" | "live";
  list(): Promise<Pod[]>;
  create(name: string): Promise<Pod>;
  join(code: string): Promise<Pod>;
  demo(): Promise<Pod>;
  get(id: string): Promise<PodView>;
  setGoal(id: string, goal: Goal): Promise<PodView>;
  submitDish(id: string, input: DishInput): Promise<PodView>;
  setReceipt(id: string, total: number | null): Promise<PodView>;
  instacart(id: string): Promise<string>;
}

export function demoClient(): PodClient {
  const store = new MemoryPodStore();
  const me = { userId: "you", name: "You" };
  const p = prices as PriceTable;
  const view = (id: string) => viewPod(store, id, me.userId, p);
  return {
    mode: "demo",
    list: () => store.listForUser(me.userId),
    create: (name) => createPod(store, me, name),
    join: (code) => joinPod(store, me, code),
    demo: () => seedDemoPod(store, me),
    get: view,
    setGoal: async (id, goal) => (await setGoal(store, id, me.userId, goal), view(id)),
    submitDish: async (id, input) => {
      if (input.kind !== "sample") throw new PodError("This preview runs without the Pal server, so it can't watch reels yet. Pick a sample dish here; real reels work once the server keys are in.");
      await submitDish(store, id, me.userId, SAMPLE_DISHES[input.sample], { kind: "sample" });
      return view(id);
    },
    setReceipt: async (id, total) => (await setReceipt(store, id, me.userId, total), view(id)),
    instacart: async () => { throw new PodError("Add to Instacart works once the Pal server has an Instacart key. In this preview, use the list below."); },
  };
}

export function liveClient(baseUrl: string, getToken: () => Promise<string | null>, displayName: string): PodClient {
  const call = async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
    const token = await getToken();
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PodError(json.error ?? `Server error ${res.status}`);
    return json as T;
  };
  return {
    mode: "live",
    list: () => call("/v1/pods"),
    create: (name) => call("/v1/pods", "POST", { name, displayName }),
    join: (code) => call("/v1/pods/join", "POST", { code, displayName }),
    demo: () => call("/v1/pods/demo", "POST", { displayName }),
    get: (id) => call(`/v1/pods/${id}`),
    setGoal: (id, goal) => call(`/v1/pods/${id}/goal`, "PUT", { goal }),
    submitDish: (id, input) => call(`/v1/pods/${id}/dish`, "POST", input),
    setReceipt: (id, total) => call(`/v1/pods/${id}/receipt`, "PUT", { total }),
    instacart: async (id) => (await call<{ url: string }>(`/v1/pods/${id}/instacart`, "POST", {})).url,
  };
}
