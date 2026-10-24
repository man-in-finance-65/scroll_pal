import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ingest } from "../lib/api";
import { useRecipe } from "../lib/recipeContext";
import { colors, fonts } from "../lib/theme";
import { creatorLabel, parseSupportedUrl } from "../lib/url";

export default function IngestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setRecipe } = useRecipe();
  const [url, setUrl] = useState("");
  const [found, setFound] = useState<{ platform: string; url: string } | null>(null);
  const dismissed = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: (u: string) => ingest(u),
    onSuccess: (recipe) => {
      setRecipe(recipe);
      router.push("/digest");
    },
  });

  const run = (u: string) => {
    dismissed.current = u;
    setFound(null);
    setUrl(u);
    mutation.mutate(u);
  };

  // On focus (and when the app returns to the foreground), offer to ingest a supported link on the clipboard.
  const checkClipboard = useCallback(async () => {
    try {
      const p = parseSupportedUrl(await Clipboard.getStringAsync());
      if (p && p.url !== dismissed.current && !mutation.isPending) setFound(p);
    } catch {
      // clipboard unavailable: nothing to offer
    }
  }, [mutation.isPending]);

  useFocusEffect(
    useCallback(() => {
      checkClipboard();
      const sub = AppState.addEventListener("change", (s) => s === "active" && checkClipboard());
      return () => sub.remove();
    }, [checkClipboard]),
  );

  const paste = async () => setUrl((await Clipboard.getStringAsync()).trim());
  const busy = mutation.isPending;

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Paste a cooking video</Text>
      <Text style={styles.sub}>TikTok, Instagram Reel or YouTube Short</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.tiktok.com/@creator/video/…"
          placeholderTextColor={colors.sub}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!busy}
        />
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={paste} disabled={busy}>
            <Text style={[styles.btnText, { color: colors.primary }]}>Paste</Text>
          </Pressable>
          <Pressable style={[styles.btn, (busy || !url.trim()) && { opacity: 0.5 }]} onPress={() => run(url.trim())} disabled={busy || !url.trim()}>
            <Text style={styles.btnText}>Get recipe</Text>
          </Pressable>
        </View>
      </View>

      {busy && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.sub}>Listening to the video and writing the recipe… this can take up to a minute.</Text>
        </View>
      )}
      {mutation.isError && <Text style={styles.error}>{mutation.error.message}</Text>}

      {found && !busy && (
        <View style={[styles.snack, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.snackText}>Found recipe from {creatorLabel(found)}. Ingest now?</Text>
          <Pressable
            onPress={() => {
              dismissed.current = found.url;
              setFound(null);
            }}
            hitSlop={8}
          >
            <Text style={styles.snackLater}>Not now</Text>
          </Pressable>
          <Pressable onPress={() => run(found.url)} hitSlop={8}>
            <Text style={styles.snackAction}>Ingest</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12, backgroundColor: colors.bg },
  h1: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, marginTop: 8 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.sub, flexShrink: 1 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  input: { fontFamily: fonts.body, fontSize: 15, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  btnGhost: { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5 },
  btnText: { fontFamily: fonts.headingMid, fontSize: 15, color: "#fff" },
  status: { flexDirection: "row", gap: 10, alignItems: "center", padding: 4 },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.red, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12 },
  snack: { position: "absolute", left: 16, right: 16, backgroundColor: colors.text, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  snackText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: "#fff" },
  snackLater: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#A8A29E" },
  snackAction: { fontFamily: fonts.headingMid, fontSize: 14, color: colors.primary },
});
