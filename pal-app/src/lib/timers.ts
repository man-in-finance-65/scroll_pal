/** "simmer for 6 minutes", "bake 20-25 min", "rest 30 seconds" -> seconds (upper bound of a range). */
export function stepDurations(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[2] ?? m[1]);
    const unit = m[3].toLowerCase();
    out.push(Math.round(n * (unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1)));
  }
  return [...new Set(out)].filter((x) => x > 0);
}
