import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Platform } from "./urls.js";

const run = promisify(execFile);

export type Media = {
  caption: string;
  audioPath: string;
  creator: { handle: string; avatar_url: string };
  cleanup: () => Promise<void>;
};

/** Shells out to yt-dlp: caption + audio track only (needs yt-dlp and ffmpeg on PATH). */
export async function fetchMedia(url: string, platform: Platform): Promise<Media> {
  const dir = await mkdtemp(join(tmpdir(), "pal-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  try {
    await run(
      "yt-dlp",
      ["--no-playlist", "--no-progress", "-x", "--audio-format", "mp3", "--audio-quality", "5", "--write-info-json", "-o", join(dir, "audio.%(ext)s"), url],
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
    );
    const files = await readdir(dir);
    const audio = files.find((f) => f.endsWith(".mp3"));
    const infoFile = files.find((f) => f.endsWith(".info.json"));
    if (!audio || !infoFile) throw new Error("yt-dlp finished but produced no audio/info file");
    const info = JSON.parse(await readFile(join(dir, infoFile), "utf8")) as Record<string, any>;
    const handleRaw: string = info.uploader_id || info.channel_id || info.uploader || info.channel || "unknown";
    const handle = handleRaw.startsWith("@") ? handleRaw : `@${handleRaw}`;
    return {
      caption: String(info.description || info.title || ""),
      audioPath: join(dir, audio),
      creator: { handle, avatar_url: pickAvatar(info, platform) },
      cleanup,
    };
  } catch (e) {
    await cleanup();
    throw e;
  }
}

// yt-dlp does not expose creator avatars; empty string when absent (the app shows an initial instead).
function pickAvatar(info: Record<string, any>, _platform: Platform): string {
  return typeof info.uploader_avatar === "string" ? info.uploader_avatar : "";
}
