import { readFile } from "node:fs/promises";

export type Segment = { start: number; text: string };

/** OpenAI Whisper API. Returns the transcript as timestamped segments. */
export async function transcribe(audioPath: string): Promise<Segment[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const form = new FormData();
  form.append("file", new Blob([await readFile(audioPath)], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { text?: string; segments?: { start: number; text: string }[] };
  if (body.segments?.length) return body.segments.map((s) => ({ start: s.start, text: s.text.trim() }));
  return body.text ? [{ start: 0, text: body.text }] : [];
}
