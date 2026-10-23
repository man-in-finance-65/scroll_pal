import { useColorScheme } from "react-native";

// Palette from the brand board (section 10 "Color Direction").
export const brand = {
  blue: "#5B6CFF",
  violet: "#8B5CF6",
  pink: "#FF6FB5",
  mint: "#34D399",
  orange: "#FF8A5B",
  navy: "#141B2D",
  sky: "#5BC8FF",
};

const light = {
  bg: "#F5F4FA",
  card: "#FFFFFF",
  cardAlt: "#F0EEF8",
  text: "#0B0F1A",
  sub: "#6B7085",
  faint: "#A9ADBD",
  line: "#E6E4EF",
  tint: brand.violet,
  ok: "#22C55E",
  danger: "#F43F5E",
  ringTrack: "rgba(52,211,153,0.18)",
};

const dark: typeof light = {
  bg: "#000000",
  card: "#1C1C1E",
  cardAlt: "#2A2A2E",
  text: "#F5F5F7",
  sub: "#9A9AA3",
  faint: "#5E5E66",
  line: "#2E2E33",
  tint: "#A78BFA",
  ok: "#30D158",
  danger: "#FF453A",
  ringTrack: "rgba(52,211,153,0.22)",
};

export type Theme = typeof light & { dark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? { ...dark, dark: true } : { ...light, dark: false };
}

export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 12, md: 18, lg: 24, xl: 32 };

// Number cards use the system font with tabular digits, like Apple Health.
export const type = {
  hero: { fontSize: 34, fontWeight: "800" as const, letterSpacing: 0.3 },
  title: { fontSize: 28, fontWeight: "700" as const },
  h2: { fontSize: 20, fontWeight: "700" as const },
  body: { fontSize: 17, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "600" as const, letterSpacing: 0.4, textTransform: "uppercase" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  bigNumber: { fontSize: 40, fontWeight: "700" as const, fontVariant: ["tabular-nums" as const] },
};
