import { router, useNavigation } from "expo-router";
import { useEffect, useId, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { fx } from "../lib/fx";
import { useStore } from "../lib/store";
import { brand, radius, space, type, useTheme } from "../lib/theme";
import { Pal, type PalMood } from "./Pal";

// The app's whole kit. One component per pattern, so every screen looks like the same app:
// Screen (a tab page), Stage (a step where Pal leads), Button, Field, Choice, Bubble, Card.

// Content never stretches wider than a big phone, so tablets get a centred column instead of huge buttons.
const MAX_W = 520;
const column: ViewStyle = { width: "100%", maxWidth: MAX_W, alignSelf: "center" };

// A tab page: scrolls, respects the notch.
export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[column, { paddingTop: insets.top + space.md, paddingHorizontal: space.md, paddingBottom: space.xxl, gap: space.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// A step where Pal leads: Pal and the line Pal says sit in the upper middle, the screen's content below,
// and the main button pinned to the bottom (thumb zone). Fills the screen on any size, inside the safe area.
export function Stage({
  mood, say, title, step, back = true, palSize, onPal, children, cta,
}: {
  mood: PalMood; say?: ReactNode; title?: string; step?: [number, number]; back?: boolean; palSize?: number; onPal?: () => void;
  children?: ReactNode; cta?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation(); // the hook, not the imperative router: safe while the first screen is still rendering
  // Short phones get a smaller Pal so the content and the button still fit.
  const { height } = useWindowDimensions();
  const pal = Math.round((palSize ?? 170) * (height < 700 ? 0.75 : 1));
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={[column, { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, gap: space.sm }]}>
        {back && nav.canGoBack() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} onPress={() => { fx.tap(); router.back(); }} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.text, fontSize: 26, lineHeight: 28 }}>‹</Text>
          </Pressable>
        ) : <View style={{ width: 40 }} />}
        <View style={{ flex: 1, alignItems: "center" }}>{step ? <Steps at={step[0]} of={step[1]} /> : null}</View>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[column, { flexGrow: 1, paddingHorizontal: space.md, paddingBottom: space.lg, gap: space.md }]} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", gap: space.sm, paddingTop: space.sm }}>
          <View style={{ position: "absolute", top: 0, width: pal * 1.5, height: pal * 1.5, borderRadius: pal * 0.75, backgroundColor: t.glow }} />
          <Pressable disabled={!onPal} onPress={onPal} accessibilityRole={onPal ? "button" : undefined} accessibilityLabel={onPal ? "Tap Pal" : undefined}>
            <Pal mood={mood} size={pal} />
          </Pressable>
          {say ? <Bubble>{say}</Bubble> : null}
          {title ? <Text style={[type.hero, { color: t.text, textAlign: "center" }]}>{title}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {cta ? <View style={[column, { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: insets.bottom + space.md, gap: space.sm }]}>{cta}</View> : null}
    </View>
  );
}

function Steps({ at, of }: { at: number; of: number }) {
  const t = useTheme();
  return (
    <View style={{ width: 120, height: 6, borderRadius: radius.pill, backgroundColor: t.cardAlt, overflow: "hidden" }} accessibilityLabel={`Step ${at} of ${of}`}>
      <View style={{ width: `${(at / of) * 100}%`, height: "100%", backgroundColor: t.tint, borderRadius: radius.pill }} />
    </View>
  );
}

// Pal talking. Sits under Pal, with a little tail pointing up at Pal. Pops in like Pal piping up.
export function Bubble({ children }: { children: ReactNode }) {
  const t = useTheme();
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = 0;
    pop.value = withSpring(1, { damping: 9, stiffness: 180 });
  }, [children]);
  const anim = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.85 + 0.15 * pop.value }] }));
  return (
    <Animated.View style={[{ alignItems: "center", maxWidth: 340 }, anim]}>
      <View style={{ width: 14, height: 14, backgroundColor: t.card, transform: [{ rotate: "45deg" }], marginBottom: -7 }} />
      <View style={{ backgroundColor: t.card, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12 }}>
        <Text style={[type.body, { color: t.text, textAlign: "center", fontWeight: "600" }]}>{children}</Text>
      </View>
    </Animated.View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: radius.md, padding: space.md, gap: space.sm }, style]}>{children}</View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Every button springs when pressed and gives a sound plus a vibration. The primary button gets the firmer one.
// Buttons that play their own sound (Done, level up) pass feel="own" so the sounds don't stack.
export function Button({
  title, onPress, kind = "primary", loading, disabled, style, icon, feel,
}: { title: string; onPress: () => void; kind?: "primary" | "secondary" | "ghost"; loading?: boolean; disabled?: boolean; style?: ViewStyle; icon?: string; feel?: "own" }) {
  const t = useTheme();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const off = disabled || loading;
  const fg = kind === "primary" ? t.onTint : kind === "secondary" ? t.text : t.tint;
  const bg = kind === "primary" ? t.tint : kind === "secondary" ? t.cardAlt : "transparent";
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPressIn={() => (s.value = withSpring(0.96, { damping: 15, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 8, stiffness: 300 }))}
      onPress={() => {
        if (feel !== "own") (kind === "primary" ? fx.primary : fx.tap)();
        onPress();
      }}
      style={[anim, { opacity: off ? 0.4 : 1, height: 56, borderRadius: radius.md, backgroundColor: bg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: space.md }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Text style={{ fontSize: 18 }}>{icon}</Text> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: "700" }}>{title}</Text>
    </AnimatedPressable>
  );
}

// Text input. Optional small action on the right (e.g. Paste).
export function Field({ action, onAction, style, ...props }: TextInputProps & { action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", height: 56, backgroundColor: t.cardAlt, borderRadius: radius.md, paddingLeft: space.md, paddingRight: action ? 6 : space.md }, style as ViewStyle]}>
      {/* outlineStyle: browsers draw a square focus ring inside the rounded field; the field itself is the focus cue. */}
      <TextInput placeholderTextColor={t.faint} {...props} style={[{ flex: 1, color: t.text, fontSize: 16, height: "100%" }, Platform.OS === "web" && ({ outlineStyle: "none" } as object)]} />
      {action ? (
        <Pressable accessibilityRole="button" onPress={() => { fx.tap(); onAction?.(); }} style={{ height: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: t.glow, justifyContent: "center" }}>
          <Text style={{ color: t.tint, fontWeight: "700" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// One tappable option out of a few (goal, meal count). Selected = violet edge and a filled check.
export function Choice({ title, sub, icon, selected, onPress, style }: { title: string; sub?: string; icon?: string; selected: boolean; onPress: () => void; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => { fx.tap(); onPress(); }}
      style={[{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 64, borderRadius: radius.md, backgroundColor: selected ? t.cardAlt : t.card, borderWidth: 2, borderColor: selected ? t.tint : "transparent" }, style]}
    >
      {icon ? <Text style={{ fontSize: 24 }}>{icon}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.h2, { color: t.text }]}>{title}</Text>
        {sub ? <Text style={[type.caption, { color: t.sub }]}>{sub}</Text> : null}
      </View>
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: selected ? t.tint : t.cardAlt }}>
        {selected ? <Text style={{ color: t.onTint, fontWeight: "900" }}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

// Small coloured label: "Lv.2", "+50 XP".
export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: color + "26" }}>
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>{text}</Text>
    </View>
  );
}

// Apple Health style number: coloured label, big number, the maths underneath.
export function NumberCard({ label, value, unit, color, math, style }: { label: string; value: string; unit?: string; color: string; math?: string; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: 0, gap: 2, ...style }}>
      <Text style={[type.label, { color }]}>{label}</Text>
      <Text style={{ color: t.text }}>
        <Text style={type.bigNumber}>{value}</Text>
        {unit ? <Text style={[type.body, { color: t.sub }]}> {unit}</Text> : null}
      </Text>
      {math ? <Text style={[type.caption, { color: t.sub }]}>{math}</Text> : null}
    </Card>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// One activity ring, like Apple Fitness. Fills with a spring.
export function Ring({ value, target, size = 120, stroke = 14, children }: { value: number; target: number; size?: number; stroke?: number; children?: ReactNode }) {
  const t = useTheme();
  const gid = "ring" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(Math.min(1, target ? value / target : 0), { damping: 14, stiffness: 70 });
  }, [value, target]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <SvgGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={brand.mint} />
            <Stop offset="1" stopColor={brand.sky} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.ringTrack} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={props} />
      </Svg>
      {children}
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
    <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: t.cardAlt, overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", borderRadius: radius.pill, backgroundColor: color }, anim]} />
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

// A row in a list: label left, value right, thin line between rows.
export function Row({ left, right, sub, first, color }: { left: string; right?: string; sub?: string; first?: boolean; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderColor: t.line }}>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: color ?? t.text }]}>{left}</Text>
        {sub ? <Text style={[type.caption, { color: t.sub }]}>{sub}</Text> : null}
      </View>
      {right ? <Text style={[type.body, { color: t.sub, fontVariant: ["tabular-nums"] }]}>{right}</Text> : null}
    </View>
  );
}

// Shown if a meal step opens with no meal on the go (e.g. after a restart).
export function NoMeal() {
  if (!useStore().ready) return null; // still loading the saved meal
  return <Stage mood="cheeky" say="We're not cooking anything yet. Feed me a link first." cta={<Button title="Feed Pal" onPress={() => router.replace("/meal/feed")} />} />;
}
