import { useEffect, useId } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import type { Body, PalState } from "../lib/mood";

const NAVY = "#141B2D";
// A soft drop with a little tail, like the mascot on the brand board.
const BODY = "M100 22 C152 22 184 60 182 106 C181 138 168 160 150 171 C156 181 166 186 176 186 C154 194 128 189 114 180 C109 181 104 182 100 182 C54 182 18 154 18 106 C18 58 50 22 100 22 Z";
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { state: PalState; size?: number; body?: Body; level?: number; energy?: number };

// Pal, drawn to match the brand board: a glossy blue → violet → pink blob with big shiny eyes.
export function Pal({ state, size = 200, body = { sx: 1, sy: 1, float: 0, glow: 0 }, level = 1, energy = 0.7 }: Props) {
  // Each Pal on screen needs its own gradient ids, or they clash and the body disappears.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `${name}${uid}`;
  const bob = useSharedValue(0);
  const pop = useSharedValue(1);
  const tilt = useSharedValue(0);
  const sx = useSharedValue(body.sx);
  const sy = useSharedValue(body.sy);
  const lift = useSharedValue(body.float);

  // Every state change: a springy squash-and-stretch.
  useEffect(() => {
    pop.value = withSequence(withTiming(state === "slow" ? 0.92 : 0.82, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 170 }));
    tilt.value =
      state === "excited"
        ? withSequence(withTiming(-8, { duration: 90 }), withSpring(0, { damping: 4, stiffness: 160 }))
        : withSpring(state === "thinking" ? 6 : state === "slow" ? -4 : 0, { damping: 12 });
  }, [state]);

  // Idle bob: livelier with more energy, bouncier when excited, heavy when slow.
  useEffect(() => {
    const dur = state === "excited" ? 380 : state === "slow" ? 2600 : 1500 - 400 * energy;
    bob.value = 0;
    bob.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [state, energy]);

  // Body follows the goal, eased in with a spring.
  useEffect(() => {
    sx.value = withSpring(body.sx, { damping: 10 });
    sy.value = withSpring(body.sy, { damping: 10 });
    lift.value = withSpring(body.float, { damping: 12 });
  }, [body.sx, body.sy, body.float]);

  const amp = state === "excited" ? 16 : state === "slow" ? 2 : 4 + 6 * energy;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -bob.value * amp - lift.value },
      { rotate: `${tilt.value}deg` },
      { scaleX: sx.value * (2 - pop.value) },
      { scaleY: sy.value * pop.value * (state === "slow" ? 0.95 : 1) },
    ],
  }));
  const shadow = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 - bob.value * 0.18 }],
    opacity: 0.22 - bob.value * 0.08 - lift.value * 0.006,
  }));

  return (
    <View style={{ width: size, height: size * 1.12, alignItems: "center" }} accessibilityRole="image" accessibilityLabel={`Pal is ${state}`}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id={id("pal")} x1="0.1" y1="0" x2="0.9" y2="1">
              <Stop offset="0" stopColor="#6FB4FF" />
              <Stop offset="0.45" stopColor="#7A6BFF" />
              <Stop offset="0.8" stopColor="#B26BFF" />
              <Stop offset="1" stopColor="#FF7EC8" />
            </LinearGradient>
            <RadialGradient id={id("shine")} cx="0.32" cy="0.25" r="0.45">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#A78BFA" stopOpacity={0.35 + 0.35 * body.glow} />
              <Stop offset="1" stopColor="#A78BFA" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id={id("screen")} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#5BC8FF" />
              <Stop offset="1" stopColor="#34D399" />
            </LinearGradient>
          </Defs>

          {level >= 3 && <Circle cx="100" cy="104" r="98" fill={`url(#${id("glow")})`} />}
          <Path d={BODY} fill={`url(#${id("pal")})`} />
          <Path d={BODY} fill={`url(#${id("shine")})`} />
          {state === "slow" && <Path d={BODY} fill="#7D8296" opacity={0.45} />}

          <Face state={state} />

          {state === "helping" && (
            <G>
              <Rect x="70" y="128" width="60" height="42" rx="9" fill={NAVY} transform="rotate(-8 100 149)" />
              <Rect x="75" y="133" width="50" height="32" rx="6" fill={`url(#${id("screen")})`} transform="rotate(-8 100 149)" />
              <Circle cx="68" cy="156" r="10" fill="#8F7BFF" />
              <Circle cx="132" cy="148" r="10" fill="#B07BFF" />
            </G>
          )}

          {/* Level badges: a sparkle star from Lv.2, a second one from Lv.4 */}
          {level >= 2 && <Sparkle x={100} y={10} s={13} color="#7C6CFF" />}
          {level >= 4 && <Sparkle x={150} y={26} s={8} color="#FF6FB5" />}
          {state === "excited" && (
            <G>
              <Sparkle x={24} y={40} s={9} color="#FFB020" />
              <Sparkle x={182} y={56} s={11} color="#FF6FB5" />
              <Sparkle x={178} y={160} s={7} color="#34D399" />
            </G>
          )}
          {state === "thinking" && <ThinkingBubble />}
          {state === "slow" && (
            <SvgText x="158" y="44" fontSize="22" fontWeight="700" fill="#7D8296">
              z
            </SvgText>
          )}
        </Svg>
      </Animated.View>
      <Animated.View
        style={[{ position: "absolute", bottom: 0, width: size * 0.5, height: size * 0.07, borderRadius: size, backgroundColor: "#5B4BCF" }, shadow]}
      />
    </View>
  );
}

function Eye({ x, y, look = [0, 0] }: { x: number; y: number; look?: [number, number] }) {
  return (
    <G>
      <Ellipse cx={x + look[0]} cy={y + look[1]} rx="13" ry="17" fill={NAVY} />
      <Circle cx={x + look[0] + 4.5} cy={y + look[1] - 6} r="5" fill="#FFFFFF" />
      <Circle cx={x + look[0] - 4} cy={y + look[1] + 7} r="2" fill="#FFFFFF" opacity={0.8} />
    </G>
  );
}

function Face({ state }: { state: PalState }) {
  const blush = (
    <G opacity={0.4}>
      <Ellipse cx="62" cy="118" rx="10" ry="6" fill="#FF6FB5" />
      <Ellipse cx="138" cy="118" rx="10" ry="6" fill="#FF6FB5" />
    </G>
  );
  switch (state) {
    case "excited":
      return (
        <G>
          <Path d="M64 98 Q78 78 92 98" stroke={NAVY} strokeWidth="7" strokeLinecap="round" fill="none" />
          <Path d="M108 98 Q122 78 136 98" stroke={NAVY} strokeWidth="7" strokeLinecap="round" fill="none" />
          <Path d="M84 116 Q100 140 116 116 Z" fill={NAVY} />
          <Path d="M92 126 Q100 134 108 126 Q100 122 92 126 Z" fill="#FF6FB5" />
          {blush}
        </G>
      );
    case "thinking":
      return (
        <G>
          <Eye x={78} y={92} look={[3, -5]} />
          <Eye x={122} y={92} look={[3, -5]} />
          <Path d="M92 126 Q102 122 110 127" stroke={NAVY} strokeWidth="4" strokeLinecap="round" fill="none" />
        </G>
      );
    case "helping":
      return (
        <G>
          <Eye x={78} y={94} look={[1, 5]} />
          <Eye x={122} y={94} look={[1, 5]} />
          <Path d="M90 120 Q100 128 110 120" stroke={NAVY} strokeWidth="4" strokeLinecap="round" fill="none" />
          {blush}
        </G>
      );
    case "slow":
      return (
        <G>
          <Path d="M64 98 Q78 106 92 98" stroke={NAVY} strokeWidth="6" strokeLinecap="round" fill="none" />
          <Path d="M108 98 Q122 106 136 98" stroke={NAVY} strokeWidth="6" strokeLinecap="round" fill="none" />
          <Path d="M92 126 L108 126" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
          <Path d="M150 70 Q156 80 150 86 Q144 80 150 70 Z" fill="#9FD8FF" />
        </G>
      );
    default:
      return (
        <G>
          <Eye x={78} y={92} />
          <Eye x={122} y={92} />
          <Path d="M90 120 Q100 129 110 120" stroke={NAVY} strokeWidth="4" strokeLinecap="round" fill="none" />
          {blush}
        </G>
      );
  }
}

function Sparkle({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  const d = `M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`;
  return <Path d={d} fill={color} />;
}

function ThinkingBubble() {
  return (
    <G>
      <Rect x="128" y="8" width="62" height="34" rx="17" fill="#FFFFFF" stroke="#D9D3FF" strokeWidth="2" />
      <Circle cx="140" cy="48" r="5" fill="#FFFFFF" stroke="#D9D3FF" strokeWidth="2" />
      <Dot cx={145} delay={0} />
      <Dot cx={159} delay={160} />
      <Dot cx={173} delay={320} />
    </G>
  );
}

function Dot({ cx, delay }: { cx: number; delay: number }) {
  const o = useSharedValue(0.25);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.25, { duration: 320 })), -1));
  }, []);
  const props = useAnimatedProps(() => ({ opacity: o.value }));
  return <AnimatedCircle cx={cx} cy="25" r="5" fill="#7A6BFF" animatedProps={props} />;
}
