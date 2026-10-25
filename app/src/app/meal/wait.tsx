import { router } from "expo-router";
import { Linking, Text, View } from "react-native";
import { Button, Choice, NoMeal, Stage } from "../../components/ui";
import { swappedIngredients } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { space, type, useTheme } from "../../lib/theme";
import { useState } from "react";

// Between ordering and cooking. Pal keeps you company and gets you to lay out what you already have.
export default function Wait() {
  const t = useTheme();
  const s = useStore();
  const meal = s.meal;
  const [laid, setLaid] = useState<string[]>([]);
  if (!meal) return <NoMeal />;
  const have = swappedIngredients(meal.recipe, meal.swaps).filter((n) => meal.have.includes(n));

  return (
    <Stage
      mood="fit"
      say={meal.orderUrl ? "Walmart is on it. Now we wait. Lay out what we have?" : "Off you go! Lay out what we have while you shop."}
      step={[4, 6]}
      palSize={130}
      cta={
        <>
          <Button title="Groceries are here" onPress={() => { s.setStage("cook"); router.push("/meal/cook"); }} />
          {meal.orderUrl ? <Button title="Open my Walmart cart" kind="ghost" onPress={() => Linking.openURL(meal.orderUrl!).catch(() => {})} /> : null}
        </>
      }
    >
      {have.length ? (
        <>
          <Text style={[type.label, { color: t.sub }]}>Lay these out · {laid.length} of {have.length}</Text>
          <View style={{ gap: space.sm }}>
            {have.map((n) => (
              <Choice key={n} title={n} selected={laid.includes(n)} onPress={() => setLaid((l) => (l.includes(n) ? l.filter((x) => x !== n) : [...l, n]))} />
            ))}
          </View>
        </>
      ) : null}
    </Stage>
  );
}
