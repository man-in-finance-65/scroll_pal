import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import type { PalMood } from "../../components/Pal";
import { Button, Choice, NoMeal, Stage } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { est, qtyText } from "../../lib/format";
import { fx } from "../../lib/fx";
import { swappedIngredients } from "../../lib/meal";
import { useStore } from "../../lib/store";
import { space, type, useTheme } from "../../lib/theme";

// Step 3 of a meal: a photo of your shelves. Gemini spots what you already have; you can fix any tick by hand.
export default function Pantry() {
  const t = useTheme();
  const s = useStore();
  const meal = s.meal;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ mood: PalMood; say: string } | null>(null);
  if (!meal) return <NoMeal />;

  const names = swappedIngredients(meal.recipe, meal.swaps);
  const have = new Set(meal.have);
  const missing = names.filter((n) => !have.has(n));

  function toggle(n: string) {
    s.setHave(have.has(n) ? meal!.have.filter((x) => x !== n) : [...meal!.have, n]);
  }

  async function snap(from: "camera" | "library") {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], base64: true, quality: 0.4 };
    let res: ImagePicker.ImagePickerResult;
    try {
      if (from === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setNote({ mood: "worried", say: "I need the camera for that. Pick a photo instead?" });
        res = await ImagePicker.launchCameraAsync(opts);
      } else {
        res = await ImagePicker.launchImageLibraryAsync(opts);
      }
    } catch (e) {
      return setNote({ mood: "worried", say: `I couldn't open the ${from}. ${(e as Error).message}` });
    }
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    // The web picker gives a data URL instead of base64; both end up as plain base64 here.
    const b64 = asset.base64 ?? asset.uri.split(",")[1];
    if (!b64) return setNote({ mood: "worried", say: "That photo came through empty. Try another?" });
    setBusy(true);
    setNote({ mood: "fit", say: "Looking…" });
    try {
      const { have: seen } = await api.pantry(b64, asset.mimeType ?? "image/jpeg", names);
      s.setHave([...new Set([...meal!.have, ...seen])]);
      fx.ready();
      setNote({ mood: "cheer", say: seen.length ? `I spotted ${seen.length} of ${names.length}! Fix any I got wrong.` : "I couldn't spot any. Tick what you have." });
    } catch (e) {
      fx.error();
      setNote({ mood: "worried", say: (e as ApiError).message });
    } finally {
      setBusy(false);
    }
  }

  const next = () => {
    if (missing.length) {
      s.setStage("shop");
      router.push("/meal/shop");
    } else {
      s.setStage("cook");
      router.push("/meal/cook");
    }
  };

  return (
    <Stage
      mood={note?.mood ?? "cheeky"}
      say={note?.say ?? "Show me your shelves. I'll spot what you already have."}
      step={[3, 6]}
      palSize={130}
      cta={
        <>
          <Button title="Snap my shelves" icon="📷" kind={meal.have.length ? "secondary" : "primary"} loading={busy} onPress={() => snap("camera")} />
          {meal.have.length || note ? (
            <Button title={missing.length ? `Get the ${missing.length} missing` : "Start cooking"} onPress={next} disabled={busy} />
          ) : (
            <Button title="Pick a photo instead" kind="ghost" onPress={() => snap("library")} />
          )}
        </>
      }
    >
      <Text style={[type.label, { color: t.sub }]}>Tap what you have · {meal.have.length} of {names.length}</Text>
      <View style={{ gap: space.sm }}>
        {names.map((n, i) => (
          <Choice key={n + i} title={n} sub={`${est(meal.recipe.ingredients[i].source)}${qtyText(meal.recipe.ingredients[i].qty, meal.recipe.ingredients[i].unit)}`} selected={have.has(n)} onPress={() => toggle(n)} />
        ))}
      </View>
    </Stage>
  );
}
