import { router, usePathname } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { fx } from "../lib/fx";
import { brand, useTheme } from "../lib/theme";

// Always on screen (except in the chat itself): one tap to give Pal advice.
export function AdviceButton() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  if (path.startsWith("/feedback") || path.startsWith("/demo")) return null; // /demo is the recording take: nothing floating on top
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", right: 10, bottom: insets.bottom + 96 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Give Pal advice"
        onPress={() => { fx.tap(); router.push({ pathname: "/feedback", params: { m: "0" } }); }}
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99,
          backgroundColor: t.dark ? "#2A2A2E" : "#FFFFFF", transform: [{ scale: pressed ? 0.94 : 1 }],
          borderWidth: 1, borderColor: t.line,
          shadowColor: "#1B1440", shadowOpacity: t.dark ? 0 : 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
        })}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6a.6.6 0 0 1-1-.46V16.4A2.5 2.5 0 0 1 4 14V5.5Z" fill={brand.violet} />
        </Svg>
        <Text style={{ color: t.text, fontWeight: "700", fontSize: 14 }}>Advice</Text>
      </Pressable>
    </View>
  );
}
