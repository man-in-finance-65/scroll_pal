import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PlanPicker, dayLabel, slotLabel } from "../../components/PlanPicker";
import { Button, Card, Empty, ErrorBox, H1, H2, Loading, Note, Pill, Sub, s } from "../../components/ui";
import { goalFit } from "../../lib/api";
import { startCook } from "../../lib/cookSession";
import { KEYS, LABEL, amount, applySwaps, badgeText, percent, trunc1, verdict, type Verdict } from "../../lib/macros";
import { dishFrom, useStore } from "../../lib/store";
import { colors, fonts } from "../../lib/theme";
import { GOALS, type Dish, type GoalFit, type Ingredient, type Macros, type SavedRecipe } from "../../lib/types";

const BADGE: Record<Verdict, { bg: string; fg: string }> = {
  good: { bg: "#D1FAE5", fg: "#047857" },
  bad: { bg: "#FEE2E2", fg: colors.red },
  neutral: { bg: "#F5F5F4", fg: colors.sub },
};
const qty = (i: Pick<Ingredient, "quantity" | "unit">) => `${Number.isInteger(i.quantity) ? i.quantity : String(Number(i.quantity.toFixed(2)))} ${i.unit}`.trim();
const platformName = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" } as const;

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const saved = store.recipes.find((r) => r.id === id);
  const goal = store.goal;
  const [tab, setTab] = useState<"original" | "optimized">("original");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => setOff(new Set()), [goal]); // a new goal brings new swaps, all switched on

  const fit = useQuery({ queryKey: ["goal-fit", id, goal], queryFn: () => goalFit(saved!.recipe, goal), enabled: !!saved });

  if (!saved) {
    return (
      <ScrollView contentContainerStyle={s.screen}>
        <Empty emoji="🔍" title="Recipe not found" body="It may have been deleted." action={<Button title="Back" kind="ghost" onPress={() => router.back()} />} />
      </ScrollView>
    );
  }
  const r = saved.recipe;
  const live = fit.data ? applySwaps(fit.data, off) : null;
  const dish = currentDish(saved, tab, fit.data, off, live?.total, goal);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.screen, { paddingBottom: 140 }]}>
        <H1>{r.recipe.title}</H1>
        <Sub>
          {r.creator.handle} · {r.recipe.prep_min} + {r.recipe.cook_min} = {r.recipe.prep_min + r.recipe.cook_min} min · {r.recipe.difficulty} · {r.recipe.portions} portions
        </Sub>
        <Pressable onPress={() => Linking.openURL(r.creator.video_url)}>
          <Text style={s.link}>▶ Watch the original on {platformName[r.creator.platform]}</Text>
        </Pressable>
        {saved.note && (
          <View style={st.warn}>
            <Text style={st.warnText}>⚠️ {saved.note} Check the amounts against the video.</Text>
          </View>
        )}

        <Text style={st.label}>Your goal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {GOALS.map((g) => (
            <Pill key={g.id} label={g.label} on={goal === g.id} onPress={() => store.setGoal(g.id)} />
          ))}
        </ScrollView>

        <View style={st.tabs}>
          {([["original", "Creator Original"], ["optimized", "Pal Goal-Optimized"]] as const).map(([t, label]) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
              <Text style={[st.tabText, tab === t && { color: t === "optimized" ? colors.violet : colors.text }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "original" ? (
          <>
            <MacroCard macros={fit.data?.original_macros ?? r.macros} />
            {fit.isPending && <Loading text="Loading the nutrition breakdown…" />}
            {fit.isError && <ErrorBox message={fit.error.message} onRetry={() => fit.refetch()} />}
            {fit.data && <TheMath fit={fit.data} portions={r.recipe.portions} />}
            <Ingredients items={r.ingredients} />
          </>
        ) : fit.isPending ? (
          <Loading text={`Finding swaps for ${GOALS.find((g) => g.id === goal)!.label.toLowerCase()}…`} />
        ) : fit.isError ? (
          <ErrorBox message={fit.error.message} onRetry={() => fit.refetch()} />
        ) : (
          <Optimized fit={fit.data} off={off} setOff={setOff} live={live!} items={dish.ingredients} />
        )}

        <Card>
          <H2>Steps</H2>
          {r.instructions.map((step) => (
            <View key={step.step_number} style={{ gap: 2 }}>
              <Text style={st.step}>{step.step_number}. {step.text}</Text>
              {step.chef_tip && <Note>💡 {step.chef_tip}</Note>}
            </View>
          ))}
        </Card>

        <Pressable
          onPress={() => {
            store.deleteRecipe(saved.id);
            router.back();
          }}
        >
          <Text style={[s.link, { color: colors.red, textAlign: "center" }]}>Delete this recipe</Text>
        </Pressable>
      </ScrollView>

      <View style={st.footer}>
        {toast && <Text style={st.toast}>{toast}</Text>}
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Button title="Save to Meal Plan" kind="ghost" onPress={() => setPicking(true)} />
          </View>
          <View style={{ flex: 1.3 }}>
            <Button
              title="Check Pantry & Order Cart ➔"
              onPress={() => {
                store.addToCart([dish]);
                router.navigate("/pantry");
              }}
            />
          </View>
        </View>
        <Button
          title="🧑‍🍳 Cook with Me now"
          kind="violet"
          onPress={() => {
            startCook(dish);
            router.push("/cook");
          }}
        />
      </View>

      <PlanPicker
        dish={dish}
        visible={picking}
        onClose={() => setPicking(false)}
        onSaved={(day, slot) => {
          setPicking(false);
          setToast(`Saved ${tab === "optimized" ? "the goal-optimized version" : "the original"} to ${dayLabel(day)}, ${slotLabel[slot]}.`);
        }}
      />
    </View>
  );
}

/** The version on screen, as a dish for the plan, the cart and Cook with Me. */
function currentDish(saved: SavedRecipe, tab: "original" | "optimized", fit: GoalFit | undefined, off: Set<string>, total: Macros | undefined, goal: Dish["goal"]): Dish {
  if (tab === "original" || !fit || !total) return dishFrom(saved, "original", { macros: fit?.original_macros ?? saved.recipe.macros });
  const on = fit.swaps.filter((sw) => !off.has(sw.original)).map((sw) => sw.original);
  // The optimized list is index-aligned with the original; keep the original line where its swap is off.
  const ingredients = saved.recipe.ingredients.map((ing, i) => (on.includes(ing.name) ? fit.optimized_recipe.ingredients[i] : ing));
  return dishFrom(saved, "optimized", { goal, ingredients, macros: total, swapsOn: on, title: `${saved.recipe.recipe.title} (Pal ${GOALS.find((g) => g.id === goal)!.label})` });
}

function MacroCard({ macros }: { macros: Macros }) {
  return (
    <Card>
      <H2>Per portion</H2>
      <View style={st.macroRow}>
        {KEYS.map((k) => (
          <View key={k} style={st.macro}>
            <Text style={[st.macroNum, k === "protein_g" && { color: colors.green }]}>{macros[k]}</Text>
            <Sub>{k === "calories" ? "kcal" : `${LABEL[k]} g`}</Sub>
          </View>
        ))}
      </View>
      <Note>Computed from USDA FoodData Central, not guessed. Rounded down, never up.</Note>
    </Card>
  );
}

/** Every ingredient, the USDA food it matched, and how the per-portion numbers add up. */
function TheMath({ fit, portions }: { fit: GoalFit; portions: number }) {
  const [open, setOpen] = useState(false);
  const total = fit.breakdown.reduce((n, b) => n + (b.macros?.calories ?? 0), 0);
  const unmatched = fit.breakdown.filter((b) => !b.macros);
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} style={s.row}>
        <H2>Show the math</H2>
        <Text style={[s.link, { marginLeft: "auto" }]}>{open ? "Hide" : "Show"}</Text>
      </Pressable>
      {unmatched.length > 0 && (
        <Note>Left out ({unmatched.length}): {unmatched.map((u) => u.name).join(", ")}. USDA had no honest match, so they count as 0.</Note>
      )}
      {open && (
        <>
          {fit.breakdown.map((b, i) => (
            <View key={i} style={st.mathLine}>
              <View style={{ flex: 1 }}>
                <Text style={st.ingName}>{b.name}</Text>
                <Note>{b.macros ? `${b.usda} · ${b.grams} g` : `not counted: ${"reason" in b ? b.reason : ""}`}</Note>
              </View>
              <Text style={st.mathNum}>{b.macros ? `${b.macros.calories} kcal` : "—"}</Text>
            </View>
          ))}
          <Text style={st.mathSum}>
            Whole recipe {trunc1(total)} kcal ÷ {portions} portions = {trunc1(total / portions)} kcal per portion
          </Text>
        </>
      )}
    </Card>
  );
}

function Optimized({ fit, off, setOff, live, items }: { fit: GoalFit; off: Set<string>; setOff: (x: Set<string>) => void; live: { deltas: Macros; total: Macros }; items: Ingredient[] }) {
  const { goal } = useStore();
  const toggle = (name: string) => {
    const next = new Set(off);
    next.has(name) ? next.delete(name) : next.add(name);
    setOff(next);
  };
  return (
    <>
      <View style={st.badges}>
        {KEYS.map((k) => {
          const v = BADGE[verdict(goal, k, live.deltas[k])];
          return (
            <View key={k} style={[st.badge, { backgroundColor: v.bg }]}>
              <Text style={[st.badgeText, { color: v.fg }]}>{badgeText(k, live.deltas[k])}{percent(live.deltas[k], fit.original_macros[k])}</Text>
            </View>
          );
        })}
      </View>

      <Text style={st.label}>Pal's swaps (tap to switch off / on)</Text>
      {fit.swaps.length === 0 && <Sub>No swaps suggested for this goal.</Sub>}
      {fit.swaps.map((sw) => {
        const on = !off.has(sw.original);
        return (
          <Pressable key={sw.original} onPress={() => toggle(sw.original)} style={[st.chip, on && st.chipOn]} accessibilityRole="switch" accessibilityState={{ checked: on }}>
            <Text style={[st.chipTitle, on && { color: colors.violet }]}>{on ? "☑" : "☐"} Swap {sw.original} ➔ {sw.replacement}</Text>
            <Note>
              {sw.reason}
              {sw.delta ? ` · ${badgeText("calories", sw.delta.calories)}, ${badgeText("protein_g", sw.delta.protein_g)}` : ` · not counted: USDA has no data for ${sw.unmatched.join(", ")}`}
            </Note>
          </Pressable>
        );
      })}

      <Card>
        <H2>Per portion: original + swaps = new</H2>
        {KEYS.map((k) => (
          <View key={k} style={s.row}>
            <Text style={st.mathLabel}>{LABEL[k]}</Text>
            <Text style={st.mathText}>
              {amount(k, fit.original_macros[k])} {live.deltas[k] < 0 ? "−" : "+"} {amount(k, Math.abs(live.deltas[k]))}
            </Text>
            <Text style={st.mathTotal}>= {amount(k, live.total[k])}</Text>
          </View>
        ))}
        <Note>Each swap's change comes from USDA numbers for both foods. Rounded down, never up.</Note>
      </Card>
      <Ingredients items={items} />
    </>
  );
}

function Ingredients({ items }: { items: Ingredient[] }) {
  return (
    <Card>
      <H2>Ingredients</H2>
      {items.map((i, n) => (
        <View key={`${i.name}-${n}`} style={st.ingRow}>
          <Text style={st.ingName}>{i.name}</Text>
          <Sub>{qty(i)}</Sub>
        </View>
      ))}
    </Card>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sub, marginTop: 4 },
  warn: { backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12 },
  warnText: { fontFamily: fonts.body, fontSize: 13, color: "#92400E" },
  tabs: { flexDirection: "row", backgroundColor: colors.border, borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabOn: { backgroundColor: colors.card },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sub },
  macroRow: { flexDirection: "row" },
  macro: { alignItems: "center", flex: 1 },
  macroNum: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  mathLine: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  mathNum: { fontFamily: fonts.headingMid, fontSize: 13, color: colors.text },
  mathSum: { fontFamily: fonts.headingMid, fontSize: 14, color: colors.text, marginTop: 6 },
  mathLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.sub, width: 64 },
  mathText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text },
  mathTotal: { fontFamily: fonts.heading, fontSize: 15, color: colors.text },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.headingMid, fontSize: 13 },
  chip: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 2 },
  chipOn: { borderColor: colors.violet, backgroundColor: "#EEF2FF" },
  chipTitle: { fontFamily: fonts.headingMid, fontSize: 14, color: colors.sub },
  ingRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  ingName: { fontFamily: fonts.body, fontSize: 15, color: colors.text, flexShrink: 1 },
  step: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 21 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: 28, gap: 8, backgroundColor: colors.bg, borderTopColor: colors.border, borderTopWidth: 1 },
  toast: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.green, textAlign: "center" },
});
