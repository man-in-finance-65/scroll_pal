import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { Pal } from "../../components/Pal";
import { Button, Card, FadeIn, Screen, SpeechBubble, Title } from "../../components/ui";
import { fx } from "../../lib/fx";
import type { PalState } from "../../lib/mood";
import { useStore } from "../../lib/store";
import { radius, space, type, useTheme } from "../../lib/theme";
import type { Job } from "../../lib/types";
import { usePal } from "../../lib/usePal";

// Errors where pasting the caption can still save the day.
const CAPTION_CODES = ["gemini_failed", "caption_needed", "not_a_recipe"];
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u.slice(0, 30); } };

export default function Add() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const [url, setUrl] = useState("");

  const busy = s.jobs.some((j) => j.status === "digesting");
  const lastFailed = s.jobs.find((j) => j.status === "failed");
  const state: PalState = busy ? "thinking" : lastFailed ? "slow" : "listening";

  async function paste() {
    const text = await Clipboard.getStringAsync().catch(() => "");
    if (text) {
      fx.tap();
      setUrl(text.trim());
    }
  }

  // Starts a digest and frees the box straight away, so another link can go in while Pal chews on this one.
  function go() {
    const link = url.trim();
    if (!link) return;
    Keyboard.dismiss();
    s.digest(link);
    setUrl("");
  }

  const inputStyle = {
    backgroundColor: t.card,
    color: t.text,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 17,
    borderWidth: 1,
    borderColor: t.line,
  };

  return (
    <Screen>
      <Title>Got a recipe link?</Title>

      <View style={{ alignItems: "center", gap: space.sm }}>
        {lastFailed && !busy ? <SpeechBubble>Mmm… that was difficult to digest.</SpeechBubble> : null}
        {busy ? <SpeechBubble>{s.jobs.filter((j) => j.status === "digesting").length > 1 ? "Chewing a few at once…" : "Mmm, chewing on this one…"}</SpeechBubble> : null}
        <Pal state={state} size={150} body={pal.body} level={pal.level} energy={pal.mood.energy} />
      </View>

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            placeholderTextColor={t.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={go}
            style={[inputStyle, { flex: 1 }]}
          />
          <Pressable onPress={paste} style={{ backgroundColor: t.cardAlt, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: "center" }}>
            <Text style={{ color: t.tint, fontWeight: "700", fontSize: 16 }}>Paste</Text>
          </Pressable>
        </View>
        <Button title="Feed me!" onPress={go} disabled={!url.trim()} />
      </View>

      {s.jobs.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text style={[type.label, { color: t.sub }]}>Chewing</Text>
          {s.jobs.map((j) => <JobCard key={j.id} job={j} />)}
        </View>
      )}

      {s.recipes.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text style={[type.label, { color: t.sub }]}>Our recipes</Text>
          {s.recipes.map((r) => (
            <Pressable key={r.title} onPress={() => { s.openRecipe(r); router.push("/recipe"); }}>
              <Card style={{ paddingVertical: space.md }}>
                <Text style={[type.body, { color: t.text, fontWeight: "600" }]}>{r.title}</Text>
                <Text style={[type.caption, { color: t.sub }]}>
                  {r.creator} · {r.cuisine}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function JobCard({ job }: { job: Job }) {
  const t = useTheme();
  const s = useStore();
  const [caption, setCaption] = useState("");
  const needCaption = job.status === "failed" && CAPTION_CODES.includes(job.code ?? "");

  return (
    <FadeIn>
      <Card style={{ paddingVertical: space.md, borderWidth: job.status === "failed" ? 1 : 0, borderColor: t.danger + "55" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          {job.status === "digesting" ? <ActivityIndicator color={t.tint} /> : <Text style={{ fontSize: 18 }}>{job.status === "done" ? "✅" : "😵"}</Text>}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[type.body, { color: t.text, fontWeight: "600" }]}>
              {job.status === "done" ? job.title : host(job.url)}
            </Text>
            <Text numberOfLines={2} style={[type.caption, { color: t.sub }]}>
              {job.status === "digesting" ? "Videos take me a minute…" : job.status === "done" ? (job.xp ? `Yum! +${job.xp} XP` : "Yum! That's my 3 for today.") : job.error}
            </Text>
          </View>
          {job.status !== "digesting" && (
            <Pressable onPress={() => s.dismissJob(job.id)} hitSlop={10}>
              <Text style={{ color: t.faint, fontSize: 18 }}>✕</Text>
            </Pressable>
          )}
        </View>
        {job.status === "done" && (
          <Button title="Show me" kind="secondary" onPress={() => { const r = s.recipes.find((x) => x.title === job.title); if (r) s.openRecipe(r); s.dismissJob(job.id); router.push("/recipe"); }} />
        )}
        {job.status === "failed" && job.detail ? <Text style={[type.caption, { color: t.faint }]}>Technical note: {job.detail}</Text> : null}
        {needCaption && (
          <View style={{ gap: space.sm }}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Paste the post's caption for me"
              placeholderTextColor={t.faint}
              multiline
              style={{ backgroundColor: t.cardAlt, color: t.text, borderRadius: radius.md, padding: space.md, fontSize: 16, minHeight: 90, textAlignVertical: "top" }}
            />
            <Button title="Feed me the caption" disabled={!caption.trim()} onPress={() => { s.dismissJob(job.id); s.digest(job.url, caption.trim()); }} />
          </View>
        )}
      </Card>
    </FadeIn>
  );
}
