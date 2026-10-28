import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Choice, Stage } from "../../components/ui";
import { useStore } from "../../lib/store";
import { space } from "../../lib/theme";

// Action 2, cook a meal, when nothing is planned: pick one of the recipes you fed Pal.
export default function Pick() {
  const s = useStore();
  const [title, setTitle] = useState<string | null>(null);
  const recipe = s.recipes.find((r) => r.title === title);

  return (
    <Stage
      mood="cheeky"
      say="Which one are we cooking?"
      cta={
        <>
          <Button title="Cook this" disabled={!recipe} onPress={() => { s.startMeal(recipe!); router.replace("/meal/swaps"); }} />
          <Button title="Feed me a new link" kind="ghost" onPress={() => router.replace("/meal/feed")} />
        </>
      }
    >
      <View style={{ gap: space.sm }}>
        {s.recipes.map((r) => (
          <Choice key={r.title} title={r.title} sub={`${r.cuisine} · ${r.prep_minutes + r.cook_minutes} min`} selected={title === r.title} onPress={() => setTitle(r.title)} />
        ))}
      </View>
    </Stage>
  );
}
