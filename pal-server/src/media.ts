import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { HttpError } from "./errors.js";
import type { Platform } from "./urls.js";

const run = promisify(execFile);
export const MAX_DURATION_SEC = 180;

export type Media = {
  caption: string;
  /** null when the audio could not be downloaded and only the caption is available. */
  audioPath: string | null;
  creator: { handle: string; avatar_url: string };
  /** Why there is no audio, shown to the user so a caption-only recipe is never passed off as a full one. */
  audioError: string | null;
  cleanup: () => Promise<void>;
};

/** Throws a 422 when the video is over the limit. Unknown duration passes: we cannot reject what we cannot measure. */
export function checkDuration(sec: unknown) {
  if (typeof sec === "number" && sec > MAX_DURATION_SEC) {
    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    throw new HttpError(422, `Video is ${mmss(sec)} long. Pal only takes videos up to ${mmss(MAX_DURATION_SEC)}.`);
  }
}

const handleOf = (raw: string) => (raw.startsWith("@") ? raw : `@${raw}`);

/**
 * Caption + audio. TikTok: its public embed page (works from cloud servers, where yt-dlp is often refused).
 * Everything else, and TikTok if that fails: yt-dlp (needs yt-dlp and ffmpeg on PATH). Metadata is read first
 * so a long video is rejected before anything is downloaded. If yt-dlp is blocked (common for YouTube and
 * Instagram on cloud servers) we fall back to the platform's public oEmbed caption, and say so in `audioError`.
 */
export async function fetchMedia(url: string, platform: Platform): Promise<Media> {
  const dir = await mkdtemp(join(tmpdir(), "pal-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  try {
    if (platform === "tiktok") {
      const viaEmbed = await tiktokEmbed(url, dir);
      if (viaEmbed) return { ...viaEmbed, cleanup };
    }
    const cookieArgs: string[] = [];
    if (process.env.YTDLP_COOKIES) {
      await writeFile(join(dir, "cookies.txt"), process.env.YTDLP_COOKIES);
      cookieArgs.push("--cookies", join(dir, "cookies.txt"));
    }
    // web_embedded gets past YouTube's bot check for metadata more often than the default client.
    const ytArgs = platform === "youtube" && !cookieArgs.length ? ["--extractor-args", "youtube:player_client=default,web_embedded"] : [];
    let info: Record<string, any>;
    try {
      const { stdout } = await run("yt-dlp", ["-J", "--no-warnings", "--no-playlist", ...cookieArgs, ...ytArgs, url], {
        timeout: 60_000,
        maxBuffer: 50 * 1024 * 1024,
      });
      info = JSON.parse(stdout);
      // Instagram carousels come back as a playlist; the first video is the reel.
      if (info._type === "playlist" && info.entries?.[0]) info = { ...info.entries[0], description: info.description };
    } catch (e) {
      const why = ytdlpError(e);
      const o = await oembed(url, platform);
      if (!o) throw new Error(`yt-dlp could not read the video (${why}) and the platform gave no public caption`);
      return { ...o, audioPath: null, audioError: `audio unavailable: ${why}`, cleanup };
    }
    checkDuration(info.duration);
    const caption = String(info.description || info.title || "");
    const creator = {
      // Instagram's uploader_id is a number; its `channel` is the @name.
      handle: handleOf(String((platform === "instagram" && info.channel) || info.uploader_id || info.channel_id || info.uploader || info.channel || "unknown")),
      avatar_url: typeof info.uploader_avatar === "string" ? info.uploader_avatar : "",
    };
    await writeFile(join(dir, "info.json"), JSON.stringify(info));
    try {
      await run(
        "yt-dlp",
        ["--no-warnings", "--load-info-json", join(dir, "info.json"), ...cookieArgs, "-x", "--audio-format", "mp3", "--audio-quality", "5", "-o", join(dir, "audio.%(ext)s")],
        { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
      );
      const audio = (await readdir(dir)).find((f) => f.endsWith(".mp3"));
      if (!audio) throw new Error("yt-dlp finished but wrote no audio file");
      return { caption, creator, audioPath: join(dir, audio), audioError: null, cleanup };
    } catch (e) {
      return { caption, creator, audioPath: null, audioError: `audio unavailable: ${ytdlpError(e)}`, cleanup };
    }
  } catch (e) {
    await cleanup();
    throw e;
  }
}

/** The useful line of a yt-dlp failure (its last "ERROR:" line), not the whole stderr dump. */
function ytdlpError(e: unknown): string {
  const err = e as { stderr?: string; message?: string };
  const line = (err.stderr || err.message || String(e)).split("\n").reverse().find((l) => l.includes("ERROR"));
  return (line || err.message || "unknown error").replace(/^ERROR:\s*/, "").slice(0, 300);
}

/** Caption-only fallbacks that need no login. TikTok's oEmbed no longer carries the caption (its embed page, above, does). */
async function oembed(url: string, platform: Platform) {
  if (platform === "instagram") return instagramEmbedCaption(url);
  if (platform !== "youtube") return null;
  const res = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url));
  if (!res.ok) return null;
  const j = (await res.json()) as { title?: string; author_unique_id?: string; author_name?: string; author_url?: string };
  const fromUrl = j.author_url?.match(/@([^/?]+)/)?.[1];
  return {
    caption: j.title ?? "",
    creator: { handle: handleOf(j.author_unique_id || fromUrl || j.author_name || "unknown"), avatar_url: "" },
  };
}

/**
 * TikTok's embed page carries the caption, length, creator and a link to the video's sound. null if the page
 * changed shape (then yt-dlp gets a try). A song instead of the creator's own voice is not transcribed.
 */
async function tiktokEmbed(url: string, dir: string): Promise<Omit<Media, "cleanup"> | null> {
  const id = url.match(/\/video\/(\d+)/)?.[1];
  const res = await fetch(`https://www.tiktok.com/embed/v2/${id}`, { headers: { "user-agent": BROWSER_UA } });
  if (!res.ok) return null;
  const html = await res.text();
  const json = html.match(/<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) return null;
  const data = Object.values((JSON.parse(json) as any)?.source?.data ?? {})[0] as any;
  const v = data?.videoData;
  if (!v?.itemInfos) return null;
  checkDuration(v.itemInfos.video?.videoMeta?.duration);
  const creator = { handle: handleOf(String(v.authorInfos?.uniqueId || "unknown")), avatar_url: String(v.authorInfos?.covers?.[0] ?? "") };
  const caption = String(v.itemInfos.text ?? "");
  const soundUrl: string | undefined = v.musicInfos?.playUrl?.[0];
  if (!v.musicInfos?.original || !soundUrl) {
    return { caption, creator, audioPath: null, audioError: "audio unavailable: the video uses a song, not the creator's voice" };
  }
  const audio = await fetch(soundUrl, { headers: { "user-agent": BROWSER_UA } });
  if (!audio.ok) return { caption, creator, audioPath: null, audioError: `audio unavailable: TikTok sound returned ${audio.status}` };
  const audioPath = join(dir, "audio.mp3");
  await writeFile(audioPath, Buffer.from(await audio.arrayBuffer()));
  return { caption, creator, audioPath, audioError: null };
}

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

/** Instagram's public "embed with caption" page. Best effort: it is HTML, so a layout change makes this return null. */
async function instagramEmbedCaption(url: string) {
  // A bare user agent gets the classic embed with the caption in it; a full browser one gets a script-only page.
  const res = await fetch(`${url.replace(/\/?$/, "/")}embed/captioned/`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) return null;
  const block = (await res.text()).match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/)?.[1];
  if (!block) return null;
  const handle = block.match(/class="CaptionUsername"[^>]*>([^<]+)</)?.[1]?.trim() ?? "unknown";
  const caption = decodeEntities(
    block.replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, "").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, ""),
  ).trim();
  return { caption, creator: { handle: handleOf(handle), avatar_url: "" } };
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
