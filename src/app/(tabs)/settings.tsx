import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { Host, Switch } from "@expo/ui";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { dateFromMinutes, formatClock, minutesFromDate } from "@/lib/format";
import {
  ensureNotificationPermission,
  openNotificationSettings,
  scheduleWindDownReminder,
} from "@/lib/notifications";
import { selectDemoMode, useAppStore } from "@/lib/store";
import type { ColorPalette, ThemeMode } from "@/lib/types";
import { NativeSegmentedControl } from "@/ui/native";
import {
  GlassPanel,
  NativeScreen,
  SectionHeader,
  TwilightButton,
  chartPalette,
  useTwilightTheme,
} from "@/ui/surface";

const themeModes: ThemeMode[] = ["System", "Sunset", "Night Sky"];
const palettes: ColorPalette[] = ["Twilight", "Amethyst"];

// settings rows

function SettingsSwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { theme } = useTwilightTheme();
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Host matchContents={{ vertical: true }}>
        <Switch
          disabled={disabled}
          value={value}
          onValueChange={onValueChange}
          label={title}
        />
      </Host>
      {subtitle ? (
        <Text style={[rowStyles.subtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function SettingsNavRow({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  const { theme } = useTwilightTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [rowStyles.row, pressed && { opacity: 0.7 }]}
    >
      {icon ? (
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            backgroundColor: `${theme.accent}22`,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons name={icon} size={16} color={theme.accent} />
        </View>
      ) : null}
      <View style={rowStyles.label}>
        <Text style={[rowStyles.title, { color: theme.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[rowStyles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

function SettingsDivider() {
  const { theme } = useTwilightTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.outline,
        marginLeft: 16,
      }}
    />
  );
}

function SettingsRowGroup({ children }: { children: React.ReactNode }) {
  const { theme } = useTwilightTheme();
  const items = (Array.isArray(children) ? children : [children]).filter(
    Boolean,
  );
  return (
    <View
      style={{
        borderRadius: 14,
        backgroundColor: theme.cardMuted,
        borderWidth: 1,
        borderColor: theme.outline,
        overflow: "hidden",
      }}
    >
      {items.map((child, index) => (
        <Fragment key={index}>
          {child}
          {index < items.length - 1 ? <SettingsDivider /> : null}
        </Fragment>
      ))}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 50,
  },
  label: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.8,
  },
});

// sleep time picker

function SleepTimePickerField({
  label,
  icon,
  value,
  color,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  color: string;
  onChange: (minutes: number) => void;
}) {
  const { theme } = useTwilightTheme();
  const dateValue = useMemo(() => dateFromMinutes(value), [value]);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: theme.glass,
        padding: 12,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ color, fontSize: 14 }}>{icon}</Text>
        <Text
          style={{
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
      </View>
      {Platform.OS === "ios" ? (
        <DateTimePicker
          value={dateValue}
          mode="time"
          display="compact"
          accentColor={color}
          onValueChange={(_, date) => {
            setShowAndroidPicker(false);
            if (date) onChange(minutesFromDate(date));
          }}
        />
      ) : (
        <>
          <Pressable
            onPress={() => setShowAndroidPicker(true)}
            style={{
              backgroundColor: `${color}22`,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              alignSelf: "flex-start",
            }}
          >
            <Text
              style={{
                color: theme.textPrimary,
                fontSize: 20,
                fontWeight: "800",
              }}
            >
              {formatClock(value)}
            </Text>
          </Pressable>
          {showAndroidPicker ? (
            <DateTimePicker
              value={dateValue}
              mode="time"
              display="spinner"
              onValueChange={(_, date) => {
                setShowAndroidPicker(false);
                if (date) onChange(minutesFromDate(date));
              }}
              onDismiss={() => setShowAndroidPicker(false)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

// settings screen

export default function SettingsRoute() {
  const setLastViewedTab = useAppStore((state) => state.setLastViewedTab);
  const sleepSettings = useAppStore((state) => state.sleepSettings);
  const appearance = useAppStore((state) => state.appearance);
  const updateAppearance = useAppStore((state) => state.updateAppearance);
  const updateSleepSettings = useAppStore((state) => state.updateSleepSettings);
  const exitDemoMode = useAppStore((state) => state.exitDemoMode);
  const isDemoMode = useAppStore(selectDemoMode);
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);

  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function perform(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Try again.",
      );
    }
  }

  useEffect(() => {
    const check = async () => {
      const permission = await Notifications.getPermissionsAsync();
      setDenied(!permission.granted);
      await scheduleWindDownReminder(useAppStore.getState().sleepSettings);
    };
    void check().catch((failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not check notifications.",
      ),
    );
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void perform(check);
    });
    return () => listener.remove();
  }, []);

  const durationMinutes =
    (sleepSettings.optimalWakeMinutes -
      sleepSettings.optimalSleepMinutes +
      24 * 60) %
    (24 * 60);
  const durationH = Math.floor(durationMinutes / 60);
  const durationM = durationMinutes % 60;
  const healthy = durationH >= 7 && durationH <= 9;

  useEffect(() => {
    setLastViewedTab("settings").catch(() => undefined);
  }, [setLastViewedTab]);

  async function changeReminder(enabled: boolean) {
    if (busy) return;
    setBusy(true);
    await perform(async () => {
      if (enabled) {
        const permission = await ensureNotificationPermission();
        setDenied(!permission.granted);
        if (!permission.granted) return;
      }
      await updateSleepSettings({ windDownReminderEnabled: enabled });
    });
    setBusy(false);
  }

  return (
    <NativeScreen>
      <SectionHeader
        title="Settings"
        subtitle="Configure your sleep goals, app appearance, and data tools."
      />

      <GlassPanel style={{ gap: 16 }}>
        <SectionHeader
          title="Sleep Goal"
          subtitle="These targets power scoring, reminders, and charts."
          compact
        />

        <View style={{ alignItems: "center", gap: 4, paddingVertical: 4 }}>
          <Text
            style={{
              color: healthy ? palette.green : theme.textPrimary,
              fontSize: 38,
              fontWeight: "900",
              fontVariant: ["tabular-nums"],
            }}
          >
            {durationH}h {durationM > 0 ? `${durationM}m` : ""}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            sleep duration
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <SleepTimePickerField
            label="Bedtime"
            icon="☾"
            value={sleepSettings.optimalSleepMinutes}
            color={palette.indigo}
            onChange={(minutes) =>
              void perform(() =>
                updateSleepSettings({ optimalSleepMinutes: minutes }),
              )
            }
          />
          <SleepTimePickerField
            label="Wake up"
            icon="☀"
            value={sleepSettings.optimalWakeMinutes}
            color={palette.orange}
            onChange={(minutes) =>
              void perform(() =>
                updateSleepSettings({ optimalWakeMinutes: minutes }),
              )
            }
          />
        </View>
      </GlassPanel>

      <GlassPanel style={{ gap: 12 }}>
        <SectionHeader
          title="Appearance"
          subtitle="Customize the look and feel of Twilight."
          compact
        />
        <View style={{ gap: 10 }}>
          <NativeSegmentedControl
            options={themeModes}
            value={appearance.themeMode}
            onChange={(value) =>
              void perform(() => updateAppearance({ themeMode: value }))
            }
          />
          <NativeSegmentedControl
            options={palettes}
            value={appearance.colorPalette}
            onChange={(value) =>
              void perform(() => updateAppearance({ colorPalette: value }))
            }
          />
        </View>
      </GlassPanel>

      <GlassPanel style={{ gap: 12 }}>
        <SectionHeader
          title="Notifications"
          subtitle="Stay on track with timely reminders."
          compact
        />
        <SettingsRowGroup>
          <SettingsSwitchRow
            disabled={busy}
            title="Wind-down reminder"
            subtitle="Daily, 3 hours before bedtime."
            value={sleepSettings.windDownReminderEnabled}
            onValueChange={(value) => void changeReminder(value)}
          />
        </SettingsRowGroup>
      </GlassPanel>

      <GlassPanel style={{ gap: 12 }}>
        <SectionHeader
          title="Community & Data"
          subtitle="Support the project and manage your data."
          compact
        />
        <SettingsRowGroup>
          <SettingsNavRow
            title="Join the community"
            subtitle="Twilight on Discord"
            icon="chatbubbles-outline"
            onPress={() =>
              void perform(() =>
                Linking.openURL("https://discord.gg/9tj7J5MESv"),
              )
            }
          />
          <SettingsNavRow
            title="Orbit Labs"
            subtitle="Follow the project on LinkedIn"
            icon="people-outline"
            onPress={() =>
              void perform(() =>
                Linking.openURL(
                  "https://www.linkedin.com/company/orbitlabsdotstudio",
                ),
              )
            }
          />
          <SettingsNavRow
            title="Health Connect"
            subtitle="Sleep permissions and sync status"
            icon="heart-outline"
            onPress={() => router.push("/modals/health-connect")}
          />
          {!isDemoMode ? (
            <SettingsNavRow
              title="Import & Export Data"
              subtitle="Back up or restore your sleep history."
              icon="download-outline"
              onPress={() => router.push("/modals/data-management")}
            />
          ) : null}
        </SettingsRowGroup>
      </GlassPanel>

      <GlassPanel style={{ gap: 12 }}>
        <SectionHeader
          title="Development"
          subtitle="Debug and exploration tools."
          compact
        />
        <TwilightButton
          title="Open Onboarding"
          onPress={() => router.push("/onboarding")}
        />
      </GlassPanel>

      {isDemoMode ? (
        <GlassPanel style={{ gap: 12 }}>
          <SectionHeader
            title="Demo Data"
            subtitle="Exit demo mode and restore your data."
            compact
          />
          <TwilightButton
            title="Exit Demo and Restore Previous Data"
            onPress={() =>
              Alert.alert("Exit demo?", "Restore your exact personal data and settings?", [
                { text: "Cancel", style: "cancel" },
                { text: "Restore", onPress: () => void perform(exitDemoMode) },
              ])
            }
          />
        </GlassPanel>
      ) : null}

      {denied ? (
        <GlassPanel style={{ gap: 12 }}>
          <Text selectable style={{ color: theme.textSecondary }}>
            Notifications are disabled. Enable them in app settings, then return
            here.
          </Text>
          <TwilightButton
            title="Open notification settings"
            onPress={() => void perform(openNotificationSettings)}
          />
        </GlassPanel>
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
      <GlassPanel style={{ gap: 12 }}>
        <SectionHeader
          title="Your Wind-Down Routine"
          subtitle="Follow this timeline for better sleep."
          compact
        />
        {[
          [
            180,
            "Finish your last meal. Switch to water only. No more caffeine or alcohol.",
          ],
          [
            120,
            "Dim overhead lights and switch to lamps or candles. Stop water intake. Enable night mode and blue light filters.",
          ],
          [
            60,
            "Stop stimulating activities. Read or stretch. Keep your room between 17-20°C (63-68°F).",
          ],
          [0, "Complete darkness. Quiet environment. Start your sleep timer."],
        ].map(([offset, text]) => (
          <View key={offset} style={{ gap: 4 }}>
            <Text style={{ color: theme.textPrimary, fontWeight: "700" }}>
              {formatClock(
                (sleepSettings.optimalSleepMinutes - Number(offset) + 1440) %
                  1440,
              )}{" "}
              - {offset ? `${Number(offset) / 60} hours before` : "Bedtime"}
            </Text>
            <Text style={{ color: theme.textSecondary, lineHeight: 22 }}>
              {text}
            </Text>
          </View>
        ))}
        <Text style={{ color: theme.textSecondary, lineHeight: 22 }}>
          Your body needs time to transition to sleep mode. Bright lights
          suppress melatonin, late meals keep your digestive system active, and
          screens stimulate your brain. Following this routine signals to your
          body that it is time to rest.
        </Text>
      </GlassPanel>
    </NativeScreen>
  );
}
