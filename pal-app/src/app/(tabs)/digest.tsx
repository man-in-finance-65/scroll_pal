import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, Empty, ErrorBox, H1, Loading, Sub, s } from "../../components/ui";
import { useStore } from "../../lib/store";
import { colors, fonts } from "../../lib/theme";
import { useIngest } from "../../lib/useIngest";

export default function DigestTab() {
  const router = useRouter();
  const { recipes } = useStore();
  const [url, setUrl] = useState("");
  const ingest = useIngest();
  const busy = ingest.isPending;

  return (
    <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <H1>Digest a cooking video</H1>
      <Sub>Paste a TikTok video, Instagram Reel or YouTube Short. Pal listens to it and writes the recipe.</Sub>

      <Card>
        <TextInput
          style={st.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.tiktok.com/@creator/video/…"
          placeholderTextColor={colors.sub}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!busy}
        />
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Button title="Paste" kind="ghost" disabled={busy} onPress={async () => setUrl((await Clipboard.getStringAsync()).trim())} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Get recipe" busy={busy} disabled={!url.trim()} onPress={() => ingest.mutate(url.trim())} />
          </View>
        </View>
      </Card>

      {busy && <Loading text="Listening to the video and writing the recipe… usually 20–60 seconds." />}
      {ingest.isError && <ErrorBox message={ingest.error.message} onRetry={() => ingest.mutate(url.trim())} />}

      <Text style={st.section}>Your recipes</Text>
      {recipes.length === 0 ? (
        <Empty emoji="🎬" title="No recipes yet" body="Digest your first video above. Every recipe is saved on this phone." />
      ) : (
        recipes.map((r) => (
          <Pressable key={r.id} onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: r.id } })}>
            <Card style={st.item}>
              {r.recipe.creator.avatar_url ? (
                <Image source={{ uri: r.recipe.creator.avatar_url }} style={st.avatar} />
              ) : (
                <View style={[st.avatar, st.initial]}><Text style={st.initialText}>{r.recipe.creator.handle.slice(1, 2).toUpperCase()}</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{r.recipe.recipe.title}</Text>
                <Sub>
                  {r.recipe.creator.handle} · {r.recipe.recipe.prep_min + r.recipe.recipe.cook_min} min · {r.recipe.macros.calories} kcal / portion
                </Sub>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  input: { fontFamily: fonts.body, fontSize: 15, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  section: { fontFamily: fonts.headingMid, fontSize: 17, color: colors.text, marginTop: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  initial: { backgroundColor: colors.violet, alignItems: "center", justifyContent: "center" },
  initialText: { fontFamily: fonts.heading, color: "#fff", fontSize: 18 },
  title: { fontFamily: fonts.headingMid, fontSize: 15, color: colors.text },
});
