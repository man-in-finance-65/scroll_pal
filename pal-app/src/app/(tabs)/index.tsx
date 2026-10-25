import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pal } from "../../components/Pal";
import { slotLabel } from "../../components/PlanPicker";
import { Button, Card, Empty, H1, H2, Note, Pill, Sub, s } from "../../components/ui";
import { startCook } from "../../lib/cookSession";
import { XP, levelInfo, mealProteinTarget, totalXp } from "../../lib/progress";
import { dayKey, useStore } from "../../lib/store";
import { colors, fonts } from "../../lib/theme";
import { GOALS, SLOTS } from "../../lib/types";

export default function SousChefTab() {
  const router = useRouter();
  const store = useStore();
  const xp = totalXp(store.cooks);
  const lvl = levelInfo(xp);
  const today = dayKey(new Date());
  const queue = SLOTS.map((slot) => ({ slot, dish: store.plan[today]?.[slot] })).filter((x) => x.dish);
  const cookedToday = store.cooks.filter((c) => dayKey(new Date(c.at)) === today).length;
  const [bump, setBump] = useState(0);
  const t = store.targets[store.goal];

  return (
    <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <Card style={{ alignItems: "center", borderColor: colors.violet }}>
        <Pressable onPress={() => setBump(bump + 1)} accessibilityLabel="Poke Pal">
          <Pal size={130} mood={cookedToday ? "happy" : "idle"} bump={bump} />
        </Pressable>
        <H1>Pal · Level {lvl.level}</H1>
        <Sub>{store.cooks.length === 0 ? "Cook your first dish and I'll level up." : cookedToday ? `We cooked ${cookedToday} today. I'm proud of us.` : "Hungry? Let's cook something."}</Sub>
        <View style={st.bar}><View style={[st.fill, { width: `${lvl.need ? Math.floor((lvl.into / lvl.need) * 100) : 100}%` }]} /></View>
        <Note>{lvl.need ? `${lvl.into} of ${lvl.need} XP to level ${lvl.level + 1} · ${xp} XP total` : `Max level · ${xp} XP total`}</Note>
        <Note>+{XP.dish} per dish cooked · +{XP.protein} when it hits your protein goal ({mealProteinTarget(t)} g per meal) · +{XP.noWaste} for zero food waste</Note>
      </Card>

      <H2>Today's meals</H2>
      {queue.length === 0 ? (
        <Empty emoji="🍽️" title="Nothing planned for today" body="Plan a meal on the Meal Plan tab, or digest a new video." action={<Button title="Open Meal Plan" kind="ghost" onPress={() => router.navigate("/plan")} />} />
      ) : (
        queue.map(({ slot, dish }) => (
          <Card key={slot}>
            <Note>{slotLabel[slot]}</Note>
            <Text style={st.dish}>{dish!.title}</Text>
            <Note>{dish!.macros.calories} kcal · {dish!.macros.protein_g} g protein · {dish!.totalMin} min</Note>
            <Button title="🧑‍🍳 Cook with Me" kind="violet" onPress={() => { startCook(dish!, today, slot); router.push("/cook"); }} />
          </Card>
        ))
      )}

      <Card>
        <H2>Your goal</H2>
        <View style={st.wrap}>
          {GOALS.map((g) => <Pill key={g.id} label={g.label} on={store.goal === g.id} onPress={() => store.setGoal(g.id)} />)}
        </View>
        <Text style={st.label}>Daily targets for this goal (yours to set)</Text>
        <View style={s.row}>
          <Num label="kcal" value={t.calories} onChange={(n) => store.setTargets(store.goal, { ...t, calories: n })} />
          <Num label="g protein" value={t.protein_g} onChange={(n) => store.setTargets(store.goal, { ...t, protein_g: n })} />
        </View>
      </Card>
    </ScrollView>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <TextInput
        style={st.input}
        value={text}
        keyboardType="number-pad"
        onChangeText={setText}
        onEndEditing={() => {
          const n = parseInt(text, 10);
          if (Number.isFinite(n) && n > 0) onChange(n);
          else setText(String(value));
        }}
      />
      <Note>{label}</Note>
    </View>
  );
}

const st = StyleSheet.create({
  bar: { height: 12, alignSelf: "stretch", backgroundColor: colors.border, borderRadius: 6, overflow: "hidden" },
  fill: { height: 12, backgroundColor: colors.violet },
  dish: { fontFamily: fonts.headingMid, fontSize: 16, color: colors.text },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sub, marginTop: 6 },
  input: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 10 },
});
