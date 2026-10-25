import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "../../lib/theme";

// Web only: the phone's system tab bar doesn't exist in a browser, so use plain bottom tabs.
// Phones keep using _layout.tsx (NativeTabs), which this file doesn't touch.
const tabs = [
  { name: "index", title: "Pal", icon: "✨" },
  { name: "add", title: "Share", icon: "➕" },
  { name: "plan", title: "Plan", icon: "📅" },
];

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.tint,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
      }}
    >
      {tabs.map(({ name, title, icon }) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: () => <Text>{icon}</Text> }} />
      ))}
    </Tabs>
  );
}
