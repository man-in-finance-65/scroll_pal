import { LinearGradient } from "expo-linear-gradient";
import { Alert, Platform, Text, View } from "react-native";
import { Button, Card, FadeIn, Screen, Title } from "../../components/ui";
import { stampEmoji } from "../../lib/cuisine";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";

const GRADIENTS: [string, string][] = [
  [brand.blue, brand.violet],
  [brand.mint, brand.sky],
  [brand.orange, brand.pink],
  [brand.violet, brand.pink],
];

export default function Passport() {
  const t = useTheme();
  const s = useStore();
  const slots = Math.max(9, Math.ceil((s.stamps.length + 1) / 3) * 3);
  const cuisines = s.stamps.filter((x) => x.kind === "cuisine").length;
  const creators = s.stamps.length - cuisines;

  function reset() {
    const msg = "This wipes your XP, plan, recipes and stamps on this phone.";
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(msg)) s.resetAll();
      return;
    }
    Alert.alert("Start over?", msg, [
      { text: "Cancel", style: "cancel" },
      { text: "Start over", style: "destructive", onPress: s.resetAll },
    ]);
  }

  return (
    <Screen>
      <Title sub="Every completed cook stamps a new cuisine. Cook the same cuisine again and the creator gets a stamp.">Taste passport</Title>
      <Text style={[type.caption, { color: t.sub }]}>
        {cuisines} {cuisines === 1 ? "cuisine" : "cuisines"} + {creators} {creators === 1 ? "creator" : "creators"} = {s.stamps.length} stamps from{" "}
        {s.progress.cooks} {s.progress.cooks === 1 ? "cook" : "cooks"}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.lg }}>
        {Array.from({ length: slots }, (_, i) => {
          const st = s.stamps[i];
          return (
            <View key={i} style={{ width: "31%", alignItems: "center", gap: 6 }}>
              {st ? (
                <FadeIn delay={i * 40}>
                  <LinearGradient
                    colors={GRADIENTS[i % GRADIENTS.length]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", transform: [{ rotate: `${(i % 3) * 6 - 6}deg` }] }}
                  >
                    <Text style={{ fontSize: 38 }}>{stampEmoji(st.label, st.kind)}</Text>
                  </LinearGradient>
                </FadeIn>
              ) : (
                <View style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderStyle: "dashed", borderColor: t.faint }} />
              )}
              <Text numberOfLines={1} style={[type.caption, { color: st ? t.text : t.faint, fontWeight: st ? "700" : "400" }]}>
                {st ? st.label : "—"}
              </Text>
              {st && (
                <Text style={{ color: t.sub, fontSize: 11 }}>
                  {new Date(st.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Card style={{ marginTop: space.xl }}>
        <Text style={[type.caption, { color: t.sub }]}>Everything stays on this phone. No account needed.</Text>
        <Button title="Start over" kind="ghost" onPress={reset} />
      </Card>
    </Screen>
  );
}
