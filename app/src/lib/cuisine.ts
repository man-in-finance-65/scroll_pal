const MAP: [RegExp, string][] = [
  [/korea/i, "🇰🇷"], [/japan|sushi|ramen/i, "🇯🇵"], [/chin|sichuan|canton/i, "🇨🇳"], [/thai/i, "🇹🇭"],
  [/viet/i, "🇻🇳"], [/india/i, "🇮🇳"], [/ital|pasta/i, "🇮🇹"], [/fren/i, "🇫🇷"], [/span/i, "🇪🇸"],
  [/greek|mediterr/i, "🇬🇷"], [/mexic|tex/i, "🇲🇽"], [/peru/i, "🇵🇪"], [/brazil/i, "🇧🇷"], [/chile/i, "🇨🇱"],
  [/argentin/i, "🇦🇷"], [/americ|bbq|burger/i, "🇺🇸"], [/middle|leban|turk|persian/i, "🧆"], [/moroc|africa|ethiop/i, "🌍"],
  [/carib|jamaic/i, "🌴"], [/brit|engl|irish/i, "🇬🇧"], [/german/i, "🇩🇪"],
];

export function stampEmoji(label: string, kind: "cuisine" | "creator"): string {
  if (kind === "creator") return "👩‍🍳";
  return MAP.find(([re]) => re.test(label))?.[1] ?? "🍽️";
}
