import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { Pal } from "../../components/Pal";
import { Button, Card, FadeIn, Screen, Title } from "../../components/ui";
import { fx } from "../../lib/fx";
import { api, ApiError } from "../../lib/api";
import type { PalState } from "../../lib/mood";
import { useStore } from "../../lib/store";
import { radius, space, type, useTheme } from "../../lib/theme";
import { usePal } from "../../lib/usePal";

export default function Add() {
  const t = useTheme();
  const s = useStore();
  const pal = usePal();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needCaption, setNeedCaption] = useState(false);
  const [happy, setHappy] = useState(false);

  const state: PalState = busy ? "thinking" : happy ? "excited" : error ? "slow" : "listening";

  async function paste() {
    const text = await Clipboard.getStringAsync().catch(() => "");
    if (text) {
      fx.tap();
      setUrl(text.trim());
    }
  }

  async function go() {
    if (!url.trim()) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      const recipe = await api.ingest(url.trim(), needCaption && caption.trim() ? caption.trim() : undefined);
      fx.ready();
      setHappy(true);
      s.addShare(recipe);
      setTimeout(() => {
        setHappy(false);
        setUrl("");
        setCaption("");
        setNeedCaption(false);
        router.push("/recipe");
      }, 700);
    } catch (e) {
      fx.error();
      const err = e as ApiError;
      setError(err.message);
      if (["gemini_failed", "caption_needed", "not_a_recipe"].includes(err.code)) setNeedCaption(true);
    } finally {
      setBusy(false);
    }
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
      <Title sub="Paste a cooking video link and I'll digest it into a recipe.">Got a link?</Title>

      <View style={{ alignItems: "center" }}>
        <Pal state={state} size={150} body={pal.body} level={pal.level} energy={pal.mood.energy} />
        <Text style={[type.caption, { color: t.sub, marginTop: 4 }]}>
          {busy ? "Digesting… give me a sec" : happy ? "Mmm, digested!" : error ? "That one was hard to digest." : "Ready when you are"}
        </Text>
      </View>

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://youtube.com/shorts/…"
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

        {error && (
          <FadeIn>
            <Card style={{ borderWidth: 1, borderColor: t.danger + "55" }}>
              <Text style={[type.body, { color: t.text }]}>{error}</Text>
            </Card>
          </FadeIn>
        )}

        {needCaption && (
          <FadeIn>
            <View style={{ gap: space.sm }}>
              <Text style={[type.label, { color: t.sub }]}>Caption</Text>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Copy the video's caption or description and paste it here."
                placeholderTextColor={t.faint}
                multiline
                style={[inputStyle, { minHeight: 120, textAlignVertical: "top" }]}
              />
            </View>
          </FadeIn>
        )}

        <Button
          title={busy ? "Digesting…" : needCaption ? "Let me digest the caption" : "Let me digest this link"}
          onPress={go}
          loading={busy}
          disabled={!url.trim() || (needCaption && !caption.trim())}
        />
        <Text style={[type.caption, { color: t.faint, textAlign: "center" }]}>Each link I digest = +1 XP (3 a day max).</Text>
      </View>

      {s.recipes.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text style={[type.label, { color: t.sub }]}>Your recipes</Text>
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
