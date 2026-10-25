import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts } from "../lib/theme";

export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.card, style]}>{children}</View>;
export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const Sub = ({ children, style }: { children: ReactNode; style?: object }) => <Text style={[s.sub, style]}>{children}</Text>;
export const Note = ({ children }: { children: ReactNode }) => <Text style={s.note}>{children}</Text>;

export function Button({ title, onPress, kind = "primary", disabled, busy }: {
  title: string; onPress: () => void; kind?: "primary" | "ghost" | "violet"; disabled?: boolean; busy?: boolean;
}) {
  const bg = kind === "primary" ? colors.primary : kind === "violet" ? colors.violet : colors.card;
  const fg = kind === "ghost" ? colors.primary : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, kind === "ghost" && s.ghost]}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.pill, on && s.pillOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.pillText, on && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

/** Every tab shows this instead of a blank screen when it has nothing yet. */
export function Empty({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 28 }}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
      <H2>{title}</H2>
      <Sub style={{ textAlign: "center" }}>{body}</Sub>
      {action}
    </Card>
  );
}

/** Server and app errors are shown word for word, with a retry when one makes sense. */
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.error}>
      <Text style={s.errorText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={s.link}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.primary} />
      <Sub style={{ flex: 1 }}>{text}</Sub>
    </View>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  h1: { fontFamily: fonts.heading, fontSize: 26, color: colors.text },
  h2: { fontFamily: fonts.headingMid, fontSize: 17, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.sub },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.sub },
  num: { fontFamily: fonts.heading, color: colors.text },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", minHeight: 48 },
  ghost: { borderColor: colors.primary, borderWidth: 1.5 },
  btnText: { fontFamily: fonts.headingMid, fontSize: 15 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  error: { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, gap: 8 },
  errorText: { fontFamily: fonts.body, fontSize: 14, color: colors.red },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
  loading: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  screen: { padding: 16, gap: 12, paddingBottom: 48 },
});
