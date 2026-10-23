import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Celebration } from "../components/Celebration";
import { setupNotifications } from "../lib/notify";
import { StoreProvider } from "../lib/store";
import { useTheme } from "../lib/theme";

function Root() {
  const t = useTheme();
  const nav = t.dark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...nav, colors: { ...nav.colors, background: t.bg, card: t.card, primary: t.tint, text: t.text, border: t.line } }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: t.bg }, headerTintColor: t.tint, headerTitleStyle: { color: t.text } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe" options={{ title: "Recipe", headerBackTitle: "Back" }} />
        <Stack.Screen name="checklist" options={{ title: "Grocery checklist", presentation: "modal" }} />
        <Stack.Screen name="feedback" options={{ title: "", presentation: "modal" }} />
      </Stack>
      <Celebration />
    </ThemeProvider>
  );
}

export default function Layout() {
  useEffect(setupNotifications, []);
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
