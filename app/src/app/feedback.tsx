import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance, type ViewInstance } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pal } from "../components/Pal";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { ALL, moreStep, nextStep, SCRIPT } from "../lib/chat";
import { fx } from "../lib/fx";
import { useStore } from "../lib/store";
import { radius, space, type, useTheme } from "../lib/theme";
import type { ChatMsg, ChatSave, ChatStep } from "../lib/types";
import { usePal } from "../lib/usePal";

// Pal asks for advice like a mate would. No form, no "rate us": one question at a time,
// tap an answer or say it in your own words. Each answer is saved on its own, and the whole conversation is
// kept on the phone, so closing the chat never loses anything.

export default function Feedback() {
  const s = useStore();
  const { m } = useLocalSearchParams<{ m?: string }>();
  const milestone = [1, 3].includes(Number(m)) ? Number(m) : 0;
  if (!s.ready) return null; // wait for the saved chat to load before showing anything
  return <Chat milestone={milestone} />;
}

function freshChat(milestone: number): ChatSave {
  const first = SCRIPT[milestone][0];
  return { log: [{ from: "pal", text: first.ask, key: "q0" }], step: first, finished: false, asked: [] };
}

// Lifts the bottom bar above the keyboard. Measures where this screen really ends on the display, so it is right in
// a pop-up sheet with a header too (a plain KeyboardAvoidingView gets that wrong, which is how the keyboard
// used to cover what you were typing).
function useKeyboardLift(ref: React.RefObject<ViewInstance | null>) {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      ref.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => setLift(Math.max(0, y + h - e.endCoordinates.screenY)));
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setLift(0));
    return () => { show.remove(); hide.remove(); };
  }, [ref]);
  return lift;
}

function Chat({ milestone }: { milestone: number }) {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const insets = useSafeAreaInsets();
  const key = String(milestone);

  // Come back to the same conversation. If it had ended, Pal welcomes you back and carries on.
  const [chat, setChat] = useState<ChatSave>(() => {
    const saved = s.chats[key];
    if (!saved) return freshChat(milestone);
    if (!saved.finished) return saved;
    const step = moreStep(saved.asked.filter((x) => x.startsWith("more")).length);
    return { ...saved, finished: false, step, log: [...saved.log, { from: "pal", text: "Welcome back, pal! Anything new on your mind?", key: "back" + saved.log.length }] };
  });
  const { log, step, finished } = chat;
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [failed, setFailed] = useState<{ step: ChatStep; answer: string } | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  const frame = useRef<ViewInstance>(null);
  const lift = useKeyboardLift(frame);

  useEffect(() => {
    if (milestone) s.markFeedbackAsked(milestone); // asked once; never nags
  }, []);
  useEffect(() => { s.saveChat(key, chat); }, [chat]);
  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(id);
  }, [log, typing, failed, lift]);

  async function answer(st: ChatStep, a: string) {
    const text = a.trim();
    if (!text) return;
    fx.tap();
    if (text === ALL && st.apiId === "more") {
      // Nothing to save, just a goodbye.
      setChat((c) => ({ ...c, finished: true, asked: [...c.asked, st.id], log: [...c.log, { from: "me", text, key: "a" + st.id }, { from: "pal", text: "Anytime, pal. 💜", key: "bye" + c.log.length }] }));
      return;
    }
    setDraft("");
    setFailed(null);
    setChat((c) => ({ ...c, log: c.log.some((x) => x.key === "a" + st.id) ? c.log : [...c.log, { from: "me", text, key: "a" + st.id }] }));
    setTyping(true);
    try {
      await api.feedback({ device: s.deviceId, milestone, level: s.progress.level, cooks: s.progress.cooks, id: st.apiId ?? st.id, q: st.ask, a: text });
    } catch {
      setTyping(false);
      setFailed({ step: st, answer: text });
      return;
    }
    setTimeout(() => {
      setTyping(false);
      fx.ready();
      setChat((c) => {
        const asked = [...c.asked, st.id];
        const next = nextStep({ milestone, asked, lastAnswer: text, moreCount: asked.filter((x) => x.startsWith("more")).length });
        const msg: ChatMsg = { from: "pal", text: next.ask, key: "q" + asked.length };
        return { ...c, asked, step: next, log: [...c.log, msg] };
      });
    }, 600);
  }

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

  const canType = !finished && !typing && !failed;

  return (
    <View ref={frame} collapsable={false} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <View style={{ alignItems: "center" }}>
          <Pal state={typing ? "thinking" : finished ? "excited" : "listening"} size={lift ? 70 : 110} body={pal.body} level={pal.level} energy={pal.mood.energy} />
        </View>

        {log.map((x) => (
          <Animated.View key={x.key} entering={FadeInDown.springify().damping(14)} style={bubble(x.from === "me")}>
            <Text style={[type.body, { color: x.from === "me" ? "#fff" : t.text }]}>{x.text}</Text>
          </Animated.View>
        ))}

        {typing && (
          <View style={bubble(false)}>
            <Text style={[type.body, { color: t.sub }]}>Noting that down…</Text>
          </View>
        )}

        {failed && (
          <View style={{ gap: space.sm }}>
            <Text style={[type.caption, { color: t.danger }]}>I couldn't save that just now. Your answer is still here.</Text>
            <Button title="Try again" kind="secondary" onPress={() => answer(failed.step, failed.answer)} />
          </View>
        )}

        {canType && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {step.chips.map((c) => (
              <Pressable
                key={c}
                onPress={() => answer(step, c)}
                style={{ borderWidth: 1.5, borderColor: t.tint, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 10 }}
              >
                <Text style={{ color: t.tint, fontWeight: "600", fontSize: 16 }}>{c}</Text>
              </Pressable>
            ))}
          </Animated.View>
        )}

        {finished ? (
          <Button title="Back to cooking" onPress={() => router.back()} />
        ) : (
          !typing && !lift && <Button title={log.length > 1 ? "Close" : "Not now"} kind="ghost" onPress={() => router.back()} />
        )}
      </ScrollView>

      {/* Pinned under the conversation, and lifted above the keyboard so you can always see what you're typing. */}
      {canType && (
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end", paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: (lift || insets.bottom) + space.sm, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={step.hint ?? "Or type your own answer…"}
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
    </View>
  );
}
