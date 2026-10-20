// The phone only ever talks to our API. It sends the Clerk session token; the API holds every other key.
const BASE = process.env.EXPO_PUBLIC_API_URL;

export async function api<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error("EXPO_PUBLIC_API_URL is not set");
  if (!token) throw new Error("not signed in");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export type Me = { clerk_id: string; eligible: boolean | null };
