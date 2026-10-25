import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Choice, Pill, Stage } from "../../components/ui";
import { fx } from "../../lib/fx";
import { mondayOf } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import type { PlanSlot } from "../../lib/types";
import { localDay } from "../../lib/xp";

// Plan: first the Kitchen Pact (how many meals we cook this week), then the week itself.
const COUNTS = [
  { n: 2, sub: "An easy start" },
  { n: 3, sub: "Every other day, roughly" },
  { n: 5, sub: "Most weeknights" },
  { n: 7, sub: "Every single day" },
];

export default function PlanTab() {
  const s = useStore();
  const thisWeek = s.pactWeek === mondayOf() && s.plan;
  return thisWeek ? <Week /> : <Pact />;
}

function Pact() {
  const s = useStore();
  const [n, setN] = useState<number | null>(null);

  function seal() {
    if (!n) return;
    s.makePact(n);
    // Next: fill the week. With enough recipes the week is already full, so straight to it.
    if (s.recipes.length < n) router.push("/import");
  }

  return (
    <Stage
      mood={n ? "cheer" : "cheeky"}
      say={n ? `${n} meals. Shake on it?` : "Let's make a pact. How many meals do we cook this week?"}
      back={false}
      palSize={140}
      cta={<Button title="Continue" disabled={!n} onPress={seal} />}
    >
      <View style={{ gap: space.sm }}>
        {COUNTS.map((c) => <Choice key={c.n} title={`${c.n} meals`} sub={c.sub} selected={n === c.n} onPress={() => setN(c.n)} />)}
      </View>
    </Stage>
  );
}

function dayLabel(date: string): string {
  if (date === localDay(new Date().toISOString())) return "Today";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function Week() {
  const t = useTheme();
  const s = useStore();
  const slots = s.plan!.slots;
  const done = slots.filter((x) => x.status === "done").length;
  const empty = slots.filter((x) => !x.recipeTitle && x.status === "planned").length;

  function cook(slot: PlanSlot) {
    const recipe = s.recipes.find((r) => r.title === slot.recipeTitle);
    if (!recipe) return router.push("/meal/feed");
    s.startMeal(recipe, slot.id);
    router.push("/meal/swaps");
  }

  return (
    <Stage
      mood={done === slots.length ? "cheer" : empty ? "cheeky" : "fit"}
      say={done === slots.length ? "Pact kept! I'm so proud of us." : empty ? `${empty} empty ${empty === 1 ? "night" : "nights"}. Feed me some recipes.` : `${done} of ${slots.length} cooked. Keep going!`}
      back={false}
      palSize={120}
      cta={
        <>
          {empty ? <Button title="Fill from Instagram" onPress={() => router.push("/import")} /> : <Button title="Feed me a link" kind="secondary" onPress={() => router.push("/meal/feed")} />}
          {empty
            ? <Button title="Feed me a link" kind="ghost" onPress={() => router.push("/meal/feed")} />
            : <Button title="Import my Instagram saves" kind="ghost" onPress={() => router.push("/import")} />}
        </>
      }
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[type.label, { color: t.sub }]}>Our pact · {slots.length} meals</Text>
        <Pill text={`${done} of ${slots.length} cooked`} color={brand.mint} />
      </View>
      {slots.map((slot) => (
        <Card key={slot.id} style={{ flexDirection: "row", alignItems: "center", gap: space.md, opacity: slot.status === "skipped" ? 0.5 : 1 }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: slot.status === "done" ? brand.mint : brand.orange }]}>{dayLabel(slot.date)}</Text>
            <Text style={[type.body, { color: slot.recipeTitle ? t.text : t.faint, fontWeight: "600" }]} numberOfLines={2}>
              {slot.recipeTitle ?? "Empty. Feed me a link."}
            </Text>
          </View>
          {slot.status === "done" ? <Text style={{ color: brand.mint, fontWeight: "800" }}>✓ Cooked</Text>
            : slot.status === "skipped" ? <Text style={{ color: t.sub, fontWeight: "700" }}>Skipped</Text>
            : slot.recipeTitle ? (
              <View style={{ flexDirection: "row", gap: space.xs }}>
                <Button title="Skip" kind="ghost" feel="own" onPress={() => { fx.skip(); s.skipSlot(slot.id); }} style={{ height: 44 }} />
                <Button title="Cook" onPress={() => cook(slot)} style={{ height: 44 }} />
              </View>
            ) : null}
        </Card>
      ))}
    </Stage>
  );
}
