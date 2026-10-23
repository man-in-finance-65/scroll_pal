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
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { Body, PalState } from "../lib/mood";

const NAVY = "#141B2D";
// A rounded, slightly squashed egg of a body. Solid and lit like a real object, no tail.
const BODY = "M100 16 C153 16 186 62 186 114 C186 160 150 187 100 187 C50 187 14 160 14 114 C14 62 47 16 100 16 Z";
const LID = "#7B7CF6"; // matches the body colour around the eyes, so eyelids look like part of the body
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { state: PalState; size?: number; body?: Body; level?: number; energy?: number };

// Pal: a friendly, grounded blob with real lighting (soft highlight, shaded underside, rim light), expressive brows
// and eyelids. Less mascot, more mate. The brand palette is kept: blue → violet, with a pink rim.
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

  const look = LOOK[state];
  const face = FACE[state];

  return (
    <View style={{ width: size, height: size * 1.12, alignItems: "center" }} accessibilityRole="image" accessibilityLabel={`Pal is ${state}`}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            {/* main colour, lit from the top left */}
            <RadialGradient id={id("base")} cx="0.36" cy="0.28" r="0.95" fx="0.34" fy="0.24">
              <Stop offset="0" stopColor="#B4CBFF" />
              <Stop offset="0.3" stopColor="#8A93FF" />
              <Stop offset="0.62" stopColor="#6B52E6" />
              <Stop offset="1" stopColor="#3A2A9E" />
            </RadialGradient>
            {/* darker underside */}
            <LinearGradient id={id("under")} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.5" stopColor="#1B0F5C" stopOpacity="0" />
              <Stop offset="1" stopColor="#1B0F5C" stopOpacity="0.5" />
            </LinearGradient>
            {/* pink rim light on the lower right, where the room light bounces */}
            <RadialGradient id={id("rim")} cx="0.34" cy="0.3" r="0.74">
              <Stop offset="0.8" stopColor="#FF8FD0" stopOpacity="0" />
              <Stop offset="1" stopColor="#FF8FD0" stopOpacity="0.5" />
            </RadialGradient>
            <RadialGradient id={id("spec")} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0.6" stopColor="#8B7CFF" stopOpacity={0.12 + 0.22 * body.glow} />
              <Stop offset="1" stopColor="#8B7CFF" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id={id("screen")} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#5BC8FF" />
              <Stop offset="1" stopColor="#34D399" />
            </LinearGradient>
            <RadialGradient id={id("eye")} cx="0.4" cy="0.35" r="0.8">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#DCE2F5" />
            </RadialGradient>
            <ClipPath id={id("eyeL")}><Ellipse cx="76" cy="97" rx="13.5" ry="15.5" /></ClipPath>
            <ClipPath id={id("eyeR")}><Ellipse cx="124" cy="97" rx="13.5" ry="15.5" /></ClipPath>
          </Defs>

          {level >= 3 && <Circle cx="100" cy="106" r="100" fill={`url(#${id("glow")})`} />}

          {/* body, built up in layers */}
          <Path d={BODY} fill={`url(#${id("base")})`} />
          <Path d={BODY} fill={`url(#${id("under")})`} />
          <Path d={BODY} fill={`url(#${id("rim")})`} />
          <Ellipse cx="66" cy="52" rx="34" ry="19" fill={`url(#${id("spec")})`} transform="rotate(-28 66 52)" />
          <Ellipse cx="58" cy="46" rx="10" ry="4.2" fill="#FFFFFF" opacity={0.8} transform="rotate(-28 58 46)" />
          {state === "slow" && <Path d={BODY} fill="#6E7390" opacity={0.4} />}

          {/* eyes */}
          {([["L", 76, face.lidL, face.browL], ["R", 124, face.lidR, face.browR]] as const).map(([side, x, lid, brow]) => (
            <G key={side}>
              <Ellipse cx={x} cy="97" rx="13.5" ry="15.5" fill={`url(#${id("eye")})`} />
              <Circle cx={x + look[0]} cy={97 + look[1]} r="7.2" fill={NAVY} />
              <Circle cx={x + look[0] + 2.4} cy={97 + look[1] - 2.6} r="2.3" fill="#FFFFFF" />
              {/* the lid slides down over the eye: relaxed, heavy, or wide open */}
              <G clipPath={`url(#${id("eye" + side)})`}>
                <Rect x={x - 16} y={80} width="32" height={lid} fill={LID} />
                {lid > 0 && <Rect x={x - 16} y={80 + lid - 1.3} width="32" height="2.4" fill="#2A2470" opacity={0.55} />}
              </G>
              <Path d={brow} stroke={NAVY} strokeWidth="5.5" strokeLinecap="round" fill="none" opacity={0.88} />
            </G>
          ))}

          {/* mouth */}
          {face.grin ? (
            <G>
              <Path d="M76 128 Q100 160 124 128 Q100 133 76 128 Z" fill="#26164F" />
              <Path d="M86 144 Q100 152 114 144 Q100 139 86 144 Z" fill="#E86AA8" opacity={0.9} />
            </G>
          ) : (
            <Path d={face.mouth} stroke="#26164F" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          )}

          {state === "helping" && (
            <G>
              <Rect x="70" y="150" width="60" height="32" rx="7" fill={NAVY} transform="rotate(-6 100 166)" />
              <Rect x="75" y="155" width="50" height="22" rx="4" fill={`url(#${id("screen")})`} transform="rotate(-6 100 166)" />
              <Circle cx="68" cy="168" r="10.5" fill={`url(#${id("base")})`} />
              <Circle cx="132" cy="163" r="10.5" fill={`url(#${id("base")})`} />
              <Ellipse cx="65" cy="164" rx="3.8" ry="2.4" fill="#FFFFFF" opacity={0.5} />
            </G>
          )}

          {state === "thinking" && (
            <G>
              <Dot cx={152} cy={36} r={4.5} delay={0} />
              <Dot cx={164} cy={26} r={3.6} delay={180} />
              <Dot cx={174} cy={15} r={2.8} delay={360} />
            </G>
          )}
        </Svg>
      </Animated.View>
      <Animated.View
        style={[{ position: "absolute", bottom: 0, width: size * 0.62, height: size * 0.08, borderRadius: size, backgroundColor: "#2A1F7A" }, shadow]}
      />
    </View>
  );
}

// Where the pupils look, per state.
const LOOK: Record<PalState, [number, number]> = {
  listening: [0, 1],
  thinking: [5, -5],
  excited: [0, 0],
  helping: [0, 5],
  slow: [0, 3],
};

// Eyelid drop (px of lid over the eye), brow paths and mouth, per state. This is where the personality lives.
const FACE: Record<PalState, { lidL: number; lidR: number; browL: string; browR: string; mouth: string; grin?: boolean }> = {
  // relaxed, attentive, a tiny smirk
  listening: { lidL: 6, lidR: 6, browL: "M62 76 Q76 70 90 75", browR: "M110 75 Q124 70 138 76", mouth: "M84 133 Q99 142 118 130" },
  // one brow up, one down, flat mouth to the side
  thinking: { lidL: 10, lidR: 3, browL: "M62 80 Q76 76 90 71", browR: "M110 64 Q124 58 138 64", mouth: "M90 136 L113 132" },
  // wide awake, brows up, big grin
  excited: { lidL: 0, lidR: 0, browL: "M62 70 Q76 62 90 68", browR: "M110 68 Q124 62 138 70", mouth: "", grin: true },
  // kind, a little concerned for you, soft smile
  helping: { lidL: 5, lidR: 5, browL: "M62 79 Q76 74 90 71", browR: "M110 71 Q124 74 138 79", mouth: "M86 134 Q100 142 114 134" },
  // heavy lids, brows drooping, flat mouth
  slow: { lidL: 20, lidR: 20, browL: "M62 80 Q76 79 90 84", browR: "M110 84 Q124 79 138 80", mouth: "M88 138 Q100 134 112 138" },
};

function Dot({ cx, cy, r, delay }: { cx: number; cy: number; r: number; delay: number }) {
  const o = useSharedValue(0.2);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(0.9, { duration: 400 }), withTiming(0.2, { duration: 400 })), -1));
  }, []);
  const props = useAnimatedProps(() => ({ opacity: o.value }));
  return <AnimatedCircle cx={cx} cy={cy} r={r} fill="#8B93C7" animatedProps={props} />;
}
