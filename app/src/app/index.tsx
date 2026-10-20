import { useAuth } from "@clerk/expo";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { api, type Me } from "../lib/api";
import { colors } from "../lib/theme";

// Gate A: sign in on a real phone and see your user row come back from SurrealDB.
export default function Home() {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { startHostedAuth } = useHostedAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return setMe(null);
    getToken()
      .then((t) => api<Me>("/v1/me", t))
      .then(setMe)
      .catch((e) => setError(String(e)));
  }, [isSignedIn]);

  if (!isLoaded) return <Centered><ActivityIndicator color={colors.violet} /></Centered>;

  if (!isSignedIn)
    return (
      <Centered>
        <Text style={s.star}>✦</Text>
        <Text style={s.title}>ScrollPal</Text>
        <Text style={s.tagline}>Turn your saved reels into a week of meals.</Text>
        <Button label="Get started" onPress={() => startHostedAuth().catch((e) => setError(String(e)))} />
        {error && <Text style={s.error}>{error}</Text>}
      </Centered>
    );

  return (
    <Centered>
      <Text style={s.star}>✦</Text>
      <Text style={s.title}>You're in.</Text>
      <Text style={s.tagline}>{me ? "Pal saved your account." : error ? "Pal couldn't reach the server." : "Checking with Pal…"}</Text>
      {me && <Text style={s.mono}>{me.clerk_id}</Text>}
      {error && <Text style={s.error}>{error}</Text>}
      <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={s.screen}>{children}</View>;
}

function Button({ label, onPress, variant = "primary" }: { label: string; onPress: () => void; variant?: "primary" | "ghost" }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.button, variant === "ghost" && s.ghost, pressed && { opacity: 0.8 }]}>
      <Text style={[s.buttonText, variant === "ghost" && { color: colors.violet }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.surface },
  star: { fontSize: 56, color: colors.violet },
  title: { fontSize: 34, fontWeight: "800", color: colors.text },
  tagline: { fontSize: 17, color: colors.muted, textAlign: "center", marginBottom: 12 },
  mono: { fontFamily: "Courier", color: colors.muted },
  error: { color: colors.pink, textAlign: "center" },
  button: { backgroundColor: colors.violet, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, minWidth: 240, alignItems: "center" },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.violet },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: "700" },
});
