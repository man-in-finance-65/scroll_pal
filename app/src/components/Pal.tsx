import { useEffect } from "react";
import { Image, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

// Pal is only ever one of these images, exactly as designed in Stitch. Never redraw or restyle them here.
// Motion (a bob, a pop when the mood changes) moves the whole image; it never changes how Pal looks.
const ART = {
  sick: require("../../assets/pal/sick.png"), // green and queasy: before you rescue Pal
  cheeky: require("../../assets/pal/cheeky.png"), // big eyes, wink: playful, curious, hungry
  cheer: require("../../assets/pal/cheer.png"), // arm in the air: a win
  chubby: require("../../assets/pal/chubby.png"), // smirk, a little wider: Pal before your first cooks
  fit: require("../../assets/pal/fit.png"), // smirk, slimmer: Pal after you've cooked a few
  worried: require("../../assets/pal/worried.png"), // brows up: something went wrong, or a missed cook
} as const;

export type PalMood = keyof typeof ART;

// The art is 600 × 639, so height follows width.
const RATIO = 639 / 600;

export function Pal({ mood, size = 200 }: { mood: PalMood; size?: number }) {
  const bob = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    pop.value = withSequence(withTiming(0.9, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 170 }));
  }, [mood]);

  useEffect(() => {
    // Sick Pal sways slowly; a cheering Pal bounces.
    const dur = mood === "sick" || mood === "worried" ? 2200 : mood === "cheer" ? 500 : 1500;
    bob.value = 0;
    bob.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [mood]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * bob.value }, { scale: pop.value }],
  }));

  return (
    <View style={{ width: size, height: size * RATIO, alignItems: "center", justifyContent: "center" }} accessibilityRole="image" accessibilityLabel={`Pal looks ${mood}`}>
      <Animated.View style={style}>
        <Image source={ART[mood]} style={{ width: size, height: size * RATIO }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}
