import type { Source } from "./types";

// Never round up: cut extra decimals off instead (2.97 -> 2.9, 640.6 -> 640).
export function num(n: number, decimals = 1): string {
  const f = 10 ** decimals;
  const v = Math.floor(n * f) / f;
  return String(Number.isInteger(v) ? v : v.toFixed(decimals).replace(/0+$/, ""));
}

// "~" in front of anything Pal estimated.
export const est = (s: Source) => (s === "estimated" ? "~" : "");

export function qtyText(qty: number | null, unit: string): string {
  if (qty === null) return unit || "to taste";
  return [num(qty, 2), unit].filter(Boolean).join(" ");
}

// House style: no hyphens or dashes in anything Pal shows. Recipe text comes from AI, so it is cleaned on the way in:
// "5–6 minutes" -> "5 to 6 minutes", "stir-fry" -> "stir fry", "salty — then" -> "salty, then".
export function plain(text: string): string {
  return text
    .replace(/(\d)\s*[\u2010-\u2015-]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[\u2013\u2014\u2015]\s*/g, ", ")
    .replace(/(\p{L})[\u2010\u2011-](\p{L})/gu, "$1 $2")
    .replace(/(^|\s)-\s*/g, "$1");
}
