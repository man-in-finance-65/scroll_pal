import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClipboardSnackbar } from "../components/ClipboardSnackbar";
import { StoreProvider } from "../lib/store";
import { colors, fonts } from "../lib/theme";

export default function Layout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }));
  const [loaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StoreProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.primary,
              headerTitleStyle: { fontFamily: fonts.headingMid, color: colors.text },
              contentStyle: { backgroundColor: colors.bg },
              headerBackTitle: "Back",
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="recipe/[id]" options={{ title: "Digest" }} />
            <Stack.Screen name="cook" options={{ headerShown: false, presentation: "fullScreenModal" }} />
          </Stack>
          <ClipboardSnackbar />
        </StoreProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
