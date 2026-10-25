import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Text } from "react-native";
import type { PalMood } from "../../components/Pal";
import { Button, Field, Stage } from "../../components/ui";
import { useStore } from "../../lib/store";
import { type, useTheme } from "../../lib/theme";

// Action 1, feed Pal a link. The link becomes a recipe, then the meal flow starts (Pestle style: recipe first).
const CAPTION_CODES = ["gemini_failed", "caption_needed", "not_a_recipe"];

export default function Feed() {
  const t = useTheme();
  const s = useStore();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const job = s.jobs.find((j) => j.id === jobId);

  // Digested: start the meal with this recipe and move on.
  useEffect(() => {
    if (job?.status !== "done") return;
    const recipe = s.recipes.find((r) => r.title === job.title);
    if (!recipe) return;
    const id = setTimeout(() => {
      s.dismissJob(job.id);
      s.startMeal(recipe);
      router.replace("/meal/swaps");
    }, 900);
    return () => clearTimeout(id);
  }, [job?.status]);

  async function paste() {
    const text = await Clipboard.getStringAsync().catch(() => "");
    if (text) setUrl(text.trim());
  }

  function feed() {
    const link = url.trim();
    if (!link) return;
    Keyboard.dismiss();
    setJobId(s.digest(link));
  }

  function feedCaption() {
    if (!job || !caption.trim()) return;
    s.dismissJob(job.id);
    setJobId(s.digest(job.url, caption.trim()));
  }

  const busy = job?.status === "digesting";
  const failed = job?.status === "failed";
  const needCaption = failed && CAPTION_CODES.includes(job?.code ?? "");
  const mood: PalMood = job?.status === "done" ? "cheer" : failed ? "worried" : busy ? "fit" : "cheeky";
  const say =
    job?.status === "done" ? `Mmm, ${job.title}! Let me tune it to you.`
    : busy ? "Chewing… videos take me a minute."
    : failed ? job?.error
    : "A little birdie says you watch food videos but never cook them. Feed me one.";

  return (
    <Stage
      mood={mood}
      say={say}
      step={[1, 6]}
      cta={
        needCaption ? <Button title="Try the caption" onPress={feedCaption} disabled={!caption.trim()} />
        : <>
            <Button title={failed ? "Try another link" : "Feed Pal"} onPress={failed ? () => { s.dismissJob(job!.id); setJobId(null); setUrl(""); } : feed} disabled={!failed && (!url.trim() || busy)} loading={busy} />
            {!busy && !failed ? <Button title="Import my Instagram saves" kind="ghost" onPress={() => router.push("/import")} /> : null}
          </>
      }
    >
      {needCaption ? (
        <Field value={caption} onChangeText={setCaption} placeholder="Paste the post's caption here" multiline style={{ height: 120, alignItems: "flex-start", paddingTop: 12 }} />
      ) : !failed && !busy && job?.status !== "done" ? (
        <>
          <Field value={url} onChangeText={setUrl} placeholder="Paste a TikTok, Reel or YouTube link" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={feed} action="Paste" onAction={paste} />
          <Text style={[type.caption, { color: t.faint, textAlign: "center" }]}>Recipe sites work too. +10 XP per link.</Text>
        </>
      ) : null}
    </Stage>
  );
}
