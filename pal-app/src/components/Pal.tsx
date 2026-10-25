import { useEffect } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { colors } from "../lib/theme";

export type Mood = "idle" | "happy" | "cheer";

/**
 * Pal: an original character, a round violet sous-chef with a small chef hat.
 * Breathes while idle; every time `bump` changes, Pal hops (happy) or hops and wiggles (cheer).
 */
export function Pal({ size = 120, mood = "idle", bump = 0 }: { size?: number; mood?: Mood; bump?: number }) {
  const breathe = useSharedValue(1);
  const hop = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withSequence(withTiming(1.035, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1);
  }, [breathe]);

  useEffect(() => {
    if (!bump) return;
    hop.value = withSequence(withSpring(-size * 0.22, { damping: 6, stiffness: 260 }), withSpring(0, { damping: 9, stiffness: 180 }));
    if (mood === "cheer") {
      tilt.value = withSequence(withTiming(-12, { duration: 90 }), withTiming(12, { duration: 140 }), withTiming(-8, { duration: 120 }), withSpring(0));
    }
  }, [bump, hop, tilt, mood, size]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { rotate: `${tilt.value}deg` }, { scale: breathe.value }],
  }));

  const smile = mood === "idle" ? "M40 70 Q50 76 60 70" : "M37 67 Q50 83 63 67";
  return (
    <Animated.View style={[{ width: size, height: size }, style]} accessibilityLabel={`Pal is ${mood === "idle" ? "ready" : "happy"}`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* hat */}
        <Rect x="33" y="14" width="34" height="12" rx="3" fill="#FFFFFF" stroke={colors.border} strokeWidth="1.5" />
        <Circle cx="38" cy="12" r="8" fill="#FFFFFF" stroke={colors.border} strokeWidth="1.5" />
        <Circle cx="50" cy="8" r="9" fill="#FFFFFF" stroke={colors.border} strokeWidth="1.5" />
        <Circle cx="62" cy="12" r="8" fill="#FFFFFF" stroke={colors.border} strokeWidth="1.5" />
        {/* body */}
        <Ellipse cx="50" cy="60" rx="34" ry="32" fill={colors.violet} />
        <Ellipse cx="40" cy="46" rx="10" ry="6" fill="#FFFFFF" opacity="0.18" />
        {/* eyes */}
        <Circle cx="39" cy="56" r={mood === "idle" ? 4 : 4.5} fill="#FFFFFF" />
        <Circle cx="61" cy="56" r={mood === "idle" ? 4 : 4.5} fill="#FFFFFF" />
        <Circle cx="40" cy="57" r="2" fill={colors.text} />
        <Circle cx="62" cy="57" r="2" fill={colors.text} />
        {/* cheeks + mouth */}
        <Circle cx="30" cy="66" r="4" fill={colors.primary} opacity="0.35" />
        <Circle cx="70" cy="66" r="4" fill={colors.primary} opacity="0.35" />
        <Path d={smile} stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}
