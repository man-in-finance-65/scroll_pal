import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { stampEmoji } from "../lib/cuisine";
import { fx } from "../lib/fx";
import { useStore } from "../lib/store";
import { brand, radius, space, type, useTheme } from "../lib/theme";
import { COOK_XP } from "../lib/xp";
import { Pal } from "./Pal";
import { Button } from "./ui";

const GROW: Record<string, string> = {
  bulk: "I'm getting stronger!",
  cut: "I'm getting lighter!",
  maintain: "I'm glowing brighter!",
};

// Full-screen moment after a level-up or a new passport stamp. Also hands off to the
// feedback screen after the 3rd cook, once the celebration is closed.
export function Celebration() {
  const t = useTheme();
  const s = useStore();
  const c = s.celebration;
  const scale = useSharedValue(0.6);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (!c) return;
    scale.value = 0.6;
    fade.value = withTiming(1, { duration: 180 });
    scale.value = withSpring(1, { damping: 9, stiffness: 160 });
    // A new stamp lands just after the "nice" of the Done tap. A level-up already played its fanfare.
    if (c.kind === "stamp") {
      const id = setTimeout(fx.stamp, 450);
      return () => clearTimeout(id);
    }
  }, [c]);

  // Pal's question waits until you're back on Home, so it never interrupts a meal (cook, then eat).
  const path = usePathname();
  const opened = useRef(0);
  useEffect(() => {
    const midMeal = s.meal && s.meal.stage !== "done";
    if (c || midMeal || path !== "/" || !s.feedbackPending || opened.current === s.feedbackPending) return;
    opened.current = s.feedbackPending;
    const m = s.feedbackPending;
    const id = setTimeout(() => router.push({ pathname: "/feedback", params: { m: String(m) } }), 600);
    return () => clearTimeout(id);
  }, [c, path, s.meal?.stage, s.feedbackPending]);

  const card = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const bg = useAnimatedStyle(() => ({ opacity: fade.value }));
  if (!c) return null;

  const close = () => {
    fade.value = 0;
    s.clearCelebration();
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(9,10,15,0.8)", justifyContent: "center", padding: space.lg }, bg]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <Animated.View style={[{ backgroundColor: t.card, borderRadius: radius.md, padding: space.xl, alignItems: "center", gap: space.md }, card]}>
        {c.kind === "level" ? (
          <>
            <Pal mood="cheer" size={170} />
            <Text style={[type.label, { color: brand.violet }]}>I leveled up!</Text>
            <Text style={{ color: t.text, fontSize: 56, fontWeight: "800" }}>Lv.{c.level}</Text>
            <Text style={[type.body, { color: t.sub, textAlign: "center" }]}>{c.math}</Text>
            <Text style={[type.body, { color: t.text, textAlign: "center" }]}>{GROW[s.goal]}</Text>
          </>
        ) : (
          <>
            <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: brand.pink + "26", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 56 }}>{stampEmoji(c.stamp.label, c.stamp.kind)}</Text>
            </View>
            <Text style={[type.label, { color: brand.pink }]}>New stamp for us!</Text>
            <Text style={[type.title, { color: t.text, textAlign: "center" }]}>{c.stamp.label}</Text>
            <Text style={[type.body, { color: t.sub }]}>+{COOK_XP} XP for the cook</Text>
          </>
        )}
        <Button title="Keep going" onPress={close} style={{ alignSelf: "stretch" }} />
      </Animated.View>
    </Animated.View>
  );
}
