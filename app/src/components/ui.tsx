import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { brand, radius, space, type, useTheme } from "../lib/theme";

import { fx } from "../lib/fx";

export function Screen({ children, scroll = true, padTop = true }: { children: ReactNode; scroll?: boolean; padTop?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: padTop ? insets.top + space.md : space.md, paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: t.bg }, pad]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={[pad, { gap: space.lg }]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[type.title, { color: t.text }]}>{children}</Text>
      {sub ? <Text style={[type.body, { color: t.sub }]}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.card, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
        !t.dark && { shadowColor: "#1B1440", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Apple Health-style number card: coloured label, big number, small unit. The result only; the maths lives behind Details.
export function NumberCard({ label, value, unit, color, style }: { label: string; value: string; unit?: string; color: string; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: 140, gap: 2, ...style }}>
      <Text style={[type.label, { color }]}>{label}</Text>
      <Text style={{ color: t.text }}>
        <Text style={type.bigNumber}>{value}</Text>
        {unit ? <Text style={[type.h2, { color: t.sub }]}> {unit}</Text> : null}
      </Text>
    </Card>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Every button springs when pressed.
// Every press also feels like a tap in the streak (light knock, firmer double, heavy triple). Buttons that make
// their own sound (Done, Skip) pass feel="own" so the sounds don't stack.
export function Button({
  title, onPress, kind = "primary", loading, disabled, style, icon, feel = "tap",
}: { title: string; onPress: () => void; kind?: "primary" | "secondary" | "ghost" | "success"; loading?: boolean; disabled?: boolean; style?: ViewStyle; icon?: ReactNode; feel?: "tap" | "own" }) {
  const t = useTheme();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const off = disabled || loading;
  const fg = kind === "primary" || kind === "success" ? "#FFFFFF" : kind === "secondary" ? t.text : t.tint;
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={{ color: fg, fontSize: 17, fontWeight: "600" }}>{title}</Text>
    </View>
  );
  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={off}
      onPressIn={() => (s.value = withSpring(0.95, { damping: 15, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 8, stiffness: 300 }))}
      onPress={() => { if (feel === "tap") fx.tap(); onPress(); }}
      style={[anim, { opacity: off ? 0.55 : 1, borderRadius: radius.md, overflow: "hidden" }, style]}
    >
      {kind === "primary" ? (
        <LinearGradient colors={[brand.blue, brand.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.btn, { backgroundColor: kind === "success" ? t.ok : kind === "secondary" ? t.cardAlt : "transparent" }]}>{inner}</View>
      )}
    </AnimatedPressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.cardAlt, borderRadius: radius.sm, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { fx.tap(); onChange(o.value); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: on ? t.card : "transparent", alignItems: "center" }}
          >
            <Text style={{ color: on ? t.text : t.sub, fontWeight: on ? "700" : "500", fontSize: 15 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Bar that fills with a spring (XP).
export function Bar({ value, max, color = brand.violet }: { value: number; max: number; color?: string }) {
  const t = useTheme();
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withSpring(Math.min(1, max ? value / max : 0), { damping: 15, stiffness: 90 });
  }, [value, max]);
  const anim = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height: 12, borderRadius: 6, backgroundColor: t.cardAlt, overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", borderRadius: 6, backgroundColor: color }, anim]} />
    </View>
  );
}

export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(1, { duration: 250 + delay });
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (1 - o.value) * 12 }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 16, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
});

// Pal talking: a bubble with a little tail pointing down at Pal. Pops in so it feels like Pal piping up.
export function SpeechBubble({ children }: { children: ReactNode }) {
  const t = useTheme();
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(1, { damping: 9, stiffness: 180 });
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.8 + 0.2 * pop.value }, { translateY: (1 - pop.value) * 8 }] }));
  return (
    <Animated.View style={[{ alignItems: "center" }, anim]}>
      <View style={{ backgroundColor: t.card, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 12, borderWidth: 1, borderColor: t.line, maxWidth: 300 }}>
        <Text style={[type.body, { color: t.text, textAlign: "center", fontWeight: "600" }]}>{children}</Text>
      </View>
      <View style={{ width: 16, height: 16, backgroundColor: t.card, borderRightWidth: 1, borderBottomWidth: 1, borderColor: t.line, transform: [{ rotate: "45deg" }], marginTop: -9 }} />
    </Animated.View>
  );
}

// Placeholder: will open the maths behind a number plus one line from Pal. Not wired up yet (step 1 of the build).
export function DetailsButton() {
  const t = useTheme();
  return (
    <Pressable onPress={() => fx.tap()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Details" style={{ alignSelf: "flex-start" }}>
      <Text style={{ color: t.tint, fontWeight: "700", fontSize: 14 }}>Details ›</Text>
    </Pressable>
  );
}
