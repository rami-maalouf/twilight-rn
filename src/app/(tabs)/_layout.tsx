import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColorScheme, DynamicColorIOS } from "react-native";

import { getTheme } from "@/lib/theme";
import { useAppStore } from "@/lib/store";

export default function TabsLayout() {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  const isSunset = theme.textPrimary !== "#F8FAFC";
  const baseNavigationTheme = isSunset ? DefaultTheme : DarkTheme;
  const nativeTintColor =
    process.env.EXPO_OS === "ios"
      ? DynamicColorIOS({
          light: theme.accent,
          dark: theme.accent,
        })
      : theme.accent;
  const navigationTheme = {
    ...baseNavigationTheme,
    dark: !isSunset,
    colors: {
      ...baseNavigationTheme.colors,
      primary: theme.accent,
      background: theme.backgroundStart,
      card: theme.card,
      text: theme.textPrimary,
      border: theme.outline,
      notification: theme.danger,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <NativeTabs
        minimizeBehavior="onScrollDown"
        tintColor={nativeTintColor}
        backgroundColor={process.env.EXPO_OS === "android" ? theme.card : undefined}
        badgeBackgroundColor={theme.accent}
        badgeTextColor={isSunset ? "#FFFFFF" : "#06131B"}
        indicatorColor={theme.glass}
        labelVisibilityMode="labeled"
        rippleColor={theme.accent}
        backBehavior="history"
      >
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Icon
            sf={{ default: "house", selected: "house.fill" }}
            md={{ default: "home", selected: "home_filled" }}
          />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="metrics">
          <NativeTabs.Trigger.Icon
            sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
            md={{ default: "bar_chart", selected: "bar_chart_4_bars" }}
          />
          <NativeTabs.Trigger.Label>Metrics</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="logs">
          <NativeTabs.Trigger.Icon
            sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }}
            md={{ default: "list_alt", selected: "list_alt_check" }}
          />
          <NativeTabs.Trigger.Label>Logs</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon
            sf={{ default: "gearshape", selected: "gearshape.fill" }}
            md={{ default: "settings", selected: "settings" }}
          />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
