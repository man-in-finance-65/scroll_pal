import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { fx } from "../../lib/fx";
import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";

// Real system tab bar (iOS Liquid Glass / Android Material), so it feels native.
// First launch goes to onboarding (rescue Pal) instead.
export default function TabsLayout() {
  const t = useTheme();
  const s = useStore();
  if (!s.ready) return null;
  if (!s.onboarded) return <Redirect href="/onboard/rescue" />;
  return (
    <NativeTabs tintColor={t.tint} screenListeners={{ tabPress: () => fx.tap() }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "frying.pan", selected: "frying.pan.fill" }} md="skillet" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }} md="trending_up" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
