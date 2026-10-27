import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { PalMood } from "../../components/Pal";
import { Button, Card, Choice, NoMeal, Row, Stage } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { est, num, plain } from "../../lib/format";
import { fitFor, fixMath, mealTarget } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import type { Recommendation } from "../../lib/types";

// Step 2 of a meal: Pal tunes the recipe to your goal with a few ingredient swaps, then tells you the truth about
// whether it fits. The verdict comes from plain rules on the numbers (lib/goals.ts), never from the AI.
export default function Swaps() {
  const t = useTheme();
  const s = useStore();
  const meal = s.meal;
  const [loading, setLoading] = useState(!!meal && meal.swaps.length === 0);
  const [error, setError] = useState<string | null>(null);
  const aim = mealTarget(s.body, s.goal);

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
  const goalWord = { cut: "losing weight", bulk: "building muscle", maintain: "eating healthier" }[s.goal];

  let mood: PalMood;
  let say: string;
  if (loading) { mood = "fit"; say = "Tuning it to your goal…"; }
  else if (fit.level === "good") {
    mood = "cheer";
    say = meal.swaps.length ? `I tuned ${r.title}. Now it fits our goal!` : `${r.title} already fits our goal. Let's cook it!`;
  } else if (fit.level === "close") {
    mood = "cheeky";
    say = `Close! One thing is off. ${fit.misses[0]}. Here's what I'd do.`;
  } else {
    mood = "worried";
    say = `Honest talk: ${r.title} works against ${goalWord}. ${
      fit.target !== null && fit.over > 0 ? `That's ~${num(fit.kcal, 0)} kcal, ${num(fit.over, 0)} over our ${fit.target} per meal.` : fit.misses[0] + "."
    } Here's what I'd do.`;
  }
  if (error && !loading) say = `${error} ${say}`;

  const goPantry = () => { s.setStage("pantry"); router.push("/meal/pantry"); };
  const lighter = () => router.replace("/meal/feed");
  const goOn = meal.tweak ? "Use my pick and check pantry" : "Cook it as a treat";

  return (
    <Stage
      mood={mood}
      say={say}
      step={[2, 6]}
      palSize={130}
      cta={
        loading ? <Button title="Tuning…" disabled onPress={goPantry} />
        : fit.level === "off" ? (
          <>
            <Button title="Find a lighter one" onPress={lighter} />
            <Button title={goOn} kind="ghost" onPress={goPantry} />
          </>
        ) : (
          <>
            <Button title="Check my pantry" onPress={goPantry} />
            {fit.level === "close" ? <Button title="Find a lighter one" kind="ghost" onPress={lighter} /> : null}
          </>
        )
      }
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
                <Text style={[type.caption, { color: fit.level === "off" ? t.danger : brand.mint }]}>My version</Text>
                <Text style={[type.bigNumber, { color: fit.level === "off" ? t.danger : brand.mint }]}>~{num(fit.kcal, 0)}</Text>
              </View>
            </View>
            <Text style={[type.caption, { color: t.sub }]}>
              {meal.swaps.length ? `${num(m.kcal, 0)} kcal ${saved >= 0 ? "minus" : "plus"} ${num(Math.abs(saved), 0)} from swaps = ${num(fit.kcal, 0)} kcal` : `${num(m.kcal, 0)} kcal, ${num(m.protein_g)} g protein`}
              {aim ? `. Your target: ~${aim.perMeal} per meal.` : ""}
            </Text>
            {fit.level === "off" && fit.halfFits ? (
              <Text style={[type.caption, { color: brand.mint, fontWeight: "700" }]}>
                Half a serving is ~{num(fit.kcal / 2, 0)} kcal, and that fits us.
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text style={[type.label, { color: t.sub }]}>How it fits our goal · {fit.verdict.passed} of {fit.verdict.total}</Text>
            {fit.verdict.rows.map((row, k) => (
              <Row key={row.label} first={k === 0} left={`${row.pass ? "✓" : "✗"} ${row.label}`} sub={row.math} color={row.pass ? brand.mint : t.danger} />
            ))}
            {fit.verdict.estimated ? <Text style={[type.caption, { color: t.faint }]}>~ means I estimated the numbers.</Text> : null}
          </Card>

          {needsRecs ? (
            <>
              <Text style={[type.label, { color: t.tint }]}>What I'd do · tap one to use it</Text>
              {recs?.id !== meal.id ? <Text style={[type.caption, { color: t.sub }]}>Thinking of ideas…</Text> : null}
              {recs?.id === meal.id && recs.list.length === 0 ? <Text style={[type.caption, { color: t.sub }]}>I couldn't think of ideas just now. Pick a lighter recipe, or cook it as a treat.</Text> : null}
              {recs?.id === meal.id ? recs.list.map((x) => (
                <Choice
                  key={x.title}
                  icon={x.kind === "side" ? "🥣" : x.kind === "recipe" ? "🍳" : undefined}
                  title={x.title}
                  sub={[
                    x.kind ? (x.kind === "side" ? "On the side. " : "In the dish. ") + x.how : x.how,
                    fixMath(x, r, fit.kcal) ?? (x.kcal !== null ? `That is ${est(x.source)}${num(x.kcal, 0)} kcal.` : ""),
                  ].filter(Boolean).join("\n")}
                  selected={meal.tweak?.title === x.title}
                  onPress={() => s.setTweak(meal.tweak?.title === x.title ? undefined : x)}
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
        </>
      )}
    </Stage>
  );
}
