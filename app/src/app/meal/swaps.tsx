import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, NoMeal, Stage } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { est, num } from "../../lib/format";
import { kcalAfterSwaps, mealTarget } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";

// Step 2 of a meal: Pal tunes the recipe to your goal with a few ingredient swaps, and shows the maths.
export default function Swaps() {
  const t = useTheme();
  const s = useStore();
  const meal = s.meal;
  const [loading, setLoading] = useState(!!meal && meal.swaps.length === 0);
  const [error, setError] = useState<string | null>(null);
  const aim = mealTarget(s.body, s.goal);

  useEffect(() => {
    if (!meal || meal.swaps.length) return;
    api.swaps(meal.recipe, s.goal, aim?.perMeal ?? null).then(
      (r) => { s.setSwaps(r.swaps); setLoading(false); },
      (e: ApiError) => { setError(e.message); setLoading(false); },
    );
  }, [meal?.id]);

  if (!meal) return <NoMeal />;
  const r = meal.recipe;
  const m = r.macros_per_serving;
  const after = kcalAfterSwaps(r, meal.swaps);
  const saved = m.kcal - after;
  const say = loading ? "Tuning it to your goal…"
    : error ? error
    : meal.swaps.length ? `I tuned ${r.title} to your goal.`
    : `${r.title} already fits you. No swaps needed.`;

  return (
    <Stage
      mood={loading ? "fit" : error ? "worried" : "cheer"}
      say={say}
      step={[2, 6]}
      palSize={130}
      cta={<Button title="Check my pantry" disabled={loading} onPress={() => { s.setStage("pantry"); router.push("/meal/pantry"); }} />}
    >
      {!loading && (
        <>
          <Card>
            <Text style={[type.label, { color: brand.orange }]}>Per serving</Text>
            <View style={{ flexDirection: "row", gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: t.faint }]}>The video</Text>
                <Text style={[type.bigNumber, { color: t.sub }]}>{est(m.source)}{num(m.kcal, 0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: brand.mint }]}>My version</Text>
                <Text style={[type.bigNumber, { color: brand.mint }]}>~{num(after, 0)}</Text>
              </View>
            </View>
            <Text style={[type.caption, { color: t.sub }]}>
              {meal.swaps.length ? `${num(m.kcal, 0)} kcal ${saved >= 0 ? "minus" : "plus"} ${num(Math.abs(saved), 0)} from swaps = ${num(after, 0)} kcal` : `${num(m.kcal, 0)} kcal, ${num(m.protein_g)} g protein`}
              {aim ? `. Your target: ~${aim.perMeal} per meal.` : ""}
            </Text>
          </Card>
          {meal.swaps.map((sw) => (
            <Card key={sw.from}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                <Text style={[type.caption, { color: t.faint, flex: 1 }]} numberOfLines={1}>{sw.from}</Text>
                <Text style={[type.caption, { color: sw.kcal_saved >= 0 ? brand.mint : brand.orange, fontWeight: "700" }]}>
                  {sw.kcal_saved === 0 ? "same energy" : `${est(sw.source)}${num(Math.abs(sw.kcal_saved), 0)} kcal ${sw.kcal_saved > 0 ? "lighter" : "more"}`}
                </Text>
              </View>
              <Text style={[type.h2, { color: t.text }]}>→ {sw.to}</Text>
              <Text style={[type.caption, { color: t.sub }]}>{sw.why}</Text>
            </Card>
          ))}
        </>
      )}
    </Stage>
  );
}
