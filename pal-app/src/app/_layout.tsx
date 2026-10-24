import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RecipeProvider } from "../lib/recipeContext";
import { colors } from "../lib/theme";

export default function Layout() {
  const [client] = useState(() => new QueryClient());
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <RecipeProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.primary, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="index" options={{ title: "Pal" }} />
            <Stack.Screen name="digest" options={{ title: "Digest", headerBackTitle: "Back" }} />
          </Stack>
        </RecipeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
