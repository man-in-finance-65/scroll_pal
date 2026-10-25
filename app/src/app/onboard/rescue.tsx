import { router } from "expo-router";
import { useState } from "react";
import { Button, Stage } from "../../components/ui";
import { fx } from "../../lib/fx";

// Step 1: Pal is sick from scrolling junk food. A few taps bring Pal back. (Finch style: you care for Pal first.)
const TAPS = 4;
const LINES = ["Ugh. Too many food videos, zero real food. Tap me?", "Ooh. A warm spark.", "The fog is lifting…", "Almost there!", "I'm back! Thank you, friend."];

export default function Rescue() {
  const [taps, setTaps] = useState(0);
  const healed = taps >= TAPS;

  function tap() {
    if (healed) return fx.tap();
    const n = taps + 1;
    setTaps(n);
    if (n >= TAPS) fx.ready();
    else fx.tap();
  }

  return (
    <Stage
      mood={healed ? "cheer" : "sick"}
      say={LINES[Math.min(taps, TAPS)]}
      step={[1, 5]}
      back={false}
      palSize={210}
      onPal={tap}
      cta={
        healed
          ? <Button title="Let's go" onPress={() => router.push("/onboard/name")} />
          : <Button title="Heal me" onPress={tap} feel="own" />
      }
    />
  );
}
