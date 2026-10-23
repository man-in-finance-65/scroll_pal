import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Pal } from "../../components/Pal";
import { Bar, Button, Card, FadeIn, haptic, NumberCard, Ring, Screen, Segmented } from "../../components/ui";
import { fx, setPref, useFxPrefs } from "../../lib/fx";
import type { PalState } from "../../lib/mood";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import type { Goal } from "../../lib/types";
import { usePal } from "../../lib/usePal";
import { COOK_XP, nextLevelHint, SHARE_CAP_PER_DAY, SHARE_XP, XP_PER_LEVEL, xpMath } from "../../lib/xp";

const GOALS: { value: Goal; label: string }[] = [
  { value: "bulk", label: "Bulk" },
  { value: "maintain", label: "Maintain" },
  { value: "cut", label: "Cut" },
];
const GOAL_LINE: Record<Goal, string> = {
  bulk: "Bulk: Pal builds up and gets sturdier with every cook.",
  maintain: "Maintain: Pal gets a little brighter with every cook.",
  cut: "Cut: Pal gets leaner, lighter and floats higher with every cook.",
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
        <Text style={[type.title, { color: t.text }]}>Pal</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pill text={pal.mood.label} color={pal.slow ? t.sub : brand.mint} />
          <Pill text={`Lv.${p.level}`} color={brand.violet} />
        </View>
      </View>

      <View style={{ alignItems: "center", gap: space.md }}>
        <Pressable onPress={() => { fx.done(); setPoke(true); }} accessibilityLabel="Poke Pal">
          <Pal state={state} size={230} body={pal.body} level={p.level} energy={pal.mood.energy} />
        </Pressable>
        <Card style={{ alignSelf: "stretch", alignItems: "center", paddingVertical: space.md }}>
          <Text style={[type.body, { color: t.text, textAlign: "center" }]}>{pal.mood.line}</Text>
        </Card>
      </View>

      {!s.recipe && s.progress.cooks === 0 && (
        <FadeIn>
          <Card>
            <Text style={[type.h2, { color: t.text }]}>How it works</Text>
            <Step n={1} title="Paste a cooking video" body="Any YouTube Short. Pal watches it and writes the recipe." />
            <Step n={2} title="Pick a plan" body="Bulk, cut or maintain. Pal plans your meals." />
            <Step n={3} title="Cook it, tap Done" body="Pal cheers, and levels up when you really cook." />
            <Button title="Paste your first video" onPress={() => router.navigate("/add")} style={{ marginTop: space.sm }} />
          </Card>
        </FadeIn>
      )}

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

      <View style={{ flexDirection: "row", gap: space.md }}>
        <NumberCard label="Cooks" value={String(p.cooks)} color={brand.orange} math={`${p.cooks} × ${COOK_XP} = ${p.cookXp} XP`} />
        <NumberCard label="Stamps" value={String(s.stamps.length)} color={brand.pink} math="Taste passport" />
      </View>

      <Card>
        <Text style={[type.label, { color: brand.blue }]}>Your goal</Text>
        <Segmented options={GOALS} value={s.goal} onChange={s.setGoal} />
        <Text style={[type.caption, { color: t.sub }]}>{GOAL_LINE[s.goal]}</Text>
      </Card>
      <Card>
        <Text style={[type.h2, { color: t.text }]}>How points work</Text>
        <Rule plus={`+${COOK_XP} XP`} color={brand.orange} title="Finish a cook" body="Tap Done on a meal you really made." />
        <Rule plus={`+${SHARE_XP} XP`} color={brand.blue} title="Add a recipe" body={`Only the first ${SHARE_CAP_PER_DAY} each day count.`} />
        <Rule plus={`${XP_PER_LEVEL} XP`} color={brand.violet} title="Next level" body="Every 30 XP, but only finishing a cook can level Pal up. Adding recipes alone never will." />
        <Text style={[type.caption, { color: t.sub }]}>Skipping a cook never costs you XP or a level. Pal just gets sleepy until your next cook.</Text>
      </Card>

      <Card>
        <Text style={[type.h2, { color: t.text }]}>Got advice for me, pal?</Text>
        <Text style={[type.caption, { color: t.sub }]}>Tell me what's good, what's confusing, or what I should learn next. I read every one.</Text>
        <Button title="Talk to Pal" kind="secondary" onPress={() => router.push({ pathname: "/feedback", params: { m: "0" } })} />
      </Card>

      <Card style={{ gap: 0 }}>
        <ToggleRow label="Sounds" value={prefs.sound} onChange={(v) => { setPref("sound", v); if (v) fx.tick(); }} />
        <ToggleRow label="Vibrations" value={prefs.vibration} onChange={(v) => { setPref("vibration", v); if (v) haptic.pop(); }} last />
      </Card>
    </Screen>
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
