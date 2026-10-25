import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../lib/theme";
import { creatorLabel, parseSupportedUrl } from "../lib/url";
import { useIngest } from "../lib/useIngest";

/**
 * When Pal comes to the foreground with a link on the clipboard, offer to ingest it.
 * iPhone asks "Allow Paste?" every time an app reads the clipboard, so on iOS we only check THAT a link is there
 * (no prompt) and read it when you tap. Elsewhere we read it right away and can name the creator.
 */
export function ClipboardSnackbar() {
  const insets = useSafeAreaInsets();
  const ingestM = useIngest();
  const [offer, setOffer] = useState<{ label: string; url: string | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const seen = useRef<string | null>(null);
  // iOS can't compare links without reading them, so after you answer once we stay quiet until the clipboard changes.
  const answered = useRef(false);

  const check = useCallback(async () => {
    try {
      if (Platform.OS === "ios") {
        if (!answered.current && (await Clipboard.hasUrlAsync())) setOffer({ label: "a video link", url: null });
        return;
      }
      const p = parseSupportedUrl(await Clipboard.getStringAsync());
      if (p && p.url !== seen.current) setOffer({ label: creatorLabel(p), url: p.url });
    } catch (e) {
      console.warn("Clipboard check failed:", e);
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (st) => st === "active" && check());
    // Only iOS needs to know the clipboard changed (see `answered`); the web has no clipboard events.
    const clip = Platform.OS === "ios" ? Clipboard.addClipboardListener(() => (answered.current = false)) : null;
    return () => {
      sub.remove();
      clip?.remove();
    };
  }, [check]);

  const dismiss = () => {
    answered.current = true;
    seen.current = offer?.url ?? null;
    setOffer(null);
  };

  const accept = async () => {
    const url = offer?.url ?? (await Clipboard.getStringAsync()).trim();
    dismiss();
    seen.current = url;
    const p = parseSupportedUrl(url);
    if (!p) return setProblem(`That link isn't a TikTok video, Instagram Reel or YouTube Short: ${url.slice(0, 80)}`);
    setProblem(`Digesting ${creatorLabel(p)}…`);
    ingestM.mutate(p.url, { onSettled: () => setProblem(null), onError: (e) => setProblem(e.message) });
  };

  const text = problem ?? (offer ? `Found recipe from ${offer.label}. Ingest now?` : null);
  if (!text) return null;
  return (
    <View style={[st.snack, { bottom: insets.bottom + 64 }]}>
      <Text style={st.text}>{text}</Text>
      {offer && !problem ? (
        <>
          <Pressable onPress={dismiss} hitSlop={8}><Text style={st.later}>Not now</Text></Pressable>
          <Pressable onPress={accept} hitSlop={8}><Text style={st.action}>Ingest</Text></Pressable>
        </>
      ) : !ingestM.isPending ? (
        <Pressable onPress={() => setProblem(null)} hitSlop={8}><Text style={st.later}>OK</Text></Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  snack: { position: "absolute", left: 16, right: 16, backgroundColor: colors.text, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  text: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: "#fff" },
  later: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#A8A29E" },
  action: { fontFamily: fonts.headingMid, fontSize: 14, color: colors.primary },
});
