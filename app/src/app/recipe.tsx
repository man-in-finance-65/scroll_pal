import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Pal } from "../components/Pal";
import { Button, Card, haptic, NumberCard, Screen, Segmented } from "../components/ui";
import { fx } from "../lib/fx";
import { api, ApiError } from "../lib/api";
import { est, num, qtyText } from "../lib/format";
import { useStore } from "../lib/store";
import { brand, radius, space, type, useTheme } from "../lib/theme";
import type { Goal } from "../lib/types";
import { usePal } from "../lib/usePal";
import { COOK_XP } from "../lib/xp";

const GOALS: { value: Goal; label: string }[] = [
  { value: "bulk", label: "Bulk" },
  { value: "maintain", label: "Maintain" },
  { value: "cut", label: "Cut" },
];

export default function RecipeScreen() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const [days, setDays] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = s.recipe;

  if (!r) {
    return (
      <Screen padTop={false}>
        <Text style={[type.body, { color: t.sub }]}>No recipe open. Paste a link on the Add tab.</Text>
      </Screen>
    );
  }
  const m = r.macros_per_serving;
  const ms = m.source;
  const anyEstimated = ms === "estimated" || r.ingredients.some((i) => i.source === "estimated");

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const plan = await api.plan(r!, s.goal, days);
      s.savePlan(plan, r!, s.goal, days);
      fx.ready();
      router.dismissTo("/plan"); // pop back to the tabs and switch to Plan
    } catch (e) {
      fx.error();
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen padTop={false}>
      <View style={{ gap: 6 }}>
        <Text style={[type.title, { color: t.text }]}>{r.title}</Text>
        <Text style={[type.body, { color: t.sub }]}>
          {r.creator} · {r.cuisine} · serves {r.servings}
        </Text>
        <Text style={[type.caption, { color: t.faint }]}>Pal is {Math.floor(r.confidence * 100)}% sure this is the recipe.</Text>
      </View>

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <NumberCard label="Energy" value={`${est(ms)}${num(m.kcal, 0)}`} unit="kcal" color={brand.orange} math="per serving" />
          <NumberCard label="Protein" value={`${est(ms)}${num(m.protein_g)}`} unit="g" color={brand.pink} math="per serving" />
        </View>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <NumberCard label="Carbs" value={`${est(ms)}${num(m.carbs_g)}`} unit="g" color={brand.blue} math="per serving" />
          <NumberCard label="Fat" value={`${est(ms)}${num(m.fat_g)}`} unit="g" color={brand.mint} math="per serving" />
        </View>
        <NumberCard
          label="Time"
          value={`${num(r.prep_minutes + r.cook_minutes, 0)}`}
          unit="min"
          color={brand.violet}
          math={`${num(r.prep_minutes, 0)} prep + ${num(r.cook_minutes, 0)} cook = ${num(r.prep_minutes + r.cook_minutes, 0)} min`}
        />
        {anyEstimated && (
          <Text style={[type.caption, { color: t.sub }]}>~ means Pal estimated it. Everything else was said or shown in the video.</Text>
        )}
      </View>

      <Card>
        <Text style={[type.h2, { color: t.text }]}>Ingredients</Text>
        {r.ingredients.map((i, k) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: k ? 1 : 0, borderColor: t.line, gap: space.md }}>
            <Text style={[type.body, { color: t.text, flex: 1 }]}>{i.name}</Text>
            <Text style={[type.body, { color: i.source === "estimated" ? t.sub : t.text, fontVariant: ["tabular-nums"] }]}>
              {est(i.source)}
              {qtyText(i.qty, i.unit)}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={[type.h2, { color: t.text }]}>Steps</Text>
        {r.steps.map((st, k) => (
          <View key={k} style={{ flexDirection: "row", gap: space.md, paddingVertical: 6 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: brand.violet + "22", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: brand.violet, fontWeight: "800" }}>{k + 1}</Text>
            </View>
            <Text style={[type.body, { color: t.text, flex: 1 }]}>{st}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Pal state={busy ? "helping" : "listening"} size={72} body={pal.body} level={pal.level} />
          <View style={{ flex: 1 }}>
            <Text style={[type.h2, { color: t.text }]}>Build a plan</Text>
            <Text style={[type.caption, { color: t.sub }]}>Each cook you finish = +{COOK_XP} XP.</Text>
          </View>
        </View>
        <Segmented options={GOALS} value={s.goal} onChange={s.setGoal} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[type.body, { color: t.text }]}>Days</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Step label="−" onPress={() => setDays((d) => Math.max(1, d - 1))} />
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "700", minWidth: 24, textAlign: "center", fontVariant: ["tabular-nums"] }}>{days}</Text>
            <Step label="+" onPress={() => setDays((d) => Math.min(7, d + 1))} />
          </View>
        </View>
        {error && <Text style={[type.body, { color: t.danger }]}>{error}</Text>}
        <Button title={busy ? "Pal is planning…" : "Build my plan"} onPress={build} loading={busy} />
      </Card>
    </Screen>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { haptic.tap(); onPress(); }}
      style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: t.cardAlt, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: t.tint, fontSize: 22, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
