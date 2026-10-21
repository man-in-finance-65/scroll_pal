// How the app talks to pods. Live mode goes through our API (Claude + SurrealDB, signed in with Clerk).
// Demo mode runs the exact same pod logic on the phone, in memory, with sample dishes.
import prices from "../../../../data/prices.json";
import { createPod, joinPod, MemoryPodStore, PodError, SAMPLE_DISHES, seedDemoPod, setGoal, submitDish, viewPod, vote, type Pod, type PodView } from "../../../../engine/pods.ts";
import type { Goal, PriceTable } from "../../../../engine/swap.ts";

export type DishInput =
  | { kind: "reel"; url: string; caption: string }
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
  vote(id: string, chefId: string): Promise<PodView>;
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
      if (input.kind !== "sample") throw new PodError("This demo runs without the server, so Pal can't read reels or screenshots yet. Pick a sample dish.");
      await submitDish(store, id, me.userId, SAMPLE_DISHES[input.sample], { kind: "sample" });
      return view(id);
    },
    vote: async (id, chefId) => (await vote(store, id, me.userId, chefId), view(id)),
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
    vote: (id, chefId) => call(`/v1/pods/${id}/vote`, "POST", { chefId }),
  };
}
