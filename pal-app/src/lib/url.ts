// Same rules as the server (pal-server/src/urls.ts). The server stays the authority.
const HOSTS = {
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com"],
} as const;
const PATHS = {
  instagram: /^\/reel\/[\w-]+\/?$/,
  tiktok: /^\/@[^/]+\/video\/\d+\/?$/,
  youtube: /^\/shorts\/[\w-]+\/?$/,
};

export function parseSupportedUrl(input: string): { platform: keyof typeof HOSTS; url: string } | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  for (const p of Object.keys(HOSTS) as (keyof typeof HOSTS)[]) {
    if ((HOSTS[p] as readonly string[]).includes(u.hostname.toLowerCase()) && PATHS[p].test(u.pathname)) {
      return { platform: p, url: input.trim() };
    }
  }
  return null;
}

/** "@creator" when the URL carries it (TikTok), otherwise a plain description of the link. */
export function creatorLabel(parsed: { platform: string; url: string }): string {
  if (parsed.platform === "tiktok") {
    const m = parsed.url.match(/\/(@[^/]+)\/video\//);
    if (m) return m[1];
  }
  return parsed.platform === "instagram" ? "an Instagram Reel" : "a YouTube Short";
}
