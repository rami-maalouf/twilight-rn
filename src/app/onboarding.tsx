import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { SleepWindowDialChart } from "@/charts";
import {
  ensureNotificationPermission,
  openNotificationSettings,
} from "@/lib/notifications";
import { useAppStore } from "@/lib/store";
import {
  GlassPanel,
  MetricCard,
  MetricGrid,
  NativeScreen,
  SectionHeader,
  SegmentedPills,
  TwilightButton,
  chartPalette,
  useTwilightTheme,
} from "@/ui/surface";

const steps = [
  "Welcome",
  "Tracking",
  "Schedule",
  "Notifications",
  "Demo",
] as const;

export default function OnboardingRoute() {
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [step, setStep] = useState<(typeof steps)[number]>("Welcome");
  const [sleepMinutes, setSleepMinutes] = useState(22 * 60);
  const [wakeMinutes, setWakeMinutes] = useState(7 * 60);
  const updateSleepSettings = useAppStore((state) => state.updateSleepSettings);
  const importDemoMode = useAppStore((state) => state.importDemoMode);
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const stepIndex = steps.indexOf(step);

  const action = useMemo(
    () => (stepIndex === steps.length - 1 ? "Finish" : "Continue"),
    [stepIndex],
  );

  async function finish(withDemo = false) {
    if (withDemo) {
      await updateSleepSettings({
        optimalSleepMinutes: sleepMinutes,
        optimalWakeMinutes: wakeMinutes,
        isOnboarded: true,
      });
      await importDemoMode();
      router.replace("/(tabs)/home");
      return;
    }

    await updateSleepSettings({
      optimalSleepMinutes: sleepMinutes,
      optimalWakeMinutes: wakeMinutes,
      isOnboarded: true,
    });
    router.replace("/(tabs)/home");
  }

  async function next() {
    if (step === "Notifications") {
      const permission = await ensureNotificationPermission();
      setDenied(!permission.granted);
    }

    if (stepIndex === steps.length - 1) {
      await finish(false);
      return;
    }

    setStep(steps[stepIndex + 1]);
  }

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not continue. Try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <NativeScreen>
      <SectionHeader
        title="Twilight"
        subtitle="A local-first sleep tracker designed to help you manage your rhythm."
        trailing={
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 13,
              fontWeight: "800",
            }}
          >
            {stepIndex + 1}/{steps.length}
          </Text>
        }
      />

      <SegmentedPills options={steps} value={step} onChange={setStep} />

      {step === "Welcome" ? (
        <GlassPanel style={{ gap: 18 }}>
          <View
            style={{
              height: 82,
              width: 82,
              borderRadius: 41,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.glass,
            }}
          >
            <Ionicons name="moon" size={42} color={theme.accent} />
          </View>
          <Text
            style={{
              color: theme.textPrimary,
              fontSize: 40,
              lineHeight: 44,
              fontWeight: "900",
            }}
          >
            Good night.
          </Text>
          <Text
            style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 23 }}
          >
            Twilight starts with manual sessions, sleep logs, analytics, backup,
            restore, and reminders.
          </Text>
        </GlassPanel>
      ) : null}

      {step === "Tracking" ? (
        <GlassPanel style={{ gap: 14 }}>
          <SectionHeader
            title="Tracking & Analytics"
            subtitle="Track your sleep and visualize your progress over time."
            compact
          />
          <MetricGrid>
            <MetricCard
              title="Analytics"
              value="Charts"
              subtitle="weekly and long-range"
              icon="↗"
              tint={palette.cyan}
            />
            <MetricCard
              title="Logs"
              value="Editable"
              subtitle="wake-day semantics"
              icon="☾"
              tint={palette.indigo}
            />
            <MetricCard
              title="Backup"
              value="JSON"
              subtitle="full data archive"
              icon="◇"
              tint={palette.green}
            />
            <MetricCard
              title="Privacy"
              value="Local"
              subtitle="your data stays here"
              icon="◎"
              tint={palette.orange}
            />
          </MetricGrid>
        </GlassPanel>
      ) : null}

      {step === "Schedule" ? (
        <View style={{ gap: 14 }}>
          <SectionHeader
            title="Set Your Rhythm"
            subtitle="Choose the sleep and wake targets used throughout charts, streaks, and log scoring."
            compact
          />
          <SleepWindowDialChart
            sleepMinutes={sleepMinutes}
            wakeMinutes={wakeMinutes}
            onSleepChange={setSleepMinutes}
            onWakeChange={setWakeMinutes}
          />
        </View>
      ) : null}

      {step === "Notifications" ? (
        <GlassPanel style={{ gap: 12 }}>
          <SectionHeader
            title="Notifications"
            subtitle="Get reminders before bedtime."
            compact
          />
          <Text
            style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 23 }}
          >
            Twilight will ask for permission next so it can remind you when
            it&apos;s time to wind down.
          </Text>
        </GlassPanel>
      ) : null}

      {step === "Demo" ? (
        <View style={{ gap: 14 }}>
          <GlassPanel style={{ gap: 12 }}>
            <SectionHeader
              title="Explore the App"
              subtitle="Load sample data to see the full dashboard immediately."
              compact
            />
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 15,
                lineHeight: 23,
              }}
            >
              Demo mode imports a realistic backup and keeps a restore point of
              your previous local state.
            </Text>
          </GlassPanel>
          <TwilightButton
            disabled={busy}
            title="Explore demo data"
            onPress={() => void perform(() => finish(true))}
          />
        </View>
      ) : null}

      {error ? (
        <Text
          selectable
          accessibilityRole="alert"
          style={{ color: theme.danger }}
        >
          {error}
        </Text>
      ) : null}
      {denied ? (
        <GlassPanel style={{ gap: 12 }}>
          <Text style={{ color: theme.textSecondary }}>
            Notifications are disabled. You can enable them in app settings, or
            continue without reminders.
          </Text>
          <TwilightButton
            title="Open notification settings"
            onPress={() => void perform(openNotificationSettings)}
          />
        </GlassPanel>
      ) : null}
      <GlassPanel style={{ gap: 10 }}>
        <TwilightButton
          disabled={busy}
          title={busy ? "Saving..." : action}
          onPress={() => void perform(next)}
        />
        {stepIndex > 0 ? (
          <Pressable
            onPress={() => setStep(steps[stepIndex - 1])}
            style={{
              minHeight: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 14,
                fontWeight: "800",
              }}
            >
              Back
            </Text>
          </Pressable>
        ) : null}
      </GlassPanel>
    </NativeScreen>
  );
}
