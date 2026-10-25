import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import type { PalMood } from "../../components/Pal";
import { Button, Choice, Stage } from "../../components/ui";
import { useStore } from "../../lib/store";
import { space } from "../../lib/theme";
import type { Goal } from "../../lib/types";

// Step 3: the goal. Pal reacts to each pick, and joins in: Pal wants to get healthier too.
const GOALS: { value: Goal; title: string; sub: string; icon: string; mood: PalMood; say: string }[] = [
  { value: "cut", title: "Lose weight", sub: "Lighter plates, same flavour", icon: "⚖️", mood: "chubby", say: "Then we slim down together. I need it too." },
  { value: "bulk", title: "Build muscle", sub: "Big protein, more fuel", icon: "💪", mood: "cheer", say: "Strong arms incoming! Protein time." },
  { value: "maintain", title: "Eat healthier", sub: "Real food, balanced", icon: "🥦", mood: "cheeky", say: "Real food? My belly is already cheering." },
];

export default function GoalStep() {
  const s = useStore();
  const [goal, setGoal] = useState<Goal | null>(null);
  const picked = GOALS.find((g) => g.value === goal);

  return (
    <Stage
      mood={picked?.mood ?? "cheeky"}
      say={picked?.say ?? `Nice to meet you, ${s.name || "friend"}. What are we going for?`}
      step={[3, 4]}
      cta={<Button title="Lock it in" disabled={!goal} onPress={() => { s.setGoal(goal!); router.push("/onboard/body"); }} />}
    >
      <View style={{ gap: space.sm }}>
        {GOALS.map((g) => (
          <Choice key={g.value} title={g.title} sub={g.sub} icon={g.icon} selected={goal === g.value} onPress={() => setGoal(g.value)} />
        ))}
      </View>
    </Stage>
  );
}
