import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Pal } from "../components/Pal";
import { Button, Card, DetailsButton, NumberCard, Screen, Segmented, SpeechBubble } from "../components/ui";
import { fx } from "../lib/fx";
import { api, ApiError } from "../lib/api";
import { est, num, qtyText } from "../lib/format";
import { useStore } from "../lib/store";
import { brand, radius, space, type, useTheme } from "../lib/theme";
import type { Goal } from "../lib/types";
import { usePal } from "../lib/usePal";

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
  const [cooked, setCooked] = useState<number | null>(null); // XP from the last cook, shown for a moment
  useEffect(() => {
    if (cooked === null) return;
    const id = setTimeout(() => setCooked(null), 2200);
    return () => clearTimeout(id);
  }, [cooked]);
  const r = s.recipe;

  if (!r) {
    return (
      <Screen padTop={false}>
        <View style={{ alignItems: "center" }}>
          <Pal state="listening" size={140} body={pal.body} level={pal.level} />
        </View>
        <Button title="Here's a recipe, Pal" onPress={() => router.navigate("/add")} />
      </Screen>
    );
  }
  const m = r.macros_per_serving;
  const ms = m.source;

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

  function cook() {
    const res = s.cook(r!);
    if (res.leveledUp) fx.levelUp();
    else fx.done();
    setCooked(res.xp);
  }

  return (
    <Screen padTop={false}>
      <View style={{ gap: 6 }}>
        <Text style={[type.title, { color: t.text }]}>{r.title}</Text>
        <Text style={[type.body, { color: t.sub }]}>{r.creator}</Text>
      </View>

      {r.image ? (
        <Image source={{ uri: r.image }} accessibilityLabel={r.title} resizeMode="cover" style={{ width: "100%", aspectRatio: 16 / 10, borderRadius: radius.lg, backgroundColor: t.cardAlt }} />
      ) : null}

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <NumberCard label="Energy" value={`${est(ms)}${num(m.kcal, 0)}`} unit="kcal" color={brand.orange} />
          <NumberCard label="Protein" value={`${est(ms)}${num(m.protein_g)}`} unit="g" color={brand.pink} />
        </View>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <NumberCard label="Carbs" value={`${est(ms)}${num(m.carbs_g)}`} unit="g" color={brand.blue} />
          <NumberCard label="Fat" value={`${est(ms)}${num(m.fat_g)}`} unit="g" color={brand.mint} />
        </View>
        <NumberCard label="Time" value={num(r.prep_minutes + r.cook_minutes, 0)} unit="min" color={brand.violet} />
        <DetailsButton />
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

      <Card style={{ alignItems: "center", gap: space.md }}>
        {cooked !== null && <SpeechBubble>{`Delicious! +${cooked} XP`}</SpeechBubble>}
        <Pal state={cooked !== null ? "excited" : "helping"} size={110} body={pal.body} level={pal.level} energy={pal.mood.energy} />
        <Button title="We cooked it!" kind="success" feel="own" onPress={cook} style={{ alignSelf: "stretch" }} />
      </Card>

      <Card style={{ gap: space.md }}>
        <Text style={[type.h2, { color: t.text }]}>Plan it with me</Text>
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
        <Button title={busy ? "Planning…" : "Plan it"} onPress={build} loading={busy} />
      </Card>
    </Screen>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { fx.tap(); onPress(); }}
      style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: t.cardAlt, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: t.tint, fontSize: 22, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
