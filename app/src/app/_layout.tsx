import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Without Clerk keys the app runs in demo mode: the full meal-plan flow works, sign-in is hidden.
export default function RootLayout() {
  const stack = <Stack screenOptions={{ headerShown: false }} />;
  return publishableKey ? <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>{stack}</ClerkProvider> : stack;
}
