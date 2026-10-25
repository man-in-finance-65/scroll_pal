import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useStore } from "../lib/store";
import { brand, radius, space, type, useTheme } from "../lib/theme";
import { usePal } from "../lib/usePal";
import { Pal } from "./Pal";
import { Button } from "./ui";

const GROW: Record<string, string> = {
  bulk: "I'm building up!",
  cut: "I'm getting leaner and lighter!",
  maintain: "I'm glowing a little brighter!",
};

// Full-screen moment after a level-up.
export function Celebration() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const c = s.celebration;
  const scale = useSharedValue(0.6);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (!c) return;
    scale.value = 0.6;
    fade.value = withTiming(1, { duration: 180 });
    scale.value = withSpring(1, { damping: 9, stiffness: 160 });
  }, [c]);

  const card = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const bg = useAnimatedStyle(() => ({ opacity: fade.value }));
  if (!c) return null;

  const close = () => {
    fade.value = 0;
    s.clearCelebration();
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,8,30,0.55)", justifyContent: "center", padding: space.lg }, bg]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <Animated.View style={[{ backgroundColor: t.card, borderRadius: radius.xl, padding: space.xl, alignItems: "center", gap: space.md }, card]}>
        <Pal state="excited" size={170} body={pal.body} level={c.level} energy={1} />
        <Text style={[type.label, { color: brand.violet }]}>Level up</Text>
        <Text style={{ color: t.text, fontSize: 56, fontWeight: "800" }}>Lv.{c.level}</Text>
        <Text style={[type.body, { color: t.text, textAlign: "center" }]}>{GROW[s.goal]}</Text>
        <Button title="Nice!" onPress={close} style={{ alignSelf: "stretch" }} />
      </Animated.View>
    </Animated.View>
  );
}
