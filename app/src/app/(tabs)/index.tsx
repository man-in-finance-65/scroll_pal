import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { Pal } from "../../components/Pal";
import { Bar, Bubble, Card, Pill, Ring, Screen } from "../../components/ui";
import { fx } from "../../lib/fx";
import { useStore } from "../../lib/store";
import { brand, radius, space, type, useTheme } from "../../lib/theme";
import type { MealStage } from "../../lib/types";
import { usePal } from "../../lib/usePal";
import { COOK_XP, EAT_XP, nextLevelHint, SHARE_XP, xpMath } from "../../lib/xp";

// Home: Pal, and the three things Pal wants from you. Everything else is one tab away.
const IN_PROGRESS: Partial<Record<MealStage, string>> = { swaps: "/meal/swaps", pantry: "/meal/pantry", shop: "/meal/shop", wait: "/meal/wait", cook: "/meal/cook" };

export default function Home() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const [poke, setPoke] = useState(false);
  useEffect(() => {
    if (!poke) return;
    const id = setTimeout(() => setPoke(false), 1600);
    return () => clearTimeout(id);
  }, [poke]);
  const p = s.progress;
  // On short phones Pal shrinks so all three actions fit without scrolling.
  const palSize = useWindowDimensions().height < 700 ? 120 : 190;

  // Cook: carry on the meal you started, else the next planned cook, else pick a recipe, else feed Pal first.
  const resume = s.meal && IN_PROGRESS[s.meal.stage];
  const nextSlot = s.plan?.slots.find((x) => x.status === "planned" && x.recipeTitle);
  const nextRecipe = nextSlot && s.recipes.find((r) => r.title === nextSlot.recipeTitle);
  const cookSub = resume ? `Carry on: ${s.meal!.recipe.title}` : nextRecipe ? `Next up: ${nextRecipe.title}` : s.recipes.length ? "Pick one you fed me" : "Feed me a link first";
  function cook() {
    if (resume) return router.push(resume as never);
    if (nextRecipe) {
      s.startMeal(nextRecipe, nextSlot!.id);
      return router.push("/meal/swaps");
    }
    router.push(s.recipes.length ? "/meal/pick" : "/meal/feed");
  }

  const ready = s.meal?.stage === "eat" ? s.meal : null;

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[type.title, { color: t.text }]}>{s.name ? `Hey, ${s.name}` : "Hey"}</Text>
        <Pill text={`Lv.${p.level}`} color={brand.violet} />
      </View>

      <View style={{ alignItems: "center", gap: space.sm }}>
        <Pressable onPress={() => { fx.tap(); setPoke(true); }} accessibilityRole="button" accessibilityLabel="Poke Pal">
          <Pal mood={poke ? "cheer" : pal.mood.pal} size={palSize} />
        </Pressable>
        <Bubble>{poke ? "Hehe. That tickles." : pal.mood.line}</Bubble>
      </View>

      <Action icon="🔗" title="Feed me a link" sub="A food video or recipe" xp={SHARE_XP} onPress={() => router.push("/meal/feed")} />
      <Action icon="🍳" title="Cook with me" sub={cookSub} xp={COOK_XP} hot={!!resume || !!nextRecipe} onPress={cook} />
      <Action icon="🍽️" title="Let's eat" sub={ready ? `${ready.recipe.title} is ready` : "Log any meal"} xp={EAT_XP} hot={!!ready} onPress={() => router.push(ready ? "/meal/eat" : "/meal/eat?log=1")} />

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={[type.label, { color: brand.violet }]}>Level {p.level}</Text>
          <Text style={[type.caption, { color: t.sub }]}>{p.xpIntoLevel} / {p.xpForNext} XP</Text>
        </View>
        <Bar value={p.xpIntoLevel} max={p.xpForNext} />
        <Text style={[type.caption, { color: t.sub }]}>{xpMath(p)}</Text>
        <Text style={[type.caption, { color: t.text, fontWeight: "600" }]}>{nextLevelHint(p)}</Text>
      </Card>

      <Pressable onPress={() => { fx.tap(); router.navigate("/plan"); }} accessibilityRole="button">
        <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Ring value={pal.weekCooks} target={pal.target} size={84} stroke={10}>
            <Text style={{ color: t.text, fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{pal.weekCooks}/{pal.target}</Text>
          </Ring>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.label, { color: brand.mint }]}>Cooks this week</Text>
            <Text style={[type.body, { color: t.text }]}>{pal.weekCooks} of {pal.target} {s.plan ? "in our pact" : "(make a pact on Plan)"}</Text>
          </View>
        </Card>
      </Pressable>
    </Screen>
  );
}

// One of the three default actions. "hot" = something is waiting, so it gets the violet edge.
function Action({ icon, title, sub, xp, hot, onPress }: { icon: string; title: string; sub: string; xp: number; hot?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={() => { fx.primary(); onPress(); }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 76, borderRadius: radius.md, backgroundColor: t.card, borderWidth: 2, borderColor: hot ? t.tint : "transparent", transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: t.cardAlt, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.h2, { color: t.text }]}>{title}</Text>
        <Text numberOfLines={1} style={[type.caption, { color: hot ? t.tint : t.sub }]}>{sub}</Text>
      </View>
      <Pill text={`+${xp} XP`} color={brand.reward} />
    </Pressable>
  );
}
