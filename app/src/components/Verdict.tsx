import { Text, View } from "react-native";
import { judge } from "../lib/goals";
import { brand, space, type, useTheme } from "../lib/theme";
import type { Goal, Recipe } from "../lib/types";

// "3 of 4" plus a tick or cross for every rule, with the maths.
export function Verdict({ recipe, goal }: { recipe: Recipe; goal: Goal }) {
  const t = useTheme();
  const v = judge(recipe, goal);
  const tone = v.passed === v.total ? t.ok : v.passed >= v.total / 2 ? brand.orange : t.danger;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: tone, fontSize: 22, fontWeight: "800" }}>
        {v.passed} of {v.total} <Text style={[type.body, { color: t.sub, fontWeight: "400" }]}>for your {goal} goal</Text>
      </Text>
      {v.rows.map((r) => (
        <View key={r.label} style={{ flexDirection: "row", gap: space.sm, paddingVertical: 4 }}>
          <Text style={{ color: r.pass ? t.ok : t.danger, fontWeight: "800", width: 20 }}>{r.pass ? "✓" : "✗"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: t.text }]}>{r.label}</Text>
            <Text style={[type.caption, { color: t.sub }]}>{v.estimated && r.label !== "Time" ? "~" : ""}{r.math}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
