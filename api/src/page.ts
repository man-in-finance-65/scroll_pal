// Reads a public web page (Instagram, TikTok, a recipe blog...) and pulls out what Pal can use:
// the caption/description, any recipe data the site publishes, a photo, and the readable text.
// Best effort only: some sites (Instagram especially) hide captions from servers. Then the caller asks the user to paste it.

export type PageInfo = { title: string; description: string; image: string | null; text: string; recipeJson: string };

const MAX_BYTES = 600_000;
const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

function meta(html: string, ...names: string[]): string {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=(["'])([\s\S]*?)\1/i)?.[2];
    if (content) return decode(content).trim();
  }
  return "";
}

// Recipe sites publish the whole recipe as structured data (schema.org). That is the best source when it exists.
function findRecipeJson(html: string): string {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const walk = (n: unknown): unknown => {
        if (Array.isArray(n)) return n.map(walk).find(Boolean);
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          const t = o["@type"];
          if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return o;
          return walk(o["@graph"]);
        }
        return undefined;
      };
      const found = walk(JSON.parse(b[1]));
      if (found) return JSON.stringify(found).slice(0, 8000);
    } catch {}
  }
  return "";
}

const readable = (html: string) =>
  decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();

async function get(url: string, ua: string, ms = 9000): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": ua, "accept-language": "en", accept: "text/html,application/json" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.subarray(0, MAX_BYTES).toString("utf8");
}

// Only public http(s) pages: never let a pasted link make the server call something inside its own network.
export function isSafePublicUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return null;
  if (/^(\d+\.){3}\d+$/.test(h) && /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h)) return null;
  if (h.startsWith("[")) return null;
  return u;
}

async function oembed(u: URL): Promise<{ title: string; image: string | null } | null> {
  const host = u.hostname.replace(/^www\./, "");
  const endpoint = host.endsWith("tiktok.com")
    ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(u.toString())}`
    : host.endsWith("vimeo.com")
      ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u.toString())}`
      : null;
  if (!endpoint) return null;
  try {
    const j = JSON.parse(await get(endpoint, "Mozilla/5.0"));
    return { title: String(j.title ?? ""), image: j.thumbnail_url ?? null };
  } catch { return null; }
}

export async function readPage(raw: string): Promise<PageInfo | null> {
  const u = isSafePublicUrl(raw);
  if (!u) return null;
  let html = "";
  // Social sites show their caption to link-preview bots, so introduce ourselves as one.
  for (const ua of ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"]) {
    try { html = await get(u.toString(), ua); if (html.length > 500) break; } catch {}
  }
  const oe = await oembed(u);
  if (!html && !oe) return null;
  const title = meta(html, "og:title", "twitter:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || oe?.title || "";
  const description = meta(html, "og:description", "twitter:description", "description");
  const image = meta(html, "og:image", "twitter:image") || oe?.image || null;
  const recipeJson = findRecipeJson(html);
  const social = /instagram\.com|tiktok\.com|facebook\.com|fb\.watch|twitter\.com|x\.com|pinterest\./i.test(u.hostname);
  // Social pages are mostly app shell, so only their caption matters. Blogs and recipe sites: include the body text.
  const text = social ? "" : readable(html).slice(0, 7000);
  return { title: decode(title), description, image: image && /^https?:/.test(image) ? image : null, text, recipeJson };
}

// Everything above, as one block of text for Gemini.
export function pageToCaption(p: PageInfo, extra?: string): string {
  return [
    p.title && `Title: ${p.title}`,
    p.description && `Description / caption: ${p.description}`,
    p.recipeJson && `Structured recipe data from the site: ${p.recipeJson}`,
    p.text && `Page text: ${p.text}`,
    extra,
  ].filter(Boolean).join("\n");
}
