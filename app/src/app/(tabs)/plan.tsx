import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Pal } from "../../components/Pal";
import { Button, Card, Screen, Title } from "../../components/ui";
import { fx } from "../../lib/fx";
import type { PalState } from "../../lib/mood";
import { useStore } from "../../lib/store";
import { brand, radius, space, type, useTheme } from "../../lib/theme";
import type { PlanSlot } from "../../lib/types";
import { usePal } from "../../lib/usePal";
import { EAT_XP, localDay } from "../../lib/xp";

const KIND_LABEL = { cook: "Cook", leftovers: "Leftovers", simple: "Easy meal" } as const;

function dayTitle(date: string): string {
  const today = localDay(new Date().toISOString());
  const [y, m, d] = date.split("-").map(Number);
  return date === today ? "Today" : new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function PlanScreen() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (!cheer) return;
    const id = setTimeout(() => setCheer(false), 2200);
    return () => clearTimeout(id);
  }, [cheer]);

  const plan = s.plan;
  if (!plan) {
    return (
      <Screen>
        <Title>No plan yet</Title>
        <View style={{ alignItems: "center", paddingVertical: space.xl }}>
          <Pal state="listening" size={160} body={pal.body} level={pal.level} />
        </View>
        <Button title={s.recipe ? "Plan our recipe" : "Here's a recipe, Pal"} onPress={() => router.push(s.recipe ? "/recipe" : "/add")} />
      </Screen>
    );
  }

  const state: PalState = cheer ? "excited" : pal.slow ? "slow" : "helping";
  const days = [...new Set(plan.slots.map((x) => x.day))].sort((a, b) => a - b);

  function onAte(slot: PlanSlot) {
    const res = s.eatSlot(slot.id);
    if (!res) return;
    if (res.leveledUp) fx.levelUp();
    else fx.done();
    setCheer(true);
  }

  function onCook() {
    s.openRecipe(plan!.recipe);
    router.push("/recipe");
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Title>Our plan</Title>
        </View>
        <Pal state={state} size={96} body={pal.body} level={pal.level} energy={pal.mood.energy} />
      </View>

      {days.map((d) => {
        const slots = plan.slots.filter((x) => x.day === d);
        return (
          <View key={d} style={{ gap: space.sm }}>
            <Text style={[type.label, { color: t.sub }]}>{dayTitle(slots[0].date)}</Text>
            {slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onAte={() => onAte(slot)} onCook={onCook} />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

function SlotCard({ slot, onAte, onCook }: { slot: PlanSlot; onAte: () => void; onCook: () => void }) {
  const t = useTheme();
  const pop = useSharedValue(1);
  const xp = useSharedValue(0);
  const card = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const float = useAnimatedStyle(() => ({ opacity: xp.value === 0 ? 0 : 1 - Math.max(0, xp.value - 0.6) / 0.4, transform: [{ translateY: -40 * xp.value }] }));
  const color = slot.kind === "cook" ? brand.orange : slot.kind === "leftovers" ? brand.blue : brand.mint;
  const open = slot.status === "planned";

  function ate() {
    pop.value = withSequence(withTiming(0.94, { duration: 80 }), withSpring(1, { damping: 6, stiffness: 220 }));
    xp.value = 0.01;
    xp.value = withDelay(60, withTiming(1, { duration: 1100 }));
    onAte();
  }

  return (
    <Animated.View style={card}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[type.label, { color }]}>
            {slot.slot} · {KIND_LABEL[slot.kind]}
          </Text>
          {slot.status === "eaten" && <Text style={{ color: t.ok, fontWeight: "800" }}>✓ Eaten</Text>}
        </View>
        <Text style={[type.body, { color: t.text, fontWeight: "600" }]}>{slot.meal}</Text>
        {(open || slot.kind === "cook") && (
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            {slot.kind === "cook" && <Button title="Cook with me" onPress={onCook} style={{ flex: 1 }} />}
            {open && <Button title="I ate this" kind="success" feel="own" onPress={ate} style={{ flex: 1 }} />}
          </View>
        )}
      </Card>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", right: space.lg, bottom: space.lg, backgroundColor: t.ok, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }, float]}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>+{EAT_XP} XP</Text>
      </Animated.View>
    </Animated.View>
  );
}
