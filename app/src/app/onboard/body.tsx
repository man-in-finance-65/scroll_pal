import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Field, Stage } from "../../components/ui";
import { mealTarget } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { space, type, useTheme } from "../../lib/theme";

// Step 4: height, weight, target. Pal needs them to size every meal to your goal. Stays on the phone.
const START_TARGET = { cut: 70, maintain: 75, bulk: 80 } as const;
const parse = (v: string) => Number(v.replace(",", "."));

export default function BodyStep() {
  const t = useTheme();
  const s = useStore();
  const [height, setHeight] = useState(String(s.body?.heightCm ?? 170));
  const [weight, setWeight] = useState(String(s.body?.weightKg ?? 75));
  const [target, setTarget] = useState(String(s.body?.targetKg ?? START_TARGET[s.goal]));

  const body = { heightCm: parse(height), weightKg: parse(weight), targetKg: parse(target) };
  const ok = body.heightCm >= 100 && body.heightCm <= 250 && body.weightKg >= 30 && body.weightKg <= 300 && body.targetKg >= 30 && body.targetKg <= 300;
  const aim = ok ? mealTarget(body, s.goal) : null;

  function save() {
    if (!ok) return;
    s.setBody(body);
    s.finishOnboarding();
    // Onboarding is done for good: clear it from history so Back never returns to it.
    router.dismissAll();
    router.replace("/meal/feed");
  }

  const row = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: t.sub }]}>{label}</Text>
      <Field value={value} onChangeText={set} keyboardType="decimal-pad" action={unit} maxLength={5} selectTextOnFocus />
    </View>
  );

  return (
    <Stage mood="fit" say="Now your numbers, so I can size every meal. Only I see them." step={[4, 4]} palSize={130} cta={<Button title="Size my meals" disabled={!ok} onPress={save} />}>
      {row("Height", height, setHeight, "cm")}
      {row("Weight now", weight, setWeight, "kg")}
      {row("Target weight", target, setTarget, "kg")}
      {aim ? (
        <Card>
          <Text style={[type.label, { color: t.tint }]}>Your meal target</Text>
          <Text style={[type.bigNumber, { color: t.text }]}>~{aim.perMeal} <Text style={[type.body, { color: t.sub }]}>kcal per meal</Text></Text>
          <Text style={[type.caption, { color: t.sub }]}>{aim.math}</Text>
        </Card>
      ) : (
        <Text style={[type.caption, { color: t.danger, textAlign: "center" }]}>Those numbers look off. Check them for me?</Text>
      )}
      <View style={{ height: space.sm }} />
    </Stage>
  );
}
