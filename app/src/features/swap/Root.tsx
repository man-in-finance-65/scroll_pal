import { useAuth, useUser } from "@clerk/expo";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { PalFlow } from "../pal/Flow";
import { Button, Pal, Screen, s } from "../pal/ui";
import { demoClient, liveClient } from "./client";
import { SwapApp } from "./SwapApp";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const HAS_CLERK = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const demo = demoClient();

// Live mode needs both Clerk keys and the API address; otherwise the app runs the demo on the phone.
export function Root() {
  const [solo, setSolo] = useState(false);
  if (solo) return <PalFlow onExit={() => setSolo(false)} />;
  return HAS_CLERK && API_URL ? <LiveSwap onSolo={() => setSolo(true)} /> : <SwapApp client={demo} onSolo={() => setSolo(true)} />;
}

function LiveSwap({ onSolo }: { onSolo: () => void }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { startHostedAuth } = useHostedAuth();
  const [error, setError] = useState<string | null>(null);
  const client = useMemo(() => liveClient(API_URL!, () => getToken(), user?.firstName ?? user?.username ?? "Pal friend"), [getToken, user?.firstName, user?.username]);

  if (!isLoaded) return <Screen><View style={{ alignItems: "center", marginTop: 120 }}><Pal mood="thinking" /></View></Screen>;
  if (!isSignedIn)
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: 16, marginTop: 40 }}>
          <Pal mood="excited" size={110} />
          <Text style={[s.title, { fontSize: 36 }]}>Scroll Pal</Text>
          <Text style={[s.sub, { textAlign: "center" }]}>Sign in to start or join a Meal Prep Swap pod.</Text>
        </View>
        <Button label="Sign in" onPress={() => startHostedAuth().catch((e) => setError(String(e)))} />
        {error && <Text style={{ color: "#C2185B", textAlign: "center" }}>{error}</Text>}
      </Screen>
    );
  return <SwapApp client={client} onSolo={onSolo} />;
}
