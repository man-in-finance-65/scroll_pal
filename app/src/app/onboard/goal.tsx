import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Choice, Stage } from "../../components/ui";
import { useStore } from "../../lib/store";
import { brand, space, type, useTheme } from "../../lib/theme";
import type { Goal } from "../../lib/types";

// Step 4: the goal. Pal (the chubby one) joins in: whatever you pick, Pal takes it on too. Finch style:
// you and Pal are a team working on the same thing.
const GOALS: { value: Goal; title: string; sub: string; icon: string; say: string }[] = [
  { value: "cut", title: "Lose weight", sub: "Lighter plates, same flavour", icon: "⚖️", say: "Then we slim down together. Look at me, I need it too!" },
  { value: "bulk", title: "Build muscle", sub: "Big protein, more fuel", icon: "💪", say: "Then we get strong together. I'm lifting with you!" },
  { value: "maintain", title: "Eat healthier", sub: "Real food, balanced", icon: "🥦", say: "Then we eat better together. My belly needs it too!" },
];

export default function GoalStep() {
  const t = useTheme();
  const s = useStore();
  const { job } = useLocalSearchParams<{ job?: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const picked = GOALS.find((g) => g.value === goal);

  return (
    <Stage
      mood="chubby"
      say={picked?.say ?? `I'll chew on that, ${s.name || "friend"}. Meanwhile: what are we going for? I'm in too.`}
      step={[4, 5]}
      cta={<Button title="Lock it in" disabled={!goal} onPress={() => { s.setGoal(goal!); router.push({ pathname: "/onboard/body", params: job ? { job } : {} }); }} />}
    >
      <View style={{ gap: space.sm }}>
        {GOALS.map((g) => (
          <Choice key={g.value} title={g.title} sub={g.sub} icon={g.icon} selected={goal === g.value} onPress={() => setGoal(g.value)} />
        ))}
      </View>
      {picked ? (
        <Card style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={[type.label, { color: t.sub }]}>{s.name || "You"}</Text>
            <Text style={[type.body, { color: t.text, fontWeight: "700" }]}>{picked.icon} {picked.title}</Text>
          </View>
          <Text style={{ fontSize: 24 }}>🤝</Text>
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={[type.label, { color: brand.violet }]}>Pal</Text>
            <Text style={[type.body, { color: t.text, fontWeight: "700" }]}>{picked.icon} {picked.title}</Text>
          </View>
        </Card>
      ) : null}
    </Stage>
  );
}
