import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Text } from "react-native";
import type { PalMood } from "../../components/Pal";
import { Button, Field, Stage } from "../../components/ui";
import { useStore } from "../../lib/store";
import { type, useTheme } from "../../lib/theme";

// Action 1, feed Pal a link. The link becomes a recipe, then the meal flow starts (Pestle style: recipe first).
// During onboarding this is step 3: Pal starts digesting and you carry on to your goal and body numbers while
// Pal chews; onboarding then comes back here with ?job= and moves on to the swaps once the recipe is ready.
const CAPTION_CODES = ["gemini_failed", "caption_needed", "not_a_recipe", "video_unavailable"];

export default function Feed() {
  const t = useTheme();
  const s = useStore();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [shotNote, setShotNote] = useState("");
  const params = useLocalSearchParams<{ job?: string }>();
  const [jobId, setJobId] = useState<string | null>(params.job ?? null);
  const onboarding = !s.onboarded;
  // Onboarding: coming back here and tapping Feed again with the same link reuses the digest already running.
  const [sent, setSent] = useState<{ url: string; id: string } | null>(null);
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
    if (onboarding && sent?.url === link) return router.push({ pathname: "/onboard/goal", params: { job: sent.id } });
    const id = s.digest(link);
    if (onboarding) {
      setSent({ url: link, id });
      return router.push({ pathname: "/onboard/goal", params: { job: id } });
    }
    setJobId(id);
  }

  function feedCaption() {
    if (!job || !caption.trim()) return;
    s.dismissJob(job.id);
    setJobId(s.digest(job.url, caption.trim()));
  }

  // Instagram captions are hard to copy on a phone. A screenshot of the post works too: Gemini reads the text in it.
  async function feedScreenshot() {
    if (!job) return;
    let res: ImagePicker.ImagePickerResult;
    try {
      res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 });
    } catch (e) {
      return setShotNote(`I couldn't open your photos. ${(e as Error).message}`);
    }
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    // The web picker gives a data URL instead of base64; both end up as plain base64 here.
    const data = asset.base64 ?? asset.uri.split(",")[1];
    if (!data) return setShotNote("That screenshot came through empty. Try another?");
    setShotNote("");
    s.dismissJob(job.id);
    setJobId(s.digest(job.url, caption.trim() || undefined, { data, mimeType: asset.mimeType ?? "image/jpeg" }));
  }

  const busy = job?.status === "digesting";
  const failed = job?.status === "failed";
  const needCaption = failed && CAPTION_CODES.includes(job?.code ?? "");
  const mood: PalMood = job?.status === "done" ? "cheer" : failed ? "worried" : busy ? "fit" : "cheeky";
  const say =
    job?.status === "done" ? `Mmm, ${job.title}! Let me tune it to you.`
    : busy ? "Chewing… videos take me a minute."
    : failed ? shotNote || job?.error
    : "A little birdie says you watch food videos but never cook them. Feed me one.";

  return (
    <Stage
      mood={mood}
      say={say}
      step={onboarding ? [3, 5] : [1, 6]}
      cta={
        needCaption ? <>
            <Button title="Try the caption" onPress={feedCaption} disabled={!caption.trim()} />
            <Button title="Send a screenshot instead" kind="ghost" onPress={feedScreenshot} />
          </>
        : <>
            <Button title={failed ? "Try another link" : "Feed Pal"} onPress={failed ? () => { s.dismissJob(job!.id); setJobId(null); setUrl(""); } : feed} disabled={!failed && (!url.trim() || busy)} loading={busy} />
            {!busy && !failed && !onboarding ? <Button title="Import my Instagram saves" kind="ghost" onPress={() => router.push("/import")} /> : null}
          </>
      }
    >
      {needCaption ? (
        <Field value={caption} onChangeText={setCaption} placeholder="Paste the post's caption here, or send a screenshot" multiline style={{ height: 120, alignItems: "flex-start", paddingTop: 12 }} />
      ) : !failed && !busy && job?.status !== "done" ? (
        <>
          <Field value={url} onChangeText={setUrl} placeholder="Paste a TikTok, Reel or YouTube link" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={feed} action="Paste" onAction={paste} />
          <Text style={[type.caption, { color: t.faint, textAlign: "center" }]}>Recipe sites work too. +10 XP per link.</Text>
        </>
      ) : null}
    </Stage>
  );
}
