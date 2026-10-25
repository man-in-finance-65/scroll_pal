import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Choice, NumberCard, Stage } from "../../components/ui";
import { est, num } from "../../lib/format";
import { fx } from "../../lib/fx";
import { fitFor } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import { EAT_XP } from "../../lib/xp";

// Action 3, eat the meal. Right after cooking it's the meal you made; from Home with nothing cooked,
// you log any meal (one of your recipes or something else). Either way Pal reacts and you get +25 XP.
const GROW = { cut: "I feel lighter already.", bulk: "I feel stronger already.", maintain: "I feel brighter already." } as const;

export default function Eat() {
  const t = useTheme();
  const s = useStore();
  const { log } = useLocalSearchParams<{ log?: string }>();
  const pending = !log && s.meal?.stage === "eat" ? s.meal : null;
  const [pick, setPick] = useState<string | null>(null);
  const [eaten, setEaten] = useState(false);
  const options = [...s.recipes.slice(0, 4).map((r) => r.title), "Something else"];

  function eat() {
    const up = s.eatMeal(pending ? undefined : pick ?? undefined);
    if (up) fx.levelUp();
    else fx.done();
    setEaten(true);
  }

  if (eaten) {
    // Pal is honest: a meal that didn't fit the goal is a treat, not a step toward it. The XP still counts.
    const m = !log ? s.meal : null;
    const treat = m ? fitFor(m.recipe, m.swaps, s.goal, s.body).level === "off" : false;
    return (
      <Stage
        mood={treat ? "chubby" : "cheer"}
        say={treat ? `Mmm, a treat! Tomorrow we go lighter. +${EAT_XP} XP` : `Mmm. ${GROW[s.goal]} +${EAT_XP} XP`}
        back={false}
        palSize={200}
        cta={<Button title="Back home" onPress={() => router.dismissTo("/")} />}
      />
    );
  }

  if (pending) {
    const r = pending.recipe;
    const m = r.macros_per_serving;
    const kcal = fitFor(r, pending.swaps, s.goal, s.body).kcal;
    return (
      <Stage mood="cheer" say="We cooked it! Plate it up and tell me when it's in your belly." step={[6, 6]} back={false} palSize={150} cta={<Button title="I ate it" feel="own" onPress={eat} />}>
        <Card>
          <Text style={[type.h2, { color: t.text }]}>{r.title}</Text>
          <Text style={[type.caption, { color: t.sub }]}>{r.creator} · {r.cuisine}</Text>
        </Card>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <NumberCard label="Energy" value={`~${num(kcal, 0)}`} unit="kcal" color={brand.orange} math="per serving, after swaps" />
          <NumberCard label="Protein" value={`${est(m.source)}${num(m.protein_g)}`} unit="g" color={brand.pink} math="per serving" />
        </View>
      </Stage>
    );
  }

  return (
    <Stage mood="cheeky" say="What did we eat? Tell me and I'll grow." cta={<Button title="I ate it" feel="own" disabled={!pick} onPress={eat} />}>
      <View style={{ gap: space.sm }}>
        {options.map((o) => <Choice key={o} title={o} selected={pick === o} onPress={() => setPick(o)} />)}
      </View>
      <Text style={[type.caption, { color: t.faint, textAlign: "center" }]}>+{EAT_XP} XP per meal, up to 3 a day.</Text>
    </Stage>
  );
}
