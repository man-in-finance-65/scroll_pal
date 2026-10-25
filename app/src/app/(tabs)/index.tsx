import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Pal } from "../../components/Pal";
import { Bar, Button, Card, DetailsButton, Screen, SpeechBubble } from "../../components/ui";
import { fx } from "../../lib/fx";
import type { PalState } from "../../lib/mood";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import { usePal } from "../../lib/usePal";

export default function PalHome() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const [poke, setPoke] = useState(false);
  useEffect(() => {
    if (!poke) return;
    const id = setTimeout(() => setPoke(false), 1600);
    return () => clearTimeout(id);
  }, [poke]);

  const state: PalState = poke ? "excited" : pal.slow ? "slow" : s.celebration ? "excited" : "listening";
  const p = s.progress;

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: space.sm, paddingTop: space.lg }}>
        <SpeechBubble>{pal.mood.line}</SpeechBubble>
        <Pressable onPress={() => { fx.tap(); setPoke(true); }} accessibilityLabel="Poke Pal">
          <Pal state={state} size={230} body={pal.body} level={p.level} energy={pal.mood.energy} />
        </Pressable>
      </View>

      <Button title="Here's a recipe, Pal" onPress={() => router.navigate("/add")} />
      {s.plan && <Button title="Our plan" kind="secondary" onPress={() => router.navigate("/plan")} />}

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={[type.label, { color: brand.violet }]}>Lv.{p.level}</Text>
          <Text style={[type.caption, { color: t.sub }]}>{p.xpToNext} XP to Lv.{p.level + 1}</Text>
        </View>
        <Bar value={p.xpIntoLevel} max={p.xpIntoLevel + p.xpToNext} />
        <DetailsButton />
      </Card>
    </Screen>
  );
}
