import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PalMood } from "../../components/Pal";
import { Button, Card, Choice, NoMeal, Row, Stage } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { est, num, plain } from "../../lib/format";
import type { CheckRow } from "../../lib/goals";
import { fitFor, mealTarget } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import type { Recommendation } from "../../lib/types";

// Step 2 of a meal: Pal tunes the recipe to your goal with a few ingredient swaps. If it fits, it says so. If not, it goes
// straight to the fixes (pick any). The why, recipe vs your target, sits under "Details".
// The verdict comes from plain rules on the numbers (lib/goals.ts), never from the AI.
export default function Swaps() {
  const t = useTheme();
  const s = useStore();
  const meal = s.meal;
  const [loading, setLoading] = useState(!!meal && meal.swaps.length === 0);
  const [error, setError] = useState<string | null>(null);
  const aim = mealTarget(s.body, s.goal);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!meal || meal.swaps.length) return;
    api.swaps(meal.recipe, s.goal, aim?.perMeal ?? null, s.diet).then(
      (r) => { s.setSwaps(r.swaps); setLoading(false); },
      (e: ApiError) => { setError(e.message); setLoading(false); },
    );
  }, [meal?.id]);

  // Not a fit: Pal recommends what to do about it. Asked once per dish, after the swaps are in.
  const [recs, setRecs] = useState<{ id: string; list: Recommendation[] } | null>(null);
  const fitNow = meal ? fitFor(meal.recipe, meal.swaps, s.goal, s.body) : null;
  const needsRecs = !!meal && !loading && fitNow!.level !== "good";
  useEffect(() => {
    if (!needsRecs || !meal || recs?.id === meal.id) return;
    api.recommend(meal.recipe, s.goal, aim?.perMeal ?? null, fitNow!.kcal, fitNow!.verdict.rows, s.diet).then(
      (r) => setRecs({ id: meal.id, list: r.recommendations.map((x) => ({ ...x, title: plain(x.title), how: plain(x.how) })) }),
      () => setRecs({ id: meal.id, list: [] }),
    );
  }, [needsRecs, meal?.id]);

  if (!meal) return <NoMeal />;
  const r = meal.recipe;
  const m = r.macros_per_serving;
  const fit = fitFor(r, meal.swaps, s.goal, s.body);
  const saved = m.kcal - fit.kcal;
  const picks = meal.tweaks ?? [];
  const picked = (x: Recommendation) => picks.some((p) => p.title === x.title);
  const toggle = (x: Recommendation) => s.setTweaks(picked(x) ? picks.filter((p) => p.title !== x.title) : [...picks, x]);

  let mood: PalMood;
  let say: string;
  if (loading) { mood = "fit"; say = "Tuning it to your goal…"; }
  else if (fit.level === "good") {
    mood = "cheer";
    say = meal.swaps.length ? `I tuned ${r.title}. Now it fits our goal!` : `${r.title} already fits our goal. Let's cook it!`;
  } else {
    mood = fit.level === "close" ? "cheeky" : "worried";
    say = "Here's how I'd make it fit. Pick any you like.";
  }
  if (error && !loading) say = `${error} ${say}`;

  const goPantry = () => { s.setStage("pantry"); router.push("/meal/pantry"); };
  const addToPlan = () => { s.addMealToPlan(); router.replace("/plan"); };

  return (
    <Stage
      mood={mood}
      say={say}
      step={[2, 6]}
      palSize={130}
      cta={
        loading ? <Button title="Tuning…" disabled onPress={goPantry} />
        : meal.slotId ? <Button title="Cook now" onPress={goPantry} />
        : (
          <>
            <Button title="Add to meal plan" onPress={addToPlan} />
            <Button title="Cook now" kind="ghost" onPress={goPantry} />
          </>
        )
      }
    >
      {!loading && (
        <>
          {needsRecs ? (
            <>
              <Text style={[type.label, { color: t.tint }]}>What to do · pick any</Text>
              {recs?.id !== meal.id ? <Text style={[type.caption, { color: t.sub }]}>Thinking of fixes…</Text> : null}
              {recs?.id === meal.id && recs.list.length === 0 ? <Text style={[type.caption, { color: t.sub }]}>I couldn't think of fixes just now. You can still cook it as it is.</Text> : null}
              {recs?.id === meal.id ? recs.list.map((x) => (
                <Choice
                  key={x.title}
                  icon={x.kind === "side" ? "🥣" : x.kind === "recipe" ? "🍳" : undefined}
                  title={x.title}
                  sub={gain(x) || undefined}
                  selected={picked(x)}
                  onPress={() => toggle(x)}
                />
              )) : null}
            </>
          ) : null}

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

          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ paddingVertical: space.sm }}>
            <Text style={[type.label, { color: t.sub }]}>Details {open ? "▴" : "▾"}</Text>
          </Pressable>
          {open ? (
            <Card>
              <Text style={[type.caption, { color: t.sub }]}>
                Per serving: {meal.swaps.length ? `${num(m.kcal, 0)} kcal ${saved >= 0 ? "minus" : "plus"} ${num(Math.abs(saved), 0)} from swaps = ${num(fit.kcal, 0)} kcal` : `${est(m.source)}${num(m.kcal, 0)} kcal, ${est(m.source)}${num(m.protein_g)} g protein`}
                {aim ? `. Your target: ~${aim.perMeal} per meal.` : "."}
              </Text>
              {fit.level === "off" && fit.halfFits ? (
                <Text style={[type.caption, { color: brand.mint, fontWeight: "700" }]}>Half a serving is ~{num(fit.kcal / 2, 0)} kcal, and that fits us.</Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: space.sm, paddingTop: space.sm }}>
                <Text style={[type.caption, { color: t.faint, flex: 1.1 }]}> </Text>
                <Text style={[type.caption, { color: t.faint, flex: 1 }]}>Recipe</Text>
                <Text style={[type.caption, { color: t.faint, flex: 1.2 }]}>Your target</Text>
              </View>
              {fit.verdict.rows.map((row) => {
                const c = row.pass ? brand.mint : t.danger;
                return (
                  <View key={row.id} style={{ flexDirection: "row", gap: space.sm, paddingVertical: 8, borderTopWidth: 1, borderColor: t.line }}>
                    <Text style={[type.body, { color: t.text, flex: 1.1 }]}>{row.label}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { color: c, fontWeight: "800" }]}>{row.pass ? "✓" : "✗"}</Text>
                      <Text style={[type.caption, { color: c }]}>{fit.verdict.estimated && row.id !== "time" ? "~" : ""}{amount(row, row.value)}</Text>
                    </View>
                    <View style={{ flex: 1.2 }}>
                      <Text style={[type.caption, { color: row.pass ? brand.mint : t.sub }]}>{bound(row)}</Text>
                      {row.pass ? null : <Text style={[type.caption, { color: t.danger, fontWeight: "700" }]}>{short(row)}</Text>}
                    </View>
                  </View>
                );
              })}
              {fit.verdict.estimated ? <Text style={[type.caption, { color: t.faint }]}>~ means I estimated the numbers.</Text> : null}
            </Card>
          ) : null}
        </>
      )}
    </Stage>
  );
}

// The unit each goal check is measured in.
const UNIT: Record<string, string> = { kcal: "kcal", target: "kcal", protein: "g", fat: "g", carbs: "g", density: "g per 100 kcal", time: "min" };
const whole = (id: string) => id === "kcal" || id === "target" || id === "time";
const amount = (row: CheckRow, v: number) => `${num(v, whole(row.id) ? 0 : 1)} ${UNIT[row.id] ?? ""}`.trim();
const bound = (row: CheckRow) =>
  row.lo !== null && row.hi !== null ? `${row.lo} to ${amount(row, row.hi)}` : row.lo !== null ? `at least ${amount(row, row.lo)}` : `at most ${amount(row, row.hi ?? 0)}`;
// How far a miss is from its target: "add 21 g" or "cut 2 g".
const short = (row: CheckRow) =>
  row.lo !== null && row.value < row.lo ? `add ${amount(row, row.lo - row.value)}` : row.hi !== null && row.value > row.hi ? `cut ${amount(row, row.value - row.hi)}` : "";

// What a fix does, in one line: "adds ~24 g protein", "cuts ~120 kcal".
function gain(x: Recommendation): string {
  const a = x.adds;
  if (!a) return x.how;
  const n = (v: number, unit: string, d = 1) => `${v < 0 ? "cuts" : "adds"} ~${num(Math.abs(v), d)} ${unit}`;
  switch (x.fixes) {
    case "protein": case "density": return n(a.protein_g, "g protein");
    case "fat": return n(a.fat_g, "g fat");
    case "carbs": return n(a.carbs_g, "g carbs");
    case "kcal": case "target": return n(a.kcal, "kcal", 0);
    default: return x.how;
  }
}
