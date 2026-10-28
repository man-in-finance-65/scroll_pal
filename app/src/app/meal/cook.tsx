import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, NoMeal, Pill, Ring, Stage } from "../../components/ui";
import { fx } from "../../lib/fx";
import { picksOf, stepsKey } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import { COOK_XP } from "../../lib/xp";

// Step 5 of a meal: cook together, one step at a time. Steps that mention minutes get a timer.
// The fixes you picked are real steps here, worked in by Pal's sous chef, tagged "Pal's tip".
const minutesIn = (step: string) => {
  const m = step.match(/(\d+)(?:\s*(?:to|or|–|-)\s*(\d+))?\s*(?:min|minute)/i);
  return m ? Number(m[2] ?? m[1]) : 0;
};

export default function Cook() {
  const t = useTheme();
  const s = useStore();
  const meal = s.meal;
  const [i, setI] = useState(0);
  const [left, setLeft] = useState<number | null>(null); // timer seconds left, null = not running

  useEffect(() => setLeft(null), [i]);
  useEffect(() => s.prepareSteps(), [meal?.id]);
  useEffect(() => {
    if (left === null) return;
    if (left <= 0) { fx.ready(); return; }
    const id = setTimeout(() => setLeft((x) => (x === null ? null : x - 1)), 1000);
    return () => clearTimeout(id);
  }, [left]);

  if (!meal) return <NoMeal />;
  const picks = picksOf(meal);
  // With picks, wait for the steps they belong in (a few seconds). Without, the recipe's own steps.
  const steps = !picks.length ? meal.recipe.steps.map((text) => ({ text, pal: false }))
    : meal.cookSteps?.key === stepsKey(meal) ? meal.cookSteps.steps : null;
  if (!steps) {
    return (
      <Stage mood="fit" say="Working your picks into the steps…" step={[5, 6]} palSize={120} cta={<Button title="Next step" disabled onPress={() => {}} />}>
        <Card><Text style={[type.caption, { color: t.sub }]}>{picks.map((p) => p.title).join(" · ")}</Text></Card>
      </Stage>
    );
  }
  const at = Math.min(i, steps.length - 1);
  const last = at === steps.length - 1;
  const mins = minutesIn(steps[at].text);
  const swaps = meal.swaps.filter((x) => x.kcal_saved !== 0 || x.to !== x.from);

  function done() {
    const res = s.cookMeal();
    if (res?.leveledUp) fx.levelUp();
    else fx.done();
    router.replace("/meal/eat");
  }

  const say = left === 0 ? "Ding! Time's up." : i === 0 ? "Apron on. Let's cook!" : last ? "Last step! Smells amazing." : "Nice. Next one.";

  return (
    <Stage
      mood={left === 0 || last ? "cheer" : "cheeky"}
      say={say}
      step={[5, 6]}
      palSize={120}
      cta={
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {i > 0 ? <Button title="Back" kind="secondary" onPress={() => setI(i - 1)} style={{ flex: 1 }} /> : null}
          {last
            ? <Button title="Done cooking" feel="own" onPress={done} style={{ flex: 2 }} />
            : <Button title="Next step" onPress={() => setI(i + 1)} style={{ flex: 2 }} />}
        </View>
      }
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[type.label, { color: t.sub }]}>Step {at + 1} of {steps.length}</Text>
        <Pill text={`+${COOK_XP} XP when done`} color={brand.reward} />
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {steps.map((_, k) => <View key={k} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: k < at ? brand.mint : k === at ? t.tint : t.cardAlt }} />)}
      </View>
      <Card style={{ minHeight: 120, justifyContent: "center" }}>
        {steps[at].pal ? <Text style={[type.label, { color: t.tint }]}>Pal's tip · for your pick</Text> : null}
        <Text style={[type.title, { color: t.text }]}>{steps[at].text}</Text>
      </Card>
      {mins > 0 ? (
        <Card style={{ alignItems: "center" }}>
          <Ring value={left === null ? 0 : mins * 60 - left} target={mins * 60} size={120}>
            <Text style={[type.bigNumber, { color: t.text }]}>
              {left === null ? `${mins}:00` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
            </Text>
          </Ring>
          <Button title={left === null ? `Start ${mins} min timer` : left === 0 ? "Restart timer" : "Stop timer"} kind="secondary" onPress={() => setLeft(left === null || left === 0 ? mins * 60 : null)} style={{ alignSelf: "stretch" }} />
        </Card>
      ) : null}
      {i === 0 && swaps.length ? (
        <Text style={[type.caption, { color: t.sub, textAlign: "center" }]}>My swaps: {swaps.map((x) => `${x.to} for ${x.from}`).join(", ")}.</Text>
      ) : null}
    </Stage>
  );
}
