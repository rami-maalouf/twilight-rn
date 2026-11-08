import "../global.css";

import { Ionicons } from "@expo/vector-icons";
import * as SystemUI from "expo-system-ui";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Appearance, useColorScheme, ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";

import { getTheme } from "@/lib/theme";
import { useAppStore } from "@/lib/store";

enableScreens(true);

function RootContent() {
  const ready = useAppStore((state) => state.ready);
  const hydrate = useAppStore((state) => state.hydrate);
  const appearance = useAppStore((state) => state.appearance);
  const currentErrorMessage = useAppStore((state) => state.currentErrorMessage);
  const clearError = useAppStore((state) => state.clearError);
  const theme = getTheme(appearance, useColorScheme());

  useEffect(() => {
    Appearance.setColorScheme(appearance.themeMode === "System" ? null : appearance.themeMode === "Sunset" ? "light" : "dark");
  }, [appearance.themeMode]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.backgroundStart).catch(() => undefined);
  }, [theme.backgroundStart]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.backgroundStart }}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={{ color: theme.textSecondary }} className="mt-4 text-sm">
          Loading Twilight…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundStart }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.backgroundStart },
          presentation: "card",
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modals/session-editor" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/metrics-guide" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/timing-sheet" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/support" options={{ presentation: "modal" }} />
        <Stack.Screen name="modals/data-management" options={{ presentation: "modal" }} />
      </Stack>

      {currentErrorMessage ? (
        <View className="absolute inset-x-4 bottom-6">
          <Pressable
            onPress={clearError}
            className="flex-row items-start gap-3 rounded-[24px] border px-4 py-4"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.danger,
            }}
          >
            <Ionicons name="alert-circle" size={20} color={theme.danger} />
            <View className="flex-1">
              <Text style={{ color: theme.textPrimary }} className="text-base font-semibold">
                Pause…
              </Text>
              <Text style={{ color: theme.textSecondary }} className="mt-1 text-sm leading-5">
                {currentErrorMessage}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <RootContent />
    </SafeAreaProvider>
  );
}
