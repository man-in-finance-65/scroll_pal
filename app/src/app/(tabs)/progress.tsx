import { router } from "expo-router";
import { Alert, Platform, Switch, Text, View } from "react-native";
import { Pal } from "../../components/Pal";
import { Bar, Bubble, Button, Card, Choice, NumberCard, Row, Screen } from "../../components/ui";
import { stampEmoji } from "../../lib/cuisine";
import { num } from "../../lib/format";
import { fx, setPref, useFxPrefs, webCanVibrate } from "../../lib/fx";
import { mealTarget } from "../../lib/meal";
import { FIT_AFTER_COOKS } from "../../lib/mood";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import type { Goal } from "../../lib/types";
import { COOK_XP, EAT_CAP_PER_DAY, EAT_XP, nextLevelHint, SHARE_CAP_PER_DAY, SHARE_XP, XP_PER_LEVEL, xpMath } from "../../lib/xp";

// Progress: how far we've come (you and Pal), the rules, and settings.
const GOALS: { value: Goal; title: string; icon: string }[] = [
  { value: "cut", title: "Lose weight", icon: "⚖️" },
  { value: "bulk", title: "Build muscle", icon: "💪" },
  { value: "maintain", title: "Eat healthier", icon: "🥦" },
];

export default function Progress() {
  const t = useTheme();
  const s = useStore();
  const prefs = useFxPrefs();
  const p = s.progress;
  const fit = p.cooks >= FIT_AFTER_COOKS;
  const aim = mealTarget(s.body, s.goal);
  const togo = s.body ? Math.abs(s.body.weightKg - s.body.targetKg) : 0;

  function reset() {
    const msg = "This wipes your XP, pact, recipes and name on this phone.";
    if (Platform.OS === "web") return void (globalThis.confirm?.(msg) && s.resetAll());
    Alert.alert("Start over?", msg, [{ text: "Cancel", style: "cancel" }, { text: "Start over", style: "destructive", onPress: s.resetAll }]);
  }

  return (
    <Screen>
      <Text style={[type.title, { color: t.text }]}>Our progress</Text>
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Pal mood={fit ? "fit" : "chubby"} size={150} />
        <Bubble>
          {fit ? `${p.cooks} cooks in. Look at me, all trim!` : `${FIT_AFTER_COOKS - p.cooks} more ${FIT_AFTER_COOKS - p.cooks === 1 ? "cook" : "cooks"} and I slim down.`}
        </Bubble>
      </View>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[type.label, { color: brand.violet }]}>Level {p.level}</Text>
          <Text style={[type.caption, { color: t.sub }]}>{p.xpIntoLevel} / {p.xpForNext} XP</Text>
        </View>
        <Bar value={p.xpIntoLevel} max={p.xpForNext} />
        <Text style={[type.caption, { color: t.sub }]}>{xpMath(p)}</Text>
        <Text style={[type.caption, { color: t.text, fontWeight: "600" }]}>{nextLevelHint(p)}</Text>
      </Card>

      {s.body ? (
        <View style={{ flexDirection: "row", gap: space.md }}>
          <NumberCard label="Weight" value={num(s.body.weightKg)} unit="kg" color={brand.sky} math={`Target ${num(s.body.targetKg)} kg`} />
          <NumberCard label="To go" value={num(togo)} unit="kg" color={brand.mint} math={`${num(s.body.weightKg)} to ${num(s.body.targetKg)}`} />
        </View>
      ) : null}
      {aim ? (
        <Card>
          <Text style={[type.label, { color: brand.orange }]}>Meal target</Text>
          <Text style={[type.bigNumber, { color: t.text }]}>~{aim.perMeal} <Text style={[type.body, { color: t.sub }]}>kcal</Text></Text>
          <Text style={[type.caption, { color: t.sub }]}>{aim.math}</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={[type.label, { color: t.sub }]}>How I level up</Text>
        <Row first left="Feed me a link" right={`+${SHARE_XP}`} sub={`First ${SHARE_CAP_PER_DAY} a day`} />
        <Row left="Cook a meal" right={`+${COOK_XP}`} />
        <Row left="Eat it" right={`+${EAT_XP}`} sub={`First ${EAT_CAP_PER_DAY} a day`} />
        <Row left="Next level" right={`every ${XP_PER_LEVEL}`} sub="Skipping a cook never costs XP" />
      </Card>

      <Text style={[type.label, { color: t.sub }]}>Our goal</Text>
      <View style={{ gap: space.sm }}>
        {GOALS.map((g) => <Choice key={g.value} title={g.title} icon={g.icon} selected={s.goal === g.value} onPress={() => s.setGoal(g.value)} />)}
      </View>

      {s.stamps.length ? (
        <Card>
          <Text style={[type.label, { color: brand.pink }]}>Passport · {s.stamps.length} stamps</Text>
          <Text style={{ fontSize: 28 }}>{s.stamps.map((x) => stampEmoji(x.label, x.kind)).join(" ")}</Text>
        </Card>
      ) : null}

      <Card style={{ gap: 0 }}>
        <Toggle label="Sounds" value={prefs.sound} onChange={(v) => { setPref("sound", v); if (v) fx.tap(); }} />
        <Toggle label="Vibrations" value={prefs.vibration} onChange={(v) => { setPref("vibration", v); if (v) fx.tap(); }} last />
        {Platform.OS === "web" && !webCanVibrate() ? (
          <Text style={[type.caption, { color: t.faint, paddingTop: space.xs }]}>This browser can't vibrate. Sounds still play.</Text>
        ) : null}
      </Card>
      <Button title="Give me advice" kind="secondary" onPress={() => router.push({ pathname: "/feedback", params: { m: "0" } })} />
      <Button title="Start over" kind="ghost" onPress={reset} />
    </Screen>
  );
}

function Toggle({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderColor: t.line }}>
      <Text style={[type.body, { color: t.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: brand.violet }} />
    </View>
  );
}
