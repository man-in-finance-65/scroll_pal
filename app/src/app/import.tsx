import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import type { PalMood } from "../components/Pal";
import { Button, Card, Stage } from "../components/ui";
import { fx } from "../lib/fx";
import { instagramSaves, type Save } from "../lib/meal";
import { useStore } from "../lib/store";
import { space, type, useTheme } from "../lib/theme";

// Instagram has no way for apps to read your saved posts. Its own "Download your information" export does:
// Pal walks you through asking Instagram for a file of your saves, then you hand that file to Pal.
// Pal never sees your Instagram login. Every step can be skipped.
const MAX_PER_GO = 7; // a week of meals at most, so digesting stays quick
const DYI_URL = "https://accountscenter.instagram.com/info_and_permissions/dyi/";

const GUIDE: { say: string; title: string; detail: string; open?: boolean }[] = [
  { say: "Instagram keeps a file of everything you saved. Let's ask for it.", title: "Open Download your information", detail: "Instagram › Settings › Accounts Center › Your information and permissions › Download your information", open: true },
  { say: "Only the saves. I don't need anything else.", title: "Pick Some of your information", detail: "Download or transfer information › your account › Some of your information › tick Saved › Next" },
  { say: "Instagram emails you when it's ready. Usually minutes.", title: "Download to device", detail: "Date range: All time. Format: JSON. Then tap Create files." },
  { say: "Last bit! Unzip it and hand me the saves file.", title: "Open the email and unzip", detail: "Download the zip, tap it to unzip. Inside: your_instagram_activity › saved › saved_posts.json. A saves CSV from another tool works too." },
];

export default function Import() {
  const t = useTheme();
  const s = useStore();
  const [step, setStep] = useState(0);
  const [found, setFound] = useState<{ saves: Save[]; total: number; kind: "csv" | "links" } | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const jobs = s.jobs.filter((j) => jobIds.includes(j.id));
  const done = jobs.filter((j) => j.status === "done").length;
  const chewing = jobs.some((j) => j.status === "digesting");
  const want = Math.min(MAX_PER_GO, s.plan?.slots.length || MAX_PER_GO);
  const last = step === GUIDE.length - 1;

  // Skip goes back where you came from (the Plan, or the Feed screen).
  const skip = () => (router.canGoBack() ? router.back() : router.replace("/plan"));

  async function pickFile() {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/html", "text/plain", "*/*"], copyToCacheDirectory: true });
      const file = res.assets?.[0];
      if (res.canceled || !file) return;
      if (/\.zip$/i.test(file.name)) return setError("That's the zip. Unzip it and pick saved_posts.json inside.");
      // Web gives a File; phones give a local file address that fetch can read.
      const text = file.file ? await file.file.text() : await (await fetch(file.uri)).text();
      const got = instagramSaves(text);
      if (!got.saves.length) return setError(got.total ? "None of those saves look like food. Pick a file with recipes in it." : "I couldn't find saved posts in that file. Pick saved_posts.json or your saves CSV.");
      fx.ready();
      setFound(got);
    } catch (e) {
      fx.error();
      setError(`I couldn't read that file. ${(e as Error).message}`);
    }
  }

  // After the file: feed the posts, then show progress.
  if (found) {
    const links = found.saves;
    const mood: PalMood = jobIds.length && !chewing ? "cheer" : jobIds.length ? "fit" : "cheer";
    const say = jobIds.length
      ? (chewing ? `Chewing through your saves… ${done} of ${jobIds.length} done.` : `Done! ${done} new recipes for our week.`)
      : found.kind === "csv" ? `${found.total} saves, and ${links.length} are food! I'll take the newest ${Math.min(want, links.length)}.` : `Found ${links.length} saved posts! I'll take the newest ${Math.min(want, links.length)}.`;
    return (
      <Stage
        mood={mood}
        say={say}
        palSize={140}
        cta={jobIds.length
          ? <Button title="See my week" disabled={chewing} onPress={() => router.dismissTo("/plan")} />
          : <Button title={`Feed Pal ${Math.min(want, links.length)} posts`} onPress={() => setJobIds(links.slice(0, want).map((x) => s.digest(x.url, x.caption || undefined)))} />}
      >
        {jobs.length ? (
          <Card style={{ gap: 0 }}>
            {jobs.map((j, k) => (
              <View key={j.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 8, borderTopWidth: k ? 1 : 0, borderColor: t.line }}>
                {j.status === "digesting" ? <ActivityIndicator color={t.tint} /> : <Text>{j.status === "done" ? "✅" : "😵"}</Text>}
                <Text numberOfLines={1} style={[type.body, { color: j.status === "failed" ? t.sub : t.text, flex: 1 }]}>
                  {j.status === "done" ? j.title : j.status === "failed" ? "Too hard to digest" : "Chewing…"}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}
      </Stage>
    );
  }

  // The guide: one step per screen, each with Skip.
  const g = GUIDE[step];
  return (
    <Stage
      mood={error ? "worried" : last ? "cheer" : "cheeky"}
      say={error ?? g.say}
      step={[step + 1, GUIDE.length]}
      palSize={130}
      cta={
        <>
          {last
            ? <Button title="Pick my Instagram file" onPress={pickFile} />
            : <Button title="Next step" onPress={() => setStep(step + 1)} />}
          <Button title="Skip for now" kind="ghost" onPress={skip} />
        </>
      }
    >
      <Card>
        <Text style={[type.label, { color: t.tint }]}>Step {step + 1} of {GUIDE.length}</Text>
        <Text style={[type.h2, { color: t.text }]}>{g.title}</Text>
        <Text style={[type.body, { color: t.sub }]}>{g.detail}</Text>
      </Card>
      {g.open ? <Button title="Open Instagram" kind="secondary" onPress={() => Linking.openURL(DYI_URL).catch(() => setError("I couldn't open Instagram. Open the app and follow the path above."))} /> : null}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: space.lg }}>
        {step > 0 ? <Link text="Previous step" onPress={() => setStep(step - 1)} /> : null}
        {!last ? <Link text="I already have the file" onPress={() => setStep(GUIDE.length - 1)} /> : null}
      </View>
    </Stage>
  );
}

function Link({ text, onPress }: { text: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={() => { fx.tap(); onPress(); }}>
      <Text style={[type.caption, { color: t.tint, fontWeight: "700" }]}>{text}</Text>
    </Pressable>
  );
}
