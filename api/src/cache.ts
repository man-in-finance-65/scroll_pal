import { createHash } from "node:crypto";

// Turns every YouTube link shape (shorts/, youtu.be/, watch?v=) into one canonical form,
// so the same video is only paid for once.
export function youtubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (host !== "youtube.com") return null;
  const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
  if (m) return m[2];
  return u.searchParams.get("v");
}

export function normalizeUrl(raw: string): string {
  const id = youtubeId(raw);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return raw.trim();
  }
}

export const urlHash = (url: string) => createHash("sha256").update(normalizeUrl(url)).digest("hex");

// In-memory only: it resets when Cloud Run restarts the server. Fine for v1.
const store = new Map<string, unknown>();
export const cache = {
  get: <T>(key: string) => store.get(key) as T | undefined,
  set: (key: string, value: unknown) => {
    if (store.size > 500) store.delete(store.keys().next().value!);
    store.set(key, value);
  },
};
