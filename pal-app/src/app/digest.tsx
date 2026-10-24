import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { goalFit } from "../lib/api";
import { KEYS, LABEL, amount, applySwaps, badgeText, verdict, type Verdict } from "../lib/macros";
import { useRecipe } from "../lib/recipeContext";
import { colors, fonts } from "../lib/theme";
import { GOALS, type Goal, type GoalFit, type Ingredient, type Macros, type Recipe } from "../lib/types";

const BADGE: Record<Verdict, { bg: string; fg: string }> = {
  good: { bg: "#D1FAE5", fg: "#047857" },
  bad: { bg: "#FEE2E2", fg: colors.red },
  neutral: { bg: "#F5F5F4", fg: colors.sub },
};

const qty = (i: Ingredient) => `${Number.isInteger(i.quantity) ? i.quantity : i.quantity.toFixed(2).replace(/0+$/, "")} ${i.unit}`.trim();

export default function DigestScreen() {
  const router = useRouter();
  const { recipe } = useRecipe();
  const [goal, setGoal] = useState<Goal>("high_protein");
  const [tab, setTab] = useState<"original" | "optimized">("original");
  const [off, setOff] = useState<Set<string>>(new Set());
  useEffect(() => setOff(new Set()), [goal]); // new goal = new swaps = all on again

  const fit = useQuery({
    queryKey: ["goal-fit", recipe?.creator.video_url, goal],
    queryFn: () => goalFit(recipe!, goal),
    enabled: !!recipe,
    staleTime: Infinity,
    retry: false,
  });

  if (!recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.sub}>No recipe yet.</Text>
        <Pressable onPress={() => router.back()}><Text style={styles.link}>Back to ingest</Text></Pressable>
      </View>
    );
  }

  const live = fit.data ? applySwaps(fit.data, off) : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{recipe.recipe.title}</Text>
      <Text style={styles.sub}>
        {recipe.creator.handle} · {recipe.recipe.prep_min + recipe.recipe.cook_min} min · {recipe.recipe.difficulty} · {recipe.recipe.portions} portions
      </Text>

      <Text style={styles.label}>Goal</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {GOALS.map((g) => (
          <Pressable key={g.id} onPress={() => setGoal(g.id)} style={[styles.pill, goal === g.id && styles.pillOn]}>
            <Text style={[styles.pillText, goal === g.id && { color: "#fff" }]}>{g.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.tabs}>
        {([["original", "Creator Original"], ["optimized", "Pal Goal-Optimized"]] as const).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]}>
            <Text style={[styles.tabText, tab === id && { color: colors.text }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "original" ? (
        <>
          <MacroCard title="Per portion" macros={fit.data?.original_macros ?? recipe.macros} note="Computed from USDA data; ingredients USDA can't match are left out." />
          <Ingredients items={recipe.ingredients} />
        </>
      ) : fit.isPending ? (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.sub}>Finding swaps for {GOALS.find((g) => g.id === goal)!.label.toLowerCase()}…</Text>
        </View>
      ) : fit.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{fit.error.message}</Text>
          <Pressable onPress={() => fit.refetch()}><Text style={styles.link}>Try again</Text></Pressable>
        </View>
      ) : (
        <Optimized recipe={recipe} fit={fit.data} goal={goal} off={off} setOff={setOff} live={live!} />
      )}
    </ScrollView>
  );
}

function Optimized({ recipe, fit, goal, off, setOff, live }: {
  recipe: Recipe; fit: GoalFit; goal: Goal;
  off: Set<string>; setOff: (s: Set<string>) => void; live: { deltas: Macros; total: Macros };
}) {
  const toggle = (name: string) => {
    const next = new Set(off);
    next.has(name) ? next.delete(name) : next.add(name);
    setOff(next);
  };
  // Optimized ingredient list is index-aligned with the original; show the swapped line only when its swap is on.
  const items = recipe.ingredients.map((ing, i) => (fit.swaps.some((s) => s.original === ing.name && !off.has(s.original)) ? fit.optimized_recipe.ingredients[i] : ing));

  return (
    <>
      <Text style={styles.label}>Swaps (tap to turn off / on)</Text>
      {fit.swaps.length === 0 && <Text style={styles.sub}>No swaps suggested for this goal.</Text>}
      <View style={styles.chips}>
        {fit.swaps.map((s) => {
          const on = !off.has(s.original);
          return (
            <Pressable key={s.original} onPress={() => toggle(s.original)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="switch" accessibilityState={{ checked: on }}>
              <Text style={[styles.chipTitle, on && { color: colors.violet }]}>{s.original} → {s.replacement}</Text>
              <Text style={styles.chipReason}>{s.reason}{s.delta ? "" : "  (~ no USDA data, not counted)"}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.badges}>
        {KEYS.map((k) => {
          const v = BADGE[verdict(goal, k, live.deltas[k])];
          return (
            <View key={k} style={[styles.badge, { backgroundColor: v.bg }]}>
              <Text style={[styles.badgeText, { color: v.fg }]}>{badgeText(k, live.deltas[k])}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Per portion: original + swaps = new</Text>
        {KEYS.map((k) => (
          <View key={k} style={styles.mathRow}>
            <Text style={styles.mathLabel}>{LABEL[k]}</Text>
            <Text style={styles.mathText}>{amount(k, fit.original_macros[k])} {live.deltas[k] < 0 ? "-" : "+"} {amount(k, Math.abs(live.deltas[k]))}</Text>
            <Text style={styles.mathTotal}>{amount(k, live.total[k])}</Text>
          </View>
        ))}
        <Text style={styles.note}>Rounded down, never up.{fit.unmatched.length ? ` Not in USDA, so left out: ${fit.unmatched.join(", ")}.` : ""}</Text>
      </View>

      <Ingredients items={items} />
    </>
  );
}
function MacroCard({ title, macros, note }: { title: string; macros: Macros; note: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.macroRow}>
        {KEYS.map((k) => (
          <View key={k} style={styles.macro}>
            <Text style={[styles.macroNum, k === "protein_g" && { color: colors.green }]}>{macros[k]}</Text>
            <Text style={styles.sub}>{k === "calories" ? "kcal" : `${LABEL[k]} g`}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

function Ingredients({ items }: { items: Ingredient[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Ingredients</Text>
      {items.map((i, n) => (
        <View key={`${i.name}-${n}`} style={styles.ingRow}>
          <Text style={styles.ingName}>{i.name}</Text>
          <Text style={styles.sub}>{qty(i)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.sub },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sub, marginTop: 4 },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  tabs: { flexDirection: "row", backgroundColor: colors.border, borderRadius: 12, padding: 3, marginTop: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabOn: { backgroundColor: colors.card },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sub },
  status: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 12 },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, gap: 8 },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.red },
  chips: { gap: 8 },
  chip: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 2 },
  chipOn: { borderColor: colors.violet, backgroundColor: "#EEF2FF" },
  chipTitle: { fontFamily: fonts.headingMid, fontSize: 14, color: colors.sub },
  chipReason: { fontFamily: fonts.body, fontSize: 13, color: colors.sub },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.headingMid, fontSize: 13 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  cardTitle: { fontFamily: fonts.headingMid, fontSize: 15, color: colors.text },
  macroRow: { flexDirection: "row", justifyContent: "space-between" },
  macro: { alignItems: "center", flex: 1 },
  macroNum: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  mathRow: { flexDirection: "row", alignItems: "center" },
  mathLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.sub, width: 70 },
  mathText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text },
  mathTotal: { fontFamily: fonts.heading, fontSize: 15, color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.sub },
  ingRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  ingName: { fontFamily: fonts.body, fontSize: 15, color: colors.text, flexShrink: 1 },
});
