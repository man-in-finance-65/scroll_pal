import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Pal, type Mood } from "../components/Pal";
import { Button, Empty } from "../components/ui";
import { currentCook } from "../lib/cookSession";
import { stepDurations } from "../lib/timers";
import { cookXp, levelInfo, mealProteinTarget, totalXp, xpForCook } from "../lib/progress";
import { useStore } from "../lib/store";
import { colors, fonts } from "../lib/theme";
import type { Cook } from "../lib/types";

// Kitchen view: white on near-black, very large type, so it reads from about 4 feet away.
const BG = "#141210";
const FG = "#FFFFFF";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const youtubeId = (url: string) => url.match(/youtube\.com\/shorts\/([\w-]+)/)?.[1] ?? null;

type Timer = { id: number; label: string; endsAt: number; total: number };

export default function CookScreen() {
  useKeepAwake(); // the screen stays on while you cook
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const session = currentCook();
  const [i, setI] = useState(0);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(Date.now());
  const [showIngredients, setShowIngredients] = useState(false);
  const [bump, setBump] = useState(0);
  const [mood, setMood] = useState<Mood>("idle");
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState<Cook | null>(null);
  const [video, setVideo] = useState(false);

  // Timers keep counting when you change steps: they live here, not in the step.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (timers.some((t) => t.endsAt <= now && t.endsAt > now - 600)) Vibration.vibrate([0, 400, 200, 400]);
  }, [now, timers]);

  if (!session) {
    return (
      <View style={[st.screen, { paddingTop: insets.top + 24 }]}>
        <Empty emoji="🍳" title="Nothing to cook" body="Start Cook with Me from a recipe or from your meal plan." action={<Button title="Back" onPress={() => router.back()} />} />
      </View>
    );
  }
  const { dish } = session;
  const steps = dish.instructions;
  const step = steps[i];
  const last = i === steps.length - 1;
  const ytId = dish.creator.platform === "youtube" ? youtubeId(dish.creator.video_url) : null;
  const ts = step.video_timestamp_sec;

  const next = () => {
    setBump((b) => b + 1);
    setMood(last ? "cheer" : "happy");
    setVideo(false);
    if (last) setFinishing(true);
    else setI(i + 1);
  };
  const addTimer = (sec: number) =>
    setTimers((ts) => [...ts, { id: Date.now(), label: `Step ${step.step_number} · ${mmss(sec)}`, endsAt: Date.now() + sec * 1000, total: sec }]);

  const finish = (noWaste: boolean) => {
    const cook: Cook = { at: Date.now(), dish, xp: xpForCook(dish, store.targets[store.goal], noWaste) };
    store.logCook(cook);
    setFinishing(false);
    setDone(cook);
  };

  if (done) {
    const before = levelInfo(totalXp(store.cooks) - cookXp(done));
    const after = levelInfo(totalXp(store.cooks));
    const target = mealProteinTarget(store.targets[store.goal]);
    return (
      <ScrollView style={{ backgroundColor: BG }} contentContainerStyle={[st.doneWrap, { paddingTop: insets.top + 24 }]}>
        <Pal size={160} mood="cheer" bump={1} />
        <Text style={st.big}>{after.level > before.level ? `Level ${after.level}!` : "Dish cooked!"}</Text>
        <Text style={st.xpLine}>+{XPLine(done)} XP</Text>
        <Text style={st.math}>{XP_MATH(done, target, dish.macros.protein_g)}</Text>
        <Text style={st.math}>Level {after.level}: {after.into} of {after.need} XP to level {after.level + 1}</Text>
        <Button title="Back to Pal" onPress={() => router.replace("/")} />
      </ScrollView>
    );
  }

  return (
    <View style={[st.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <View style={st.top}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={st.topLink}>✕ Exit</Text></Pressable>
        <Text style={st.progress}>Step {i + 1} of {steps.length}</Text>
        <Pressable onPress={() => setShowIngredients(true)} hitSlop={12}><Text style={st.topLink}>Ingredients</Text></Pressable>
      </View>

      {timers.length > 0 && (
        <View style={st.timers}>
          {timers.map((t) => {
            const left = Math.max(0, Math.ceil((t.endsAt - now) / 1000));
            return (
              <Pressable key={t.id} onPress={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))} style={[st.timer, left === 0 && st.timerDone]}>
                <Text style={st.timerNum}>{left === 0 ? "DONE" : mmss(left)}</Text>
                <Text style={st.timerLabel}>{t.label} · tap to clear</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingVertical: 8 }}>
        <View style={{ alignItems: "center" }}>
          <Pal size={90} mood={mood} bump={bump} />
        </View>
        <Text style={st.stepText}>{step.text}</Text>
        {step.chef_tip && <Text style={st.tip}>💡 {step.chef_tip}</Text>}

        <View style={st.actions}>
          {stepDurations(step.text).map((sec) => (
            <Pressable key={sec} onPress={() => addTimer(sec)} style={st.action}>
              <Text style={st.actionText}>⏱ Start {mmss(sec)} timer</Text>
            </Pressable>
          ))}
          {ts !== null && (ytId ? (
            <Pressable onPress={() => setVideo(!video)} style={st.action}>
              <Text style={st.actionText}>{video ? "Hide video" : `▶ Play from ${mmss(ts)}`}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => Linking.openURL(dish.creator.video_url)} style={st.action}>
              <Text style={st.actionText}>▶ Watch at {mmss(ts)}</Text>
            </Pressable>
          ))}
        </View>
        {video && ytId && ts !== null && (
          <View style={st.video}>
            <WebView
              originWhitelist={["*"]}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              // YouTube refuses embeds with no referring page, so the player is wrapped in a page with a real origin.
              source={{
                baseUrl: "https://pal.local/",
                html: `<html><body style="margin:0;background:#000"><iframe width="100%" height="100%" style="border:0;position:absolute;inset:0" src="https://www.youtube.com/embed/${ytId}?start=${ts}&autoplay=1&playsinline=1" allow="autoplay; encrypted-media" allowfullscreen></iframe></body></html>`,
              }}
            />
          </View>
        )}
      </ScrollView>

      <View style={st.nav}>
        <Pressable disabled={i === 0} onPress={() => { setI(i - 1); setVideo(false); }} style={[st.navBtn, i === 0 && { opacity: 0.3 }]}>
          <Text style={st.navText}>◀ Back</Text>
        </Pressable>
        <Pressable onPress={next} style={[st.navBtn, st.navNext]}>
          <Text style={[st.navText, { color: "#fff" }]}>{last ? "Finish ✓" : "Next ▶"}</Text>
        </Pressable>
      </View>

      <Modal visible={showIngredients} animationType="slide" transparent onRequestClose={() => setShowIngredients(false)}>
        <View style={st.sheet}>
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
            <Text style={st.sheetTitle}>Ingredients</Text>
            {dish.ingredients.map((g, n) => (
              <Text key={n} style={st.ing}>• {`${Number(g.quantity.toFixed(2))} ${g.unit}`.trim()} {g.name}</Text>
            ))}
            {dish.swapsOn.length > 0 && <Text style={st.tip}>Pal swaps in this version: {dish.swapsOn.join(", ")} were replaced (the steps still use the creator's words).</Text>}
          </ScrollView>
          <Button title="Close" onPress={() => setShowIngredients(false)} />
        </View>
      </Modal>

      <Modal visible={finishing} animationType="fade" transparent onRequestClose={() => setFinishing(false)}>
        <View style={st.sheet}>
          <Text style={st.sheetTitle}>Nice work! One question</Text>
          <Text style={st.ing}>Did everything you bought for this get used, with nothing thrown away?</Text>
          <Button title="Yes, zero waste (+10 XP)" onPress={() => finish(true)} />
          <Button title="No, some will go to waste" kind="ghost" onPress={() => finish(false)} />
          <Pressable onPress={() => setFinishing(false)}><Text style={[st.topLink, { textAlign: "center" }]}>Not finished yet</Text></Pressable>
        </View>
      </Modal>
    </View>
  );
}

const XPLine = (c: Cook) => cookXp(c);
function XP_MATH(c: Cook, proteinTarget: number, protein: number) {
  const parts = [`${c.xp.base} for cooking`];
  parts.push(c.xp.protein ? `${c.xp.protein} for protein (${protein} g ≥ your ${proteinTarget} g per meal)` : `0 for protein (${protein} g < your ${proteinTarget} g per meal)`);
  parts.push(c.xp.noWaste ? `${c.xp.noWaste} for zero waste` : "0 for waste");
  return `${parts.join(" + ")} = ${cookXp(c)} XP`;
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 18 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  topLink: { fontFamily: fonts.bodyBold, fontSize: 17, color: "#D6D3D1" },
  progress: { fontFamily: fonts.headingMid, fontSize: 17, color: FG },
  timers: { gap: 8 },
  timer: { backgroundColor: "#292524", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  timerDone: { backgroundColor: colors.primary },
  timerNum: { fontFamily: fonts.heading, fontSize: 30, color: FG, minWidth: 96 },
  timerLabel: { fontFamily: fonts.body, fontSize: 14, color: "#D6D3D1", flex: 1 },
  stepText: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 44, color: FG },
  tip: { fontFamily: fonts.body, fontSize: 20, lineHeight: 28, color: "#FCD34D" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: { backgroundColor: "#292524", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  actionText: { fontFamily: fonts.headingMid, fontSize: 18, color: FG },
  video: { height: 420, borderRadius: 14, overflow: "hidden", backgroundColor: "#000" },
  nav: { flexDirection: "row", gap: 12, paddingTop: 8 },
  navBtn: { flex: 1, borderRadius: 18, paddingVertical: 22, alignItems: "center", backgroundColor: "#292524" },
  navNext: { flex: 1.6, backgroundColor: colors.primary },
  navText: { fontFamily: fonts.heading, fontSize: 24, color: FG },
  sheet: { marginTop: "auto", backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12, maxHeight: "80%" },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  ing: { fontFamily: fonts.body, fontSize: 20, color: colors.text, lineHeight: 28 },
  doneWrap: { alignItems: "center", gap: 14, padding: 24, flexGrow: 1, justifyContent: "center" },
  big: { fontFamily: fonts.heading, fontSize: 40, color: FG },
  xpLine: { fontFamily: fonts.heading, fontSize: 30, color: colors.green },
  math: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: "#D6D3D1", textAlign: "center" },
});
