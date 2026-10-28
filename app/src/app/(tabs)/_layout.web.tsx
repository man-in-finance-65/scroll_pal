import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { fx } from "../../lib/fx";
import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";

// Web only: the phone's system tab bar doesn't exist in a browser, so use plain bottom tabs.
// Phones keep using _layout.tsx (NativeTabs), which this file doesn't touch.
const tabs = [
  { name: "index", title: "Home", icon: "🍳" },
  { name: "plan", title: "Plan", icon: "📅" },
  { name: "progress", title: "Progress", icon: "📈" },
];

export default function TabsLayout() {
  const t = useTheme();
  const s = useStore();
  if (!s.ready) return null;
  if (!s.onboarded) return <Redirect href="/onboard/rescue" />;
  return (
    <Tabs
      screenListeners={{ tabPress: () => fx.tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.tint,
        tabBarInactiveTintColor: t.sub,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
      }}
    >
      {tabs.map(({ name, title, icon }) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: () => <Text>{icon}</Text> }} />
      ))}
    </Tabs>
  );
}
