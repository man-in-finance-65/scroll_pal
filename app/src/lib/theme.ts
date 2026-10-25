// One look for the whole app: "ScrollPal Dark" from the Stitch design system (DESIGN.md).
// Dark only, on every phone, so every screen matches the designs.
export const brand = {
  blue: "#6366F1",
  violet: "#A78BFA",
  violetDeep: "#8B5CF6",
  pink: "#EC4899",
  mint: "#34D399",
  orange: "#FB923C",
  navy: "#0F172A",
  sky: "#38BDF8",
  reward: "#F59E0B",
};

const dark = {
  bg: "#090A0F",
  card: "#181B2A",
  cardAlt: "#1E2235",
  text: "#F8FAFC",
  sub: "#94A3B8",
  faint: "#64748B",
  line: "#272C42",
  tint: brand.violet,
  onTint: "#090A0F", // text on a violet button
  ok: brand.mint,
  danger: "#F43F5E",
  ringTrack: "rgba(52,211,153,0.22)",
  glow: "rgba(167,139,250,0.18)", // the violet spotlight behind Pal
};

export type Theme = typeof dark & { dark: boolean };

export function useTheme(): Theme {
  return { ...dark, dark: true };
}

export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 48 };
// Two shapes only: "md" for every card, input and button, "pill" for chips, bubbles and badges.
export const radius = { md: 18, pill: 999 };

export const type = {
  hero: { fontSize: 30, lineHeight: 36, fontWeight: "800" as const },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700" as const },
  h2: { fontSize: 19, lineHeight: 25, fontWeight: "700" as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: "400" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 0.5, textTransform: "uppercase" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  bigNumber: { fontSize: 32, lineHeight: 36, fontWeight: "700" as const, fontVariant: ["tabular-nums" as const] },
};
