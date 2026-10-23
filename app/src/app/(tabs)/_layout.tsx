import { NativeTabs } from "expo-router/native-tabs";
import { useTheme } from "../../lib/theme";

// Real system tab bar (iOS Liquid Glass / Android Material), so it feels native.
export default function TabsLayout() {
  const t = useTheme();
  return (
    <NativeTabs tintColor={t.tint}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Pal</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sparkles", selected: "sparkles" }} md="auto_awesome" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>Digest</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "plus.circle", selected: "plus.circle.fill" }} md="add_circle" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="passport">
        <NativeTabs.Trigger.Label>Passport</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "globe.americas", selected: "globe.americas.fill" }} md="public" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
