import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Screen, Segmented, Title } from "../../components/ui";
import { GOAL_CRITERIA } from "../../lib/goals";
import { Verdict } from "../../components/Verdict";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import type { Goal } from "../../lib/types";

const GOALS: { value: Goal; label: string }[] = [
  { value: "bulk", label: "Bulk" },
  { value: "maintain", label: "Maintain" },
  { value: "cut", label: "Cut" },
];

export default function Goals() {
  const t = useTheme();
  const s = useStore();
  const g = GOAL_CRITERIA[s.goal];

  return (
    <Screen>
      <Title sub="Pick what you're after. This is exactly how I judge every recipe you give me.">Goals</Title>
      <Segmented options={GOALS} value={s.goal} onChange={s.setGoal} />

      <Card>
        <Text style={[type.h2, { color: t.text }]}>{g.title}</Text>
        <Text style={[type.body, { color: t.sub }]}>{g.blurb}</Text>
      </Card>

      <Card>
        <Text style={[type.label, { color: brand.violet }]}>What I check, per serving</Text>
        {g.criteria.map((c, i) => (
          <View key={c.id} style={{ flexDirection: "row", gap: space.md, alignItems: "center", paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: brand.violet + "22", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: brand.violet, fontWeight: "800" }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: t.text, fontWeight: "600" }]}>{c.label}</Text>
              <Text style={[type.caption, { color: t.sub }]}>{c.rule}</Text>
            </View>
          </View>
        ))}
        <Text style={[type.caption, { color: t.faint }]}>A number marked ~ is my estimate, so treat that check as a guide.</Text>
      </Card>

      {s.recipe ? (
        <Card>
          <Text style={[type.label, { color: brand.mint }]}>Your latest recipe</Text>
          <Text style={[type.h2, { color: t.text }]}>{s.recipe.title}</Text>
          <Verdict recipe={s.recipe} goal={s.goal} />
        </Card>
      ) : (
        <Button title="Digest a recipe to see how it scores" kind="secondary" onPress={() => router.navigate("/add")} />
      )}
    </Screen>
  );
}
