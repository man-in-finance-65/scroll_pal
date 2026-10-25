import { router } from "expo-router";
import { useState } from "react";
import { Button, Field, Stage } from "../../components/ui";
import { useStore } from "../../lib/store";

// Step 2: Pal asks your name, so every line after this can use it.
export default function Name() {
  const s = useStore();
  const [name, setName] = useState(s.name);
  const ok = name.trim().length > 0;

  function save() {
    if (!ok) return;
    s.setName(name.trim());
    router.push("/onboard/goal");
  }

  return (
    <Stage mood="cheeky" say="Phew, much better. What should I call you?" step={[2, 4]} cta={<Button title="That's me" onPress={save} disabled={!ok} />}>
      <Field value={name} onChangeText={setName} placeholder="Your first name" autoCapitalize="words" autoComplete="given-name" maxLength={24} returnKeyType="done" onSubmitEditing={save} autoFocus />
    </Stage>
  );
}
