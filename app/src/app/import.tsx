import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { PalMood } from "../components/Pal";
import { Button, Card, Row, Stage } from "../components/ui";
import { fx } from "../lib/fx";
import { instagramLinks } from "../lib/meal";
import { useStore } from "../lib/store";
import { space, type, useTheme } from "../lib/theme";

// Instagram has no way for apps to read your saved posts. Its own "Download your information" export does:
// you ask Instagram for a file of your saves, then hand that file to Pal. Pal never sees your Instagram login.
const MAX_PER_GO = 7; // a week of meals at most, so the list stays small and digesting stays quick

export default function Import() {
  const t = useTheme();
  const s = useStore();
  const [links, setLinks] = useState<string[] | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const jobs = s.jobs.filter((j) => jobIds.includes(j.id));
  const done = jobs.filter((j) => j.status === "done").length;
  const chewing = jobs.some((j) => j.status === "digesting");
  const want = Math.min(MAX_PER_GO, s.plan?.slots.length || MAX_PER_GO);

  async function pickFile() {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/html", "text/plain", "*/*"], copyToCacheDirectory: true });
      const file = res.assets?.[0];
      if (res.canceled || !file) return;
      if (/\.zip$/i.test(file.name)) return setError("That's the zip. Open it and pick saved_posts.json inside.");
      // Web gives a File; phones give a local file address that fetch can read.
      const text = file.file ? await file.file.text() : await (await fetch(file.uri)).text();
      const found = instagramLinks(text);
      if (!found.length) return setError("I couldn't find any saved posts in that file. Pick saved_posts.json.");
      fx.ready();
      setLinks(found);
    } catch (e) {
      fx.error();
      setError(`I couldn't read that file. ${(e as Error).message}`);
    }
  }

  function feedAll() {
    setJobIds(links!.slice(0, want).map((u) => s.digest(u)));
  }

  const mood: PalMood = error ? "worried" : jobIds.length && !chewing ? "cheer" : links ? "cheer" : "cheeky";
  const say = error ?? (
    jobIds.length ? (chewing ? `Chewing through your saves… ${done} of ${jobIds.length} done.` : `Done! ${done} new recipes for our week.`)
    : links ? `Found ${links.length} saved posts! I'll take the newest ${Math.min(want, links.length)}.`
    : "Got food saved on Instagram? Hand me the file and I'll fill our week."
  );

  return (
    <Stage
      mood={mood}
      say={say}
      palSize={140}
      cta={
        jobIds.length ? <Button title="See my week" disabled={chewing} onPress={() => router.dismissTo("/plan")} />
        : links ? <Button title={`Feed Pal ${Math.min(want, links.length)} posts`} onPress={feedAll} />
        : <>
            <Button title="Pick my Instagram file" onPress={pickFile} />
            <Button title="I'll paste links instead" kind="ghost" onPress={() => router.replace("/meal/feed")} />
          </>
      }
    >
      {!links && !jobIds.length ? (
        <Card>
          <Text style={[type.label, { color: t.tint }]}>Get the file (2 minutes)</Text>
          <Row first left="1. Instagram › Settings › Accounts Center" sub="Your information and permissions › Download your information" />
          <Row left="2. Pick Some of your information › Saved" sub="Format JSON, date range All time" />
          <Row left="3. Open the email, unzip it" sub="Pick saved_posts.json here" />
        </Card>
      ) : null}
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
