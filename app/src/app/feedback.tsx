import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Pal } from "../components/Pal";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { fx } from "../lib/fx";
import { useStore } from "../lib/store";
import { radius, space, type, useTheme } from "../lib/theme";
import { usePal } from "../lib/usePal";

// Pal asks for advice the way you'd ask a friend. No form, no "rate us": one question at a time,
// tap an answer or say it in your own words. Each answer is saved on its own, so nothing is lost if you close it.
type Step = { id: string; ask: string; chips: string[]; text?: boolean; hint?: string };

const FLOWS: Record<number, Step[]> = {
  // After the 1st cook: one quick question.
  1: [
    {
      id: "would_share",
      ask: "First cook done, pal! 🎉 Be honest: would you tell a friend who's stuck on dinner about me?",
      chips: ["Yes, totally", "Maybe", "Not yet"],
    },
    {
      id: "make_it_yes",
      ask: "Thanks for being straight with me. What would make it a big yes?",
      chips: ["Faster", "More recipes", "Prettier", "Fix something"],
      text: true,
      hint: "Or tell me like you'd tell a friend…",
    },
  ],
  // After the 3rd cook: a proper catch-up.
  3: [
    {
      id: "favourite",
      ask: "3 cooks in! 🔥 What's your favourite part of hanging out with me?",
      chips: ["Videos → recipes", "Pal's reactions", "The plan", "Levelling up"],
    },
    {
      id: "one_change",
      ask: "If you were me, what's the ONE thing you'd change?",
      chips: ["Make it faster", "More recipes", "Make it prettier", "Something's broken", "Nothing, keep going!"],
      text: true,
      hint: "Or say it in your own words…",
    },
  ],
  // Any time: from the Pal tab.
  0: [
    {
      id: "open",
      ask: "What's on your mind, pal? Tell me like you'd tell a friend.",
      chips: ["I love something", "Something confused me", "I found a bug", "I have an idea"],
      text: true,
      hint: "Type anything…",
    },
  ],
};

type Msg = { from: "pal" | "me"; text: string; key: string };

export default function Feedback() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const { m } = useLocalSearchParams<{ m?: string }>();
  const milestone = [1, 3].includes(Number(m)) ? Number(m) : 0;
  const steps = FLOWS[milestone];

  const [i, setI] = useState(0);
  const [log, setLog] = useState<Msg[]>([{ from: "pal", text: steps[0].ask, key: "q0" }]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [failed, setFailed] = useState<{ step: Step; answer: string } | null>(null);
  const done = i >= steps.length;
  const scroller = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (milestone) s.markFeedbackAsked(milestone); // asked once; never nags
  }, []);
  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(id);
  }, [log, typing, failed]);

  async function answer(step: Step, a: string) {
    const text = a.trim();
    if (!text) return;
    fx.tap();
    setDraft("");
    setFailed(null);
    setLog((l) => (l.some((x) => x.key === "a" + step.id) ? l : [...l, { from: "me", text, key: "a" + step.id }]));
    setTyping(true);
    try {
      await api.feedback({ device: s.deviceId, milestone, level: s.progress.level, cooks: s.progress.cooks, id: step.id, q: step.ask, a: text });
    } catch {
      setTyping(false);
      setFailed({ step, answer: text });
      return;
    }
    const next = i + 1;
    setTimeout(() => {
      setTyping(false);
      setI(next);
      fx.ready();
      setLog((l) => [
        ...l,
        next < steps.length
          ? { from: "pal", text: steps[next].ask, key: "q" + next }
          : { from: "pal", text: "Thank you, pal. That really helps me get better. 💜", key: "bye" },
      ]);
    }, 600);
  }

  const step = steps[i];
  const bubble = (mine: boolean) => ({
    alignSelf: mine ? ("flex-end" as const) : ("flex-start" as const),
    maxWidth: "85%" as const,
    backgroundColor: mine ? t.tint : t.card,
    borderRadius: radius.lg,
    borderBottomRightRadius: mine ? 6 : radius.lg,
    borderBottomLeftRadius: mine ? radius.lg : 6,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center" }}>
          <Pal state={typing ? "thinking" : done ? "excited" : "listening"} size={110} body={pal.body} level={pal.level} energy={pal.mood.energy} />
        </View>

        {log.map((x) => (
          <Animated.View key={x.key} entering={FadeInDown.springify().damping(14)} style={bubble(x.from === "me")}>
            <Text style={[type.body, { color: x.from === "me" ? "#fff" : t.text }]}>{x.text}</Text>
          </Animated.View>
        ))}

        {typing && (
          <View style={bubble(false)}>
            <Text style={[type.body, { color: t.sub }]}>Pal is reading…</Text>
          </View>
        )}

        {failed && (
          <View style={{ gap: space.sm }}>
            <Text style={[type.caption, { color: t.danger }]}>I couldn't reach my notebook just now. Your answer is still here.</Text>
            <Button title="Try again" kind="secondary" onPress={() => answer(failed.step, failed.answer)} />
          </View>
        )}

        {!done && !typing && !failed && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {step.chips.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => answer(step, c)}
                  style={{ borderWidth: 1.5, borderColor: t.tint, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 10 }}
                >
                  <Text style={{ color: t.tint, fontWeight: "600", fontSize: 16 }}>{c}</Text>
                </Pressable>
              ))}
            </View>
            {step.text && (
              <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={step.hint}
                  placeholderTextColor={t.faint}
                  multiline
                  style={{ flex: 1, backgroundColor: t.card, color: t.text, borderRadius: radius.md, padding: space.md, fontSize: 17, maxHeight: 120, borderWidth: 1, borderColor: t.line }}
                />
                <Pressable
                  onPress={() => answer(step, draft)}
                  disabled={!draft.trim()}
                  style={{ backgroundColor: t.tint, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 14, opacity: draft.trim() ? 1 : 0.4 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Send</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        )}

        {done ? (
          <Button title="Back to cooking" onPress={() => router.back()} />
        ) : (
          !typing && <Button title="Not now" kind="ghost" onPress={() => router.back()} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
