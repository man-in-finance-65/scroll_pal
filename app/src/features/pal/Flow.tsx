import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { computeTargets, type Activity, type Body, type Sex, type Targets } from "../../../../engine/targets.ts";
import { DECLINE_MESSAGE, screen } from "../../../../engine/screening.ts";
import { buildWeekInCode, verifyPlan, type WeekPlan } from "../../../../engine/plan.ts";
import { perServing } from "../../../../engine/recipe.ts";
import { shoppingList } from "../../../../engine/shopping.ts";
import { colors } from "../../lib/theme";
import { DEMO_RECIPES } from "./data";
import { Button, Card, Chips, Label, Meter, Pal, Screen, Title, s } from "./ui";

type Step = "welcome" | "about" | "health" | "declined" | "thinking" | "plan";
const BY_ID = new Map(DEMO_RECIPES.map((r) => [r.id, r]));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_ORDER = ["Breakfast", "Lunch", "Snack", "Dinner"];
const hasClerk = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function PalFlow() {
  const [step, setStep] = useState<Step>("welcome");
  const [about, setAbout] = useState({ sex: null as Sex | null, age: "", heightCm: "", weightKg: "", activity: null as Activity | null, pace: 1, meals: 3 });
  const [health, setHealth] = useState<Record<string, boolean | null>>({ preg: null, ed: null, diabetes: null, other: null });
  const [result, setResult] = useState<{ targets: Targets; plan: WeekPlan; checked: boolean } | null>(null);

  const body = (): Body => ({ sex: about.sex!, age: +about.age, heightCm: +about.heightCm, weightKg: +about.weightKg, activity: about.activity! });

  const runHealthCheck = () => {
    const b = body();
    const { eligible } = screen({ age: b.age, weightKg: b.weightKg, heightCm: b.heightCm, pregnantOrBreastfeeding: !!health.preg, eatingDisorderNowOrPast: !!health.ed, diabetesOrGlucoseMedication: !!health.diabetes, otherConditionNeedingSupervisedDiet: !!health.other });
    if (!eligible) return setStep("declined");
    setStep("thinking");
    setTimeout(() => {
      const targets = computeTargets(b, about.pace);
      const plan = buildWeekInCode(DEMO_RECIPES, targets, about.meals);
      // Show each day's meals in time-of-day order.
      const rank = (id: string) => MEAL_ORDER.indexOf(BY_ID.get(id)!.tag);
      plan.days.forEach((d) => d.meals.sort((a, b) => rank(a.recipeId) - rank(b.recipeId)));
      setResult({ targets, plan, checked: verifyPlan(plan, BY_ID, targets).pass });
      setStep("plan");
    }, 1400);
  };

  if (step === "welcome")
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: 18, marginTop: 24 }}>
          <Pal mood="excited" size={120} />
          <Text style={[s.title, { fontSize: 40, textAlign: "center" }]}>ScrollPal</Text>
          <Text style={[s.sub, { textAlign: "center", fontSize: 18 }]}>You save food reels. Pal turns them into a week of meals that fits your life, plus the shopping list.</Text>
        </View>
        <Button label="Build my week" onPress={() => setStep("about")} />
        <Text style={[s.sub, { textAlign: "center", fontSize: 13 }]}>For adults. Pal isn't medical advice.</Text>
        {hasClerk && <Link href="/account" style={{ textAlign: "center", color: colors.violet, fontWeight: "600" }}>Sign in</Link>}
      </Screen>
    );

  if (step === "about") {
    const ready = about.sex && about.activity && +about.age >= 1 && +about.heightCm >= 100 && +about.weightKg >= 30;
    return (
      <Screen>
        <Pal mood="listening" size={64} />
        <Title sub="Pal does the maths, so the numbers are always right.">Tell Pal about you</Title>
        <Label>Sex (for the energy formula)</Label>
        <Chips options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]} value={about.sex} onChange={(sex) => setAbout({ ...about, sex: sex as Sex })} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field label="Age" value={about.age} onChange={(age) => setAbout({ ...about, age })} suffix="yrs" />
          <Field label="Height" value={about.heightCm} onChange={(heightCm) => setAbout({ ...about, heightCm })} suffix="cm" />
          <Field label="Weight" value={about.weightKg} onChange={(weightKg) => setAbout({ ...about, weightKg })} suffix="kg" />
        </View>
        <Label>How active are you?</Label>
        <Chips options={[{ value: "sedentary", label: "Desk job" }, { value: "light", label: "Light, 1–3×/wk" }, { value: "moderate", label: "Moderate, 3–5×/wk" }, { value: "active", label: "Very active" }]} value={about.activity} onChange={(activity) => setAbout({ ...about, activity: activity as Activity })} />
        <Label>Pace</Label>
        <Chips options={[0.5, 1, 1.5, 2].map((v) => ({ value: v, label: `${v} lb/week` }))} value={about.pace} onChange={(pace) => setAbout({ ...about, pace })} />
        <Label>Meals a day</Label>
        <Chips options={[2, 3, 4].map((v) => ({ value: v, label: `${v}` }))} value={about.meals} onChange={(meals) => setAbout({ ...about, meals })} />
        <Button label="Next" disabled={!ready} onPress={() => setStep("health")} />
      </Screen>
    );
  }

  if (step === "health") {
    const qs: [string, string][] = [
      ["preg", "Are you pregnant or breastfeeding?"],
      ["ed", "Have you ever had an eating disorder?"],
      ["diabetes", "Do you have diabetes or take medication that lowers blood sugar?"],
      ["other", "Has a doctor told you to change your diet only under supervision?"],
    ];
    return (
      <Screen>
        <Pal mood="listening" size={64} />
        <Title sub="Pal only keeps a yes or no on whether it can help. Your answers aren't stored.">Quick safety check</Title>
        {qs.map(([k, q]) => (
          <Card key={k}>
            <Text style={{ fontSize: 16, color: colors.text, fontWeight: "600" }}>{q}</Text>
            <Chips options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} value={health[k] === null ? null : health[k] ? "yes" : "no"} onChange={(v) => setHealth({ ...health, [k]: v === "yes" })} />
          </Card>
        ))}
        <Button label="Build my week" disabled={Object.values(health).some((v) => v === null)} onPress={runHealthCheck} />
        <Button label="Back" variant="ghost" onPress={() => setStep("about")} />
      </Screen>
    );
  }

  if (step === "declined")
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: 16, marginTop: 24 }}>
          <Pal mood="helping" size={96} />
          <Title>Let's get you the right help</Title>
          <Text style={[s.sub, { textAlign: "center" }]}>{DECLINE_MESSAGE}</Text>
        </View>
        <Button label="Start over" variant="ghost" onPress={() => setStep("welcome")} />
      </Screen>
    );

  if (step === "thinking")
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: 18, marginTop: 80 }}>
          <Pal mood="thinking" size={120} />
          <Title>Pal is building your week…</Title>
          <Text style={[s.sub, { textAlign: "center" }]}>Working out your targets, picking recipes, then double-checking every day's numbers.</Text>
        </View>
      </Screen>
    );

  return <PlanView {...result!} meals={about.meals} onRestart={() => setStep("about")} />;
}

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.chip, { flexDirection: "row", alignItems: "center", paddingVertical: 4 }]}>
        <TextInput value={value} onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ""))} keyboardType="numeric" inputMode="decimal" maxLength={5} style={{ flex: 1, fontSize: 18, fontWeight: "700", color: colors.text, paddingVertical: 8, minWidth: 0 }} />
        <Text style={{ color: colors.muted }}>{suffix}</Text>
      </View>
    </View>
  );
}

function PlanView({ targets, plan, checked, meals, onRestart }: { targets: Targets; plan: WeekPlan; checked: boolean; meals: number; onRestart: () => void }) {
  const [tab, setTab] = useState<"week" | "shop">("week");
  const [day, setDay] = useState(0);
  const [eaten, setEaten] = useState<Set<string>>(new Set());
  const [bought, setBought] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<{ id: string; servings: number } | null>(null);
  const list = useMemo(() => shoppingList(plan, BY_ID), [plan]);

  const dayMeals = plan.days[day].meals;
  const totals = dayMeals.reduce((t, m, k) => {
    if (!eaten.has(`${day}-${k}`)) return t;
    const n = perServing(BY_ID.get(m.recipeId)!);
    return { kcal: t.kcal + n.kcal * m.servings, protein: t.protein + n.proteinG * m.servings };
  }, { kcal: 0, protein: 0 });
  const toggle = (set: Set<string>, key: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    update(next);
  };

  if (open) {
    const r = BY_ID.get(open.id)!;
    const n = perServing(r);
    return (
      <Screen>
        <Pressable onPress={() => setOpen(null)}><Text style={{ color: colors.violet, fontWeight: "700", fontSize: 16 }}>‹ Back to my week</Text></Pressable>
        <Title sub={`${r.minutes} min · you eat ${fmtServ(open.servings)} · ${Math.round(n.kcal * open.servings)} kcal · ${Math.round(n.proteinG * open.servings)} g protein`}>{r.title}</Title>
        <Card>
          <Label>Ingredients (whole recipe, {r.servings} serving{r.servings > 1 ? "s" : ""})</Label>
          {r.ingredients.map((g) => <Text key={g.name} style={{ fontSize: 16, color: colors.text }}>{fmtGrams(g.grams)}  {g.name}</Text>)}
        </Card>
        <Card>
          <Label>Steps</Label>
          {r.steps.map((st, k) => (
            <View key={k} style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ fontWeight: "800", color: colors.violet, fontSize: 16 }}>{k + 1}</Text>
              <Text style={{ flex: 1, fontSize: 16, lineHeight: 23, color: colors.text }}>{st}</Text>
            </View>
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pal mood="excited" size={56} />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { fontSize: 24 }]}>Your week is ready</Text>
          <Text style={s.sub}>{checked ? "Every day checked by code ✓" : "Closest week Pal could build from these recipes"}</Text>
        </View>
      </View>

      <Card style={{ backgroundColor: colors.navy }}>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Stat label="Daily calories" value={`${targets.calories}`} />
          <Stat label="Daily protein" value={`${targets.proteinG} g`} />
          <Stat label="Maintenance" value={`${targets.maintenanceKcal}`} />
        </View>
        <Text style={{ color: "#B9BCD6", fontSize: 12, lineHeight: 17 }}>
          {targets.floorApplied ? "Pal won't plan below the safe minimum, so your target sits at the floor. " : ""}
          Sources: Mifflin-St Jeor, Harvard Health (deficit and floors), ISSN position stand (protein).
        </Text>
      </Card>

      <Chips options={[{ value: "week", label: "This week" }, { value: "shop", label: `Shopping list · ${list.length}` }]} value={tab} onChange={(v) => setTab(v as "week" | "shop")} />

      {tab === "week" ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {DAYS.map((d, k) => (
              <Pressable key={d} onPress={() => setDay(k)} style={{ alignItems: "center", paddingVertical: 8, width: 44, borderRadius: 12, backgroundColor: k === day ? colors.violet : "transparent" }}>
                <Text style={{ fontWeight: "700", color: k === day ? colors.white : colors.muted }}>{d}</Text>
              </Pressable>
            ))}
          </View>
          <Card>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Meter label="Eaten today" value={totals.kcal} target={targets.calories} unit="kcal" color={colors.violet} />
              <Meter label="Protein" value={totals.protein} target={targets.proteinG} unit="g" color={colors.mint} />
            </View>
          </Card>
          {dayMeals.map((m, k) => {
            const r = BY_ID.get(m.recipeId)!;
            const n = perServing(r);
            const key = `${day}-${k}`;
            const done = eaten.has(key);
            return (
              <Card key={key} style={done ? { opacity: 0.75 } : undefined}>
                <Pressable onPress={() => setOpen({ id: r.id, servings: m.servings })} style={{ gap: 4 }}>
                  <Text style={s.label}>Meal {k + 1} of {meals} · {r.tag} · {r.minutes} min</Text>
                  <Text style={{ fontSize: 19, fontWeight: "800", color: colors.text }}>{r.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 15 }}>{fmtServ(m.servings)} · {Math.round(n.kcal * m.servings)} kcal · {Math.round(n.proteinG * m.servings)} g protein · see recipe ›</Text>
                </Pressable>
                <Pressable onPress={() => toggle(eaten, key, setEaten)} style={[s.chip, { alignSelf: "flex-start" }, done && { backgroundColor: colors.mint, borderColor: colors.mint }]}>
                  <Text style={[s.chipText, done && { color: colors.navy }]}>{done ? "✓ Ate it" : "I ate it"}</Text>
                </Pressable>
              </Card>
            );
          })}
        </>
      ) : (
        <Card>
          <Label>Everything for the week</Label>
          {list.map((item) => {
            const got = bought.has(item.name);
            return (
              <Pressable key={item.name} onPress={() => toggle(bought, item.name, setBought)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: got ? colors.mint : "#CFCDEB", backgroundColor: got ? colors.mint : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {got && <Text style={{ color: colors.navy, fontWeight: "900", fontSize: 13 }}>✓</Text>}
                </View>
                <Text style={{ flex: 1, fontSize: 16, color: got ? colors.muted : colors.text, textDecorationLine: got ? "line-through" : "none", textTransform: "capitalize" }}>{item.name}</Text>
                <Text style={{ fontSize: 15, color: colors.muted, fontWeight: "600" }}>{fmtGrams(item.grams)}</Text>
              </Pressable>
            );
          })}
        </Card>
      )}

      <Text style={[s.sub, { fontSize: 12, textAlign: "center" }]}>Demo recipes stand in until Pal has watched your reels. Nutrition values are approximate USDA figures.</Text>
      <Button label="Change my details" variant="ghost" onPress={onRestart} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: "#B9BCD6", fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: colors.white, fontSize: 22, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

const fmtGrams = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`);
const fmtServ = (n: number) => `${n} serving${n === 1 ? "" : "s"}`;
