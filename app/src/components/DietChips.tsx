import { Pressable, Text, View } from "react-native";
import { fx } from "../lib/fx";
import { useStore } from "../lib/store";
import { radius, space, type, useTheme } from "../lib/theme";
import type { DietId } from "../lib/types";

// What the user never wants Pal to suggest. Pal's fixes and swaps always respect it (the server double checks).
export const DIETS: { id: DietId; label: string }[] = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "no_dairy", label: "No dairy" },
  { id: "no_eggs", label: "No eggs" },
  { id: "gluten_free", label: "Gluten free" },
  { id: "no_pork", label: "No pork" },
  { id: "no_nuts", label: "Nut allergy" },
  { id: "no_shellfish", label: "Shellfish allergy" },
];

export function DietChips() {
  const t = useTheme();
  const s = useStore();
  const toggle = (id: DietId) => {
    fx.tap();
    s.setDiet(s.diet.includes(id) ? s.diet.filter((x) => x !== id) : [...s.diet, id]);
  };
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.label, { color: t.sub }]}>Anything I should never suggest?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {DIETS.map((d) => {
          const on = s.diet.includes(d.id);
          return (
            <Pressable
              key={d.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(d.id)}
              style={{ borderWidth: 1.5, borderColor: t.tint, backgroundColor: on ? t.tint : "transparent", borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              <Text style={{ color: on ? t.onTint : t.tint, fontWeight: "600", fontSize: 15 }}>{on ? "✓ " : ""}{d.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
