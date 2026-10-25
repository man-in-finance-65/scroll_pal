import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Platform, Pressable, Switch, Text, View, type ViewStyle } from "react-native";
import { Pal } from "../../components/Pal";
import { Bar, Button, Card, FadeIn, NumberCard, Ring, Screen, Segmented } from "../../components/ui";
import { fx, setPref, useFxPrefs } from "../../lib/fx";
import type { PalState } from "../../lib/mood";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import type { Goal, PlanSlot } from "../../lib/types";
import { usePal } from "../../lib/usePal";
import { COOK_XP, localDay, nextLevelHint, SHARE_CAP_PER_DAY, SHARE_XP, XP_PER_LEVEL, xpMath } from "../../lib/xp";
import { weekStart } from "../../lib/mood";

const GOALS: { value: Goal; label: string }[] = [
  { value: "bulk", label: "Bulk" },
  { value: "maintain", label: "Maintain" },
  { value: "cut", label: "Cut" },
];
const GOAL_LINE: Record<Goal, string> = {
  bulk: "Bulk: I build up and get sturdier with every cook.",
  maintain: "Maintain: I get a little brighter with every cook.",
  cut: "Cut: I get leaner, lighter and float higher with every cook.",
};

export default function PalHome() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const prefs = useFxPrefs();
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
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onLongPress={() => router.push("/demo")} delayLongPress={800}><Text style={[type.title, { color: t.text }]}>Pal</Text></Pressable>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pill text={pal.mood.label} color={pal.slow ? t.sub : brand.mint} />
          <Pill text={`Lv.${p.level}`} color={brand.violet} />
        </View>
      </View>

      <View style={{ alignItems: "center", gap: space.md }}>
        <Pressable onPress={() => { fx.tap(); setPoke(true); }} accessibilityLabel="Poke Pal">
          <Pal state={state} size={230} body={pal.body} level={p.level} energy={pal.mood.energy} />
        </Pressable>
        <Pressable
          style={{ alignSelf: "stretch" }}
          accessibilityRole="button"
          onPress={() => { fx.tap(); router.navigate(s.plan ? "/plan" : "/add"); }}
        >
          <Card style={{ alignItems: "center", paddingVertical: space.md }}>
            <Text style={[type.body, { color: t.text, textAlign: "center" }]}>{pal.mood.line}</Text>
            <Text style={[type.caption, { color: t.tint, fontWeight: "700" }]}>{s.plan ? "Open your plan ›" : "Paste a link ›"}</Text>
          </Card>
        </Pressable>
      </View>

      {!s.recipe && s.progress.cooks === 0 && (
        <FadeIn>
          <Card>
            <Text style={[type.h2, { color: t.text }]}>How it works</Text>
            <Step n={1} title="Paste a cooking link" body="YouTube, Instagram, TikTok, a recipe site. I'll digest it and write the recipe." />
            <Step n={2} title="Pick a plan" body="Bulk, cut or maintain. I'll plan your meals." />
            <Step n={3} title="Cook it, tap Done" body="I cheer, and I level up when you really cook." />
            <Button title="Paste your first link" onPress={() => router.navigate("/add")} style={{ marginTop: space.sm }} />
          </Card>
        </FadeIn>
      )}

      <Tap to="/add">
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={[type.label, { color: brand.violet }]}>Level {p.level}</Text>
          <Text style={[type.caption, { color: t.sub }]}>
            {p.xpIntoLevel} / {p.xpForNext} XP
          </Text>
        </View>
        <Text style={{ color: t.text }}>
          <Text style={type.bigNumber}>{p.xp}</Text>
          <Text style={[type.h2, { color: t.sub }]}> XP</Text>
        </Text>
        <Bar value={p.xpIntoLevel} max={p.xpForNext} />
        <Text style={[type.caption, { color: t.sub }]}>{xpMath(p)}</Text>
        <Text style={[type.caption, { color: t.text, fontWeight: "600" }]}>{nextLevelHint(p)}</Text>
        {p.sharesTotal > p.sharesCounted && (
          <Text style={[type.caption, { color: t.faint }]}>
            {p.sharesTotal - p.sharesCounted} extra shares didn't count (max 3 a day).
          </Text>
        )}
      </Card>
      </Tap>

      <Tap to="/plan">
      <Card style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <Ring value={pal.weekCooks} target={pal.target} size={112}>
          <Text style={{ color: t.text, fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {pal.weekCooks}/{pal.target}
          </Text>
        </Ring>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.label, { color: brand.mint }]}>Cooks this week</Text>
          <Text style={[type.body, { color: t.text }]}>
            {pal.weekCooks} done of {pal.target} {s.plan ? "planned" : "(default goal)"}
          </Text>
          <Text style={[type.caption, { color: t.sub }]}>Week starts Monday.</Text>
        </View>
      </Card>
      </Tap>

      <WeekStrip />

      <View style={{ flexDirection: "row", gap: space.md }}>
        <Tap to="/plan" style={{ flex: 1 }}>
          <NumberCard label="Cooks" value={String(p.cooks)} color={brand.orange} math={`${p.cooks} × ${COOK_XP} = ${p.cookXp} XP`} style={{ minWidth: 0 }} />
        </Tap>
        <Tap to="/passport" style={{ flex: 1 }}>
          <NumberCard label="Stamps" value={String(s.stamps.length)} color={brand.pink} math="Taste passport ›" style={{ minWidth: 0 }} />
        </Tap>
      </View>

      <Tap to="/goals">
      <Card>
        <Text style={[type.label, { color: brand.blue }]}>Your goal</Text>
        <Segmented options={GOALS} value={s.goal} onChange={s.setGoal} />
        <Text style={[type.caption, { color: t.sub }]}>{GOAL_LINE[s.goal]}</Text>
        <Text style={[type.caption, { color: t.tint, fontWeight: "700" }]}>See how I judge recipes ›</Text>
      </Card>
      </Tap>
      <Card>
        <Text style={[type.h2, { color: t.text }]}>How points work</Text>
        <Rule plus={`+${COOK_XP} XP`} color={brand.orange} title="Finish a cook" body="Tap Done on a meal you really made." />
        <Rule plus={`+${SHARE_XP} XP`} color={brand.blue} title="Let me digest a link" body={`Only the first ${SHARE_CAP_PER_DAY} each day count.`} />
        <Rule plus={`${XP_PER_LEVEL} XP`} color={brand.violet} title="Next level" body="Every 30 XP, so 3 links (or 3 cooks, or a mix) levels me up." />
        <Text style={[type.caption, { color: t.sub }]}>Skipping a cook never costs you XP or a level. I just get sleepy until your next cook.</Text>
      </Card>

      <Card>
        <Text style={[type.h2, { color: t.text }]}>Got advice for me, pal?</Text>
        <Text style={[type.caption, { color: t.sub }]}>Anything I should do better? Good, bad or weird, I want to hear it.</Text>
        <Button title="Give me advice" kind="secondary" onPress={() => router.push({ pathname: "/feedback", params: { m: "0" } })} />
      </Card>

      <Card style={{ gap: 0 }}>
        <ToggleRow label="Sounds" value={prefs.sound} onChange={(v) => { setPref("sound", v); if (v) fx.tap(); }} />
        <ToggleRow label="Vibrations" value={prefs.vibration} onChange={(v) => { setPref("vibration", v); if (v) fx.tap(); }} />
        <View style={{ paddingTop: space.sm, gap: 6 }}>
          <Button title="Test sound + vibration" kind="secondary" onPress={fx.test} feel="own" />
          <Text style={[type.caption, { color: t.sub }]}>Can't hear anything? Turn your volume up and check the silent switch. Vibrations still work in silent mode.</Text>
        </View>
      </Card>
    </Screen>
  );
}

// Makes a whole widget tap through to its tab.
function Tap({ to, children, style }: { to: string; children: ReactNode; style?: ViewStyle }) {
  return (
    <Pressable style={style} accessibilityRole="button" onPress={() => { fx.tap(); router.navigate(to as never); }}>
      {children}
    </Pressable>
  );
}

// Mon–Sun for this week: tick the cooks you've done. A planned cook asks "Did you cook it?" before it counts.
function WeekStrip() {
  const t = useTheme();
  const s = useStore();
  const start = weekStart();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
    return { date: localDay(d.toISOString()), label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3) };
  });
  const today = localDay(new Date().toISOString());
  const cookSlots = (s.plan?.slots ?? []).filter((x) => x.kind === "cook");
  const loggedOn = (date: string) => s.cookLog.some((c) => localDay(c.at) === date);

  function confirm(slot: PlanSlot) {
    const run = () => {
      const res = s.completeSlot(slot.id);
      if (!res) return;
      if (res.leveledUp) fx.levelUp();
      else fx.done();
    };
    if (Platform.OS === "web") { if (globalThis.confirm?.(`Did you cook ${slot.meal}?`)) run(); return; }
    Alert.alert("Did you cook it?", slot.meal, [{ text: "Not yet", style: "cancel" }, { text: "Yes, I cooked it!", onPress: run }]);
  }

  return (
    <Card>
      <Text style={[type.label, { color: brand.mint }]}>Tick your cooks this week</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {days.map((d) => {
          const slot = cookSlots.find((x) => x.date === d.date);
          const done = slot?.status === "done" || (!slot && loggedOn(d.date));
          const open = slot?.status === "planned";
          return (
            <Pressable
              key={d.date}
              disabled={!slot}
              onPress={() => (open ? confirm(slot!) : router.navigate("/plan"))}
              style={{ alignItems: "center", gap: 6, opacity: slot || done ? 1 : 0.45 }}
              accessibilityLabel={`${d.label}: ${done ? "cooked" : open ? "planned, tap to tick" : slot ? "skipped" : "no cook planned"}`}
            >
              <Text style={[type.caption, { color: d.date === today ? t.tint : t.sub, fontWeight: d.date === today ? "800" : "500" }]}>{d.label}</Text>
              <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: done ? t.ok : "transparent", borderWidth: done ? 0 : 2, borderStyle: open ? "solid" : "dashed", borderColor: open ? brand.orange : t.faint }}>
                <Text style={{ color: done ? "#fff" : t.faint, fontWeight: "800" }}>{done ? "✓" : slot?.status === "skipped" ? "–" : ""}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={[type.caption, { color: t.sub }]}>
        {s.plan ? "Tap an orange circle when you've cooked that meal." : "Make a plan from a recipe and your cooks show up here."}
      </Text>
    </Card>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.md, alignItems: "center", paddingVertical: 4 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: brand.violet + "22", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: brand.violet, fontWeight: "800", fontSize: 16 }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: t.text, fontWeight: "600" }]}>{title}</Text>
        <Text style={[type.caption, { color: t.sub }]}>{body}</Text>
      </View>
    </View>
  );
}

function Rule({ plus, color, title, body }: { plus: string; color: string; title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.md, alignItems: "center", paddingVertical: 4 }}>
      <View style={{ minWidth: 76, paddingVertical: 6, borderRadius: 10, backgroundColor: color + "22", alignItems: "center" }}>
        <Text style={{ color, fontWeight: "800", fontSize: 15, fontVariant: ["tabular-nums"] }}>{plus}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: t.text, fontWeight: "600" }]}>{title}</Text>
        <Text style={[type.caption, { color: t.sub }]}>{body}</Text>
      </View>
    </View>
  );
}

function ToggleRow({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderColor: t.line }}>
      <Text style={[type.body, { color: t.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: brand.violet }} />
    </View>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: color + "22" }}>
      <Text style={{ color, fontWeight: "700", fontSize: 14 }}>{text}</Text>
    </View>
  );
}
