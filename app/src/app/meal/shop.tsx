import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { Button, Card, NoMeal, Row, Stage } from "../../components/ui";
import { est, qtyText } from "../../lib/format";
import { fx } from "../../lib/fx";
import { shopName, swappedIngredients } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { brand, type, useTheme } from "../../lib/theme";
import { doordashOrdersUrl, doordashSearchUrl, openDoordash } from "../../lib/doordash";

// Step 4 of a meal: get the missing ingredients on DoorDash. One tap per item opens it in the DoorDash app,
// you add it to your cart there, and Pal ticks it off. You check out on DoorDash's side; Pal never sees that login.
export default function Shop() {
  const t = useTheme();
  const s = useStore();
  const meal = s.meal;
  const [found, setFound] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  if (!meal) return <NoMeal />;

  const names = swappedIngredients(meal.recipe, meal.swaps);
  const have = new Set(meal.have);
  const missing = meal.recipe.ingredients.map((ing, i) => ({ ...ing, name: names[i], swapped: names[i] !== ing.name })).filter((i) => !have.has(i.name));
  const next = missing.find((i) => !found.includes(i.name));

  async function find(name: string) {
    setError(null);
    try {
      await openDoordash(doordashSearchUrl(shopName(name)));
      setFound((f) => (f.includes(name) ? f : [...f, name]));
    } catch (e) {
      fx.error();
      setError((e as Error).message);
    }
  }

  function done() {
    if (found.length) s.setOrderUrl(doordashOrdersUrl()); // so the wait screen can check on the order
    s.setStage("wait");
    router.push("/meal/wait");
  }

  const say = error ?? (
    !found.length ? (have.size ? `We have ${have.size}! Just need ${missing.length} more. Let's grab them on DoorDash.` : `We need ${missing.length} things. Let's grab them on DoorDash.`)
    : next ? `${found.length} of ${missing.length} in the cart. Next up: ${shopName(next.name)}.`
    : "All in the cart! Check out in DoorDash, then come back."
  );

  return (
    <Stage
      mood={error ? "worried" : next ? "cheeky" : "cheer"}
      say={say}
      step={[4, 6]}
      palSize={130}
      cta={
        <>
          {next
            ? <Button title={`Find ${shopName(next.name)} on DoorDash`} icon="🛒" onPress={() => find(next.name)} />
            : <Button title="I checked out" onPress={done} />}
          <Button title={found.length ? "Skip the rest" : "I'll shop myself"} kind="ghost" onPress={done} />
        </>
      }
    >
      <Card>
        {missing.map((i, k) => {
          const got = found.includes(i.name);
          return (
            <Pressable key={i.name + k} onPress={() => { fx.tap(); find(i.name); }} accessibilityRole="link" accessibilityLabel={`Find ${i.name} on DoorDash`}>
              <Row first={k === 0} left={`${got ? "✓ " : ""}${i.name}`} color={got ? brand.mint : undefined} right={i.swapped ? "" : `${est(i.source)}${qtyText(i.qty, i.unit)}`} />
            </Pressable>
          );
        })}
      </Card>
      <Text style={[type.caption, { color: t.faint, textAlign: "center" }]}>Tap any item to find it in the DoorDash app.</Text>
    </Stage>
  );
}
