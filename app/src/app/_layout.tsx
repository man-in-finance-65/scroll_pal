import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Celebration } from "../components/Celebration";
import { initFx } from "../lib/fx";
import { StoreProvider } from "../lib/store";
import { useTheme } from "../lib/theme";

function Root() {
  const t = useTheme();
  return (
    <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: t.bg, card: t.card, primary: t.tint, text: t.text, border: t.line } }}>
      <StatusBar style="light" />
      {/* Every step draws its own top bar (back arrow + progress), so the system header stays hidden. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="feedback" options={{ presentation: "modal" }} />
      </Stack>
      <Celebration />
    </ThemeProvider>
  );
}

export default function Layout() {
  useEffect(() => {
    initFx();
  }, []);
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
