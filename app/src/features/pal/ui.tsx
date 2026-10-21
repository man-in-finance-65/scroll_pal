import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors } from "../../lib/theme";

export type Mood = "listening" | "thinking" | "excited" | "helping";

// Pal, drawn with plain shapes until the transparent mascot art arrives.
export function Pal({ mood = "listening", size = 96 }: { mood?: Mood; size?: number }) {
  const eye = size * 0.16;
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: size * 0.28, color: colors.violet, marginBottom: -size * 0.08, marginLeft: size * 0.5 }}>✦</Text>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.violet, alignItems: "center", justifyContent: "center", shadowColor: colors.pink, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }}>
        <View style={{ alignItems: "center", gap: size * 0.06 }}>
          <View style={{ flexDirection: "row", gap: size * 0.14 }}>
            {[0, 1].map((k) => (
              <View key={k} style={{ width: eye, height: eye * 1.3, borderRadius: eye, backgroundColor: colors.white, alignItems: "center", justifyContent: mood === "thinking" ? "flex-start" : "center", paddingTop: mood === "thinking" ? 2 : 0 }}>
                <View style={{ width: eye * 0.55, height: eye * 0.55, borderRadius: eye, backgroundColor: colors.navy }} />
              </View>
            ))}
          </View>
          {mood === "excited" && <View style={{ width: eye * 1.6, height: eye * 0.8, borderBottomLeftRadius: eye, borderBottomRightRadius: eye, backgroundColor: colors.white }} />}
        </View>
      </View>
      {mood === "thinking" && <Text style={{ color: colors.violet, fontSize: 22, marginTop: 6, letterSpacing: 4 }}>•••</Text>}
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <View style={s.column}>{children}</View>
    </ScrollView>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ gap: 6, marginBottom: 8 }}>
      <Text style={s.title}>{children}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Button({ label, onPress, variant = "primary", disabled }: { label: string; onPress: () => void; variant?: "primary" | "ghost"; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, variant === "ghost" && s.ghost, (pressed || disabled) && { opacity: disabled ? 0.4 : 0.85 }]}>
      <Text style={[s.buttonText, variant === "ghost" && { color: colors.violet }]}>{label}</Text>
    </Pressable>
  );
}

export function Chips<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; label?: (v: T) => string }) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipText, on && { color: colors.white }]}>{label ? label(o.value) : o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Meter({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const share = Math.min(value / target, 1);
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={s.meterLabel}>{label}</Text>
      <Text style={s.meterValue}>{Math.round(value)}<Text style={s.meterTarget}> / {target} {unit}</Text></Text>
      <View style={s.track}><View style={[s.fill, { width: `${share * 100}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 64, paddingBottom: 48, alignItems: "center" },
  column: { width: "100%", maxWidth: 520, gap: 16 },
  title: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 16, lineHeight: 22, color: colors.muted },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 8 },
  button: { backgroundColor: colors.violet, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 16, alignItems: "center" },
  ghost: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.violet },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: "#E2E1F5" },
  chipOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontSize: 15, fontWeight: "600", color: colors.text },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 18, gap: 10, shadowColor: colors.navy, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  meterLabel: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  meterValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  meterTarget: { fontSize: 14, fontWeight: "500", color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: "#ECEBFA", overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
