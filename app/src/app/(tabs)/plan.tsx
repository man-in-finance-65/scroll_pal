import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Pal } from "../../components/Pal";
import { Button, Card, NumberCard, Screen, Title } from "../../components/ui";
import { fx } from "../../lib/fx";
import type { PalState } from "../../lib/mood";
import { notifyNow } from "../../lib/notify";
import { useStore } from "../../lib/store";
import { brand, radius, space, type, useTheme } from "../../lib/theme";
import type { PlanSlot } from "../../lib/types";
import { usePal } from "../../lib/usePal";
import { COOK_XP, localDay } from "../../lib/xp";

const KIND_LABEL = { cook: "Cook", leftovers: "Leftovers", simple: "Easy meal" } as const;

function dayTitle(date: string, day: number): string {
  const today = localDay(new Date().toISOString());
  const [y, m, d] = date.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `Day ${day} · ${date === today ? "Today" : label}`;
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
        <Title sub="Open a recipe and tap Plan my meals.">Plan</Title>
        <View style={{ alignItems: "center", paddingVertical: space.xl }}>
          <Pal state="listening" size={160} body={pal.body} level={pal.level} />
        </View>
        <Button title={s.recipe ? "Open your recipe" : "Paste a cooking link"} onPress={() => router.push(s.recipe ? "/recipe" : "/add")} />
      </Screen>
    );
  }

  const cookSlots = plan.slots.filter((x) => x.kind === "cook");
  const done = cookSlots.filter((x) => x.status === "done").length;
  const state: PalState = cheer ? "excited" : pal.slow ? "slow" : "helping";
  const days = [...new Set(plan.slots.map((x) => x.day))].sort((a, b) => a - b);

  async function confirm() {
    const n = s.confirmPlan();
    fx.ready();
    await notifyNow("Cart ready", `${n} items`);
    router.push("/checklist");
  }

  function onDone(slot: PlanSlot) {
    const res = s.completeSlot(slot.id);
    if (!res) return;
    if (res.leveledUp) fx.levelUp();
    else fx.done();
    setCheer(true);
  }

  function onSkip(slot: PlanSlot) {
    fx.skip();
    s.skipSlot(slot.id);
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Title sub={plan.summary}>Your plan</Title>
        </View>
        <Pal state={state} size={96} body={pal.body} level={pal.level} energy={pal.mood.energy} />
      </View>

      <View style={{ flexDirection: "row", gap: space.md }}>
        <NumberCard label="Cooks done" value={`${done}/${cookSlots.length}`} color={brand.mint} math={`${done} × ${COOK_XP} = ${done * COOK_XP} XP earned`} />
        <NumberCard
          label="XP left"
          value={String((cookSlots.length - done) * COOK_XP)}
          color={brand.violet}
          math={`${cookSlots.length - done} cooks × ${COOK_XP}`}
        />
      </View>

      {plan.confirmed ? (
        <Button title="Open grocery checklist" kind="secondary" onPress={() => router.push("/checklist")} />
      ) : (
        <Button title="Confirm plan → grocery checklist" onPress={confirm} />
      )}

      {days.map((d) => {
        const slots = plan.slots.filter((x) => x.day === d);
        return (
          <View key={d} style={{ gap: space.sm }}>
            <Text style={[type.label, { color: t.sub }]}>{dayTitle(slots[0].date, d)}</Text>
            {slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onDone={() => onDone(slot)} onSkip={() => onSkip(slot)} />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

function SlotCard({ slot, onDone, onSkip }: { slot: PlanSlot; onDone: () => void; onSkip: () => void }) {
  const t = useTheme();
  const pop = useSharedValue(1);
  const xp = useSharedValue(0);
  const card = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const float = useAnimatedStyle(() => ({ opacity: xp.value === 0 ? 0 : 1 - Math.max(0, xp.value - 0.6) / 0.4, transform: [{ translateY: -40 * xp.value }] }));
  const color = slot.kind === "cook" ? brand.orange : slot.kind === "leftovers" ? brand.blue : brand.mint;

  function done() {
    pop.value = withSequence(withTiming(0.94, { duration: 80 }), withSpring(1, { damping: 6, stiffness: 220 }));
    xp.value = 0.01;
    xp.value = withDelay(60, withTiming(1, { duration: 1100 }));
    onDone();
  }

  return (
    <Animated.View style={card}>
      <Card style={{ opacity: slot.status === "skipped" ? 0.55 : 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[type.label, { color }]}>
            {slot.slot} · {KIND_LABEL[slot.kind]}
          </Text>
          {slot.status === "done" && <Text style={{ color: t.ok, fontWeight: "800" }}>✓ Done · +{COOK_XP} XP</Text>}
          {slot.status === "skipped" && <Text style={{ color: t.sub, fontWeight: "700" }}>Skipped</Text>}
        </View>
        <Text style={[type.body, { color: t.text, fontWeight: "600" }]}>{slot.meal}</Text>
        {slot.note ? <Text style={[type.caption, { color: t.sub }]}>{slot.note}</Text> : null}
        {slot.kind === "cook" && slot.status === "planned" && (
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            <Button title="Done" kind="success" feel="own" onPress={done} style={{ flex: 2 }} />
            <Button title="Skip" kind="secondary" feel="own" onPress={onSkip} style={{ flex: 1 }} />
          </View>
        )}
      </Card>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", right: space.lg, bottom: space.lg, backgroundColor: t.ok, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }, float]}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>+{COOK_XP} XP</Text>
      </Animated.View>
    </Animated.View>
  );
}
