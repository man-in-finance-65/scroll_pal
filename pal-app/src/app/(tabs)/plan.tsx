import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { dayLabel, slotLabel } from "../../components/PlanPicker";
import { Button, Card, Empty, H1, H2, Note, Sub, s } from "../../components/ui";
import { startCook } from "../../lib/cookSession";
import { trunc1 } from "../../lib/macros";
import { sharedIngredients } from "../../lib/plan";
import { dayKey, dishFrom, useStore, weekDays } from "../../lib/store";
import { colors, fonts } from "../../lib/theme";
import { SLOTS, type Dish, type Slot } from "../../lib/types";

export default function PlanTab() {
  const router = useRouter();
  const store = useStore();
  const days = weekDays();
  const today = dayKey(new Date());
  const targets = store.targets[store.goal];
  const [choosing, setChoosing] = useState<{ day: string; slot: Slot } | null>(null);
  const planned = days.flatMap((d) => SLOTS.map((sl) => store.plan[d]?.[sl]).filter((x): x is Dish => !!x));
  const shared = sharedIngredients(store.plan, days);

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <H1>This week</H1>
      <Sub>Targets for {store.goal.replace("_", " ")}: {targets.calories} kcal and {targets.protein_g} g protein a day (change them on the Sous Chef tab).</Sub>

      {planned.length === 0 && (
        <Empty emoji="📅" title="Nothing planned yet" body="Tap an empty meal below, or open a recipe and tap “Save to Meal Plan”." />
      )}

      {shared.length > 0 && (
        <Card style={{ borderColor: colors.green }}>
          <H2>♻️ Buy once, use twice</H2>
          {shared.map((e) => {
            const units = new Set(e.uses.map((u) => u.unit));
            const sum = units.size === 1 ? ` = ${trunc1(e.uses.reduce((n, u) => n + u.qty, 0))} ${e.uses[0].unit}`.trimEnd() : "";
            return (
              <Note key={e.name}>
                {e.name}: {e.uses.map((u) => `${u.qty} ${u.unit}`.trim() + ` (${u.where})`).join(" + ")}{sum}
              </Note>
            );
          })}
        </Card>
      )}
      {planned.length > 0 && <Button title={`Add this week to the cart (${planned.length} meal${planned.length === 1 ? "" : "s"})`} kind="ghost" onPress={() => { store.addToCart(planned); router.navigate("/pantry"); }} />}

      {days.map((day) => {
        const dishes = SLOTS.map((sl) => store.plan[day]?.[sl]).filter((x): x is Dish => !!x);
        const kcal = dishes.map((d) => d.macros.calories);
        const prot = dishes.map((d) => d.macros.protein_g);
        const sum = (xs: number[]) => trunc1(xs.reduce((a, b) => a + b, 0));
        return (
          <Card key={day} style={day === today ? { borderColor: colors.primary } : undefined}>
            <H2>{dayLabel(day)}{day === today ? " · today" : ""}</H2>
            {SLOTS.map((slot) => {
              const dish = store.plan[day]?.[slot];
              return (
                <View key={slot} style={st.slot}>
                  <Text style={st.slotName}>{slotLabel[slot]}</Text>
                  {dish ? (
                    <View style={{ flex: 1 }}>
                      <Text style={st.dish} numberOfLines={2}>{dish.title}</Text>
                      <Note>{dish.macros.calories} kcal · {dish.macros.protein_g} g protein · {dish.macros.carbs_g} g carbs · {dish.macros.fat_g} g fat</Note>
                      <View style={[s.row, { marginTop: 4 }]}>
                        <Pressable onPress={() => { startCook(dish, day, slot); router.push("/cook"); }}><Text style={s.link}>Cook</Text></Pressable>
                        <Pressable onPress={() => store.unplan(day, slot)}><Text style={[s.link, { color: colors.sub }]}>Remove</Text></Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable style={{ flex: 1 }} onPress={() => setChoosing({ day, slot })}>
                      <Text style={[s.link, { color: colors.sub }]}>+ add a recipe</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {dishes.length > 0 && (
              <View style={st.totals}>
                <Note>Calories: {kcal.join(" + ")} = {sum(kcal)} of {targets.calories} ({trunc1(targets.calories - sum(kcal))} left)</Note>
                <Note>Protein: {prot.join(" + ")} = {sum(prot)} g of {targets.protein_g} g ({trunc1(targets.protein_g - sum(prot))} g left)</Note>
                <Note>Carbs {sum(dishes.map((d) => d.macros.carbs_g))} g · Fat {sum(dishes.map((d) => d.macros.fat_g))} g</Note>
              </View>
            )}
          </Card>
        );
      })}

      <Modal visible={!!choosing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChoosing(null)}>
        <ScrollView contentContainerStyle={[s.screen, { backgroundColor: colors.bg }]}>
          <H2>{choosing ? `${dayLabel(choosing.day)}, ${slotLabel[choosing.slot]}` : ""}</H2>
          {store.recipes.length === 0 && <Sub>No saved recipes yet. Digest a video first.</Sub>}
          {store.recipes.map((r) => (
            <Pressable key={r.id} onPress={() => { store.planDish(choosing!.day, choosing!.slot, dishFrom(r)); setChoosing(null); }}>
              <Card>
                <Text style={st.dish}>{r.recipe.recipe.title}</Text>
                <Note>{r.recipe.creator.handle} · original version · {r.recipe.macros.calories} kcal · {r.recipe.macros.protein_g} g protein</Note>
              </Card>
            </Pressable>
          ))}
          <Note>For the goal-optimized version, open the recipe, pick your swaps and tap “Save to Meal Plan”.</Note>
          <Button title="Cancel" kind="ghost" onPress={() => setChoosing(null)} />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  slot: { flexDirection: "row", gap: 10, paddingVertical: 6, borderTopColor: colors.border, borderTopWidth: 1 },
  slotName: { width: 78, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sub },
  dish: { fontFamily: fonts.headingMid, fontSize: 14, color: colors.text },
  totals: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, gap: 2 },
});
