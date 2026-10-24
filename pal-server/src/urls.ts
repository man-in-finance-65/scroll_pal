export type Platform = "tiktok" | "instagram" | "youtube";

export const ALLOWED_PATTERNS = ["instagram.com/reel/*", "tiktok.com/@*/video/*", "youtube.com/shorts/*"];

const HOSTS: Record<Platform, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com"],
};

const PATHS: Record<Platform, RegExp> = {
  instagram: /^\/reel\/[\w-]+\/?$/,
  tiktok: /^\/@[^/]+\/video\/\d+\/?$/,
  youtube: /^\/shorts\/[\w-]+\/?$/,
};

export type ParsedUrl = { platform: Platform; url: string };

/** Returns the platform and a clean URL (no query string), or null if the URL is not supported. */
export function parseSupportedUrl(input: unknown): ParsedUrl | null {
  if (typeof input !== "string") return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  for (const platform of Object.keys(HOSTS) as Platform[]) {
    if (HOSTS[platform].includes(u.hostname.toLowerCase()) && PATHS[platform].test(u.pathname)) {
      return { platform, url: `https://${u.hostname.toLowerCase()}${u.pathname}` };
    }
  }
  return null;
}

export function unsupportedUrlMessage(received: unknown): string {
  const shown = typeof received === "string" ? received : JSON.stringify(received) ?? String(received);
  return `Unsupported URL. Allowed patterns: ${ALLOWED_PATTERNS.join(", ")}. Received: ${shown}`;
}
