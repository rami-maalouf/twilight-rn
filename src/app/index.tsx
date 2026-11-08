import { router } from "expo-router";
import { useEffect } from "react";
import { useColorScheme, ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getTheme } from "@/lib/theme";
import { useAppStore } from "@/lib/store";

export default function IndexRoute() {
  const appearance = useAppStore((state) => state.appearance);
  const isOnboarded = useAppStore((state) => state.sleepSettings.isOnboarded);
  const theme = getTheme(appearance, useColorScheme());

  useEffect(() => {
    const href = isOnboarded ? "/(tabs)/home" : "/onboarding";
    router.replace(href);
  }, [isOnboarded]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.backgroundStart,
        paddingHorizontal: 24,
      }}
    >
      <ActivityIndicator color={theme.accent} size="large" />
      <Text
        style={{
          color: theme.textSecondary,
          marginTop: 16,
          textAlign: "center",
        }}
      >
        Opening Twilight…
      </Text>
    </SafeAreaView>
  );
}
