import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Pal } from "../components/Pal";
import { Button, haptic, Screen } from "../components/ui";
import { useStore } from "../lib/store";
import { radius, space, type, useTheme } from "../lib/theme";
import { usePal } from "../lib/usePal";

const FORM_URL = process.env.EXPO_PUBLIC_FEEDBACK_FORM_URL;
const FACES = [
  { emoji: "😍", label: "Love it" },
  { emoji: "🙂", label: "It's OK" },
  { emoji: "😕", label: "Not yet" },
];

// Shown once, after the 3rd completed cook.
export default function Feedback() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const [pick, setPick] = useState<number | null>(null);

  function close() {
    s.markFeedbackShown();
    router.back();
  }

  function openForm() {
    s.markFeedbackShown();
    if (FORM_URL) Linking.openURL(FORM_URL).catch(() => {});
    router.back();
  }

  return (
    <Screen padTop={false}>
      <View style={{ alignItems: "center", gap: space.md, paddingTop: space.lg }}>
        <Pal state="helping" size={150} body={pal.body} level={pal.level} />
        <Text style={[type.title, { color: t.text, textAlign: "center" }]}>3 cooks done!</Text>
        <Text style={[type.body, { color: t.sub, textAlign: "center" }]}>Quick one: how is Pal doing so far?</Text>
      </View>

      <View style={{ flexDirection: "row", gap: space.md, justifyContent: "center" }}>
        {FACES.map((f, i) => (
          <Pressable
            key={f.label}
            onPress={() => { haptic.tap(); setPick(i); }}
            style={{
              alignItems: "center", gap: 4, paddingVertical: space.md, width: 96, borderRadius: radius.md,
              backgroundColor: pick === i ? t.tint + "26" : t.card, borderWidth: 2, borderColor: pick === i ? t.tint : "transparent",
            }}
          >
            <Text style={{ fontSize: 40 }}>{f.emoji}</Text>
            <Text style={[type.caption, { color: t.text }]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        {FORM_URL ? (
          <Button title="Tell us more (1-minute form)" onPress={openForm} disabled={pick === null} />
        ) : (
          <Button title="Thanks!" onPress={close} disabled={pick === null} />
        )}
        <Button title="Not now" kind="ghost" onPress={close} />
      </View>
    </Screen>
  );
}
