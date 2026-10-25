import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, Text } from "react-native";
import { Button, Card, NoMeal, Row, Stage } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { est, qtyText } from "../../lib/format";
import { fx } from "../../lib/fx";
import { shopName, swappedIngredients } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { type, useTheme } from "../../lib/theme";

// Step 4 of a meal: the missing ingredients go to Instacart in one tap. You sign in and pay on Instacart's own page.
export default function Shop() {
  const t = useTheme();
  const s = useStore();
  const meal = s.meal;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!meal) return <NoMeal />;

  const names = swappedIngredients(meal.recipe, meal.swaps);
  const have = new Set(meal.have);
  const missing = meal.recipe.ingredients.map((ing, i) => ({ ...ing, name: names[i], swapped: names[i] !== ing.name })).filter((i) => !have.has(i.name));

  async function order() {
    setBusy(true);
    setError(null);
    try {
      // Swapped items don't carry the video's amount, so Instacart gets just the name for those.
      const items = missing.map((i) => ({ name: shopName(i.name), qty: i.swapped ? null : i.qty, unit: i.swapped ? "" : i.unit }));
      const { url } = await api.instacart(meal!.recipe.title, items);
      s.setOrderUrl(url);
      await Linking.openURL(url);
      s.setStage("wait");
      router.push("/meal/wait");
    } catch (e) {
      fx.error();
      setError((e as ApiError).message ?? "I couldn't open Instacart.");
    } finally {
      setBusy(false);
    }
  }

  const search = (name: string) => Linking.openURL(`https://www.instacart.com/store/s?k=${encodeURIComponent(name)}`).catch(() => {});

  return (
    <Stage
      mood={error ? "worried" : "cheeky"}
      say={error ?? (have.size ? `We have ${have.size}! Just need ${missing.length} more. I'll order them.` : `We need ${missing.length} things. I'll order them.`)}
      step={[4, 6]}
      palSize={130}
      cta={
        <>
          <Button title="Order on Instacart" icon="🛒" loading={busy} onPress={order} />
          <Button title="I'll shop myself" kind="ghost" onPress={() => { s.setStage("wait"); router.push("/meal/wait"); }} />
        </>
      }
    >
      <Card>
        {missing.map((i, k) => (
          <Pressable key={i.name + k} onPress={() => { fx.tap(); search(shopName(i.name)); }} accessibilityRole="link" accessibilityLabel={`Search ${i.name} on Instacart`}>
            <Row first={k === 0} left={i.name} right={i.swapped ? "" : `${est(i.source)}${qtyText(i.qty, i.unit)}`} />
          </Pressable>
        ))}
      </Card>
      <Text style={[type.caption, { color: t.faint, textAlign: "center" }]}>
        Tap an item to search it on Instacart.
      </Text>
    </Stage>
  );
}
