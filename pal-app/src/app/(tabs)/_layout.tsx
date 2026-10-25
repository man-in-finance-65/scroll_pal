import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors, fonts } from "../../lib/theme";

const icon = (e: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{e}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontFamily: fonts.headingMid, color: colors.text },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.sub,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Sous Chef", tabBarIcon: icon("🧑‍🍳") }} />
      <Tabs.Screen name="digest" options={{ title: "Digest", tabBarIcon: icon("🎬") }} />
      <Tabs.Screen name="pantry" options={{ title: "Pantry & Cart", tabBarIcon: icon("🛒") }} />
      <Tabs.Screen name="plan" options={{ title: "Meal Plan", tabBarIcon: icon("📅") }} />
      <Tabs.Screen name="passport" options={{ title: "Passport", tabBarIcon: icon("🛂") }} />
    </Tabs>
  );
}
