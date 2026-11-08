import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { formatDuration } from "@/lib/format";
import { isValidSession } from "@/lib/sleep";
import { useAppStore } from "@/lib/store";
import { NativeFieldGroup, NativeFieldSection, NativeRow } from "@/ui/native";
import {
  EmptyPanel,
  GlassPanel,
  MetricCard,
  MetricGrid,
  NativeScreen,
  SectionHeader,
  TwilightButton,
  chartPalette,
  useTwilightTheme,
} from "@/ui/surface";

export default function LogsRoute() {
  const sessions = useAppStore((state) => state.sessions);
  const removeSleepLog = useAppStore((state) => state.removeSleepLog);
  const setLastViewedTab = useAppStore((state) => state.setLastViewedTab);
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);

  useEffect(() => {
    setLastViewedTab("logs").catch(() => undefined);
  }, [setLastViewedTab]);

  const completedSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.endTime && isValidSession(session))
        .sort(
          (left, right) =>
            new Date(right.startTime).getTime() -
            new Date(left.startTime).getTime(),
        ),
    [sessions],
  );

  const totalHours = completedSessions.reduce((sum, session) => {
    const end = new Date(session.endTime!).getTime();
    const start = new Date(session.startTime).getTime();
    return sum + Math.max(0, end - start) / 3_600_000;
  }, 0);

  return (
    <NativeScreen>
      <SectionHeader
        title="Sleep Logs"
        subtitle="Edit the nights Twilight uses for scoring and long-range analytics."
        trailing={
          <Pressable onPress={() => router.push("/modals/session-editor")}>
            <Ionicons name="add-circle" size={26} color={theme.accent} />
          </Pressable>
        }
      />

      <GlassPanel style={{ gap: 14 }}>
        <MetricGrid>
          <MetricCard
            title="Logs"
            value={`${completedSessions.length}`}
            subtitle="completed nights"
            icon="☾"
            tint={palette.cyan}
          />
          <MetricCard
            title="Banked"
            value={`${Math.round(totalHours)}h`}
            subtitle="total sleep"
            icon="Σ"
            tint={palette.green}
          />
        </MetricGrid>
        <TwilightButton
          title="Add Sleep Log"
          onPress={() => router.push("/modals/session-editor")}
        />
      </GlassPanel>

      {completedSessions.length === 0 ? (
        <EmptyPanel
          title="No sleep logs yet"
          subtitle="Your completed nights will appear here, and you can also add manual logs."
        />
      ) : (
        <NativeFieldGroup>
          <NativeFieldSection footer="Wake-day semantics apply: each session belongs to the day you woke up.">
            {completedSessions.map((session) => {
              const start = new Date(session.startTime);
              const end = new Date(session.endTime!);
              const duration = formatDuration(
                (end.getTime() - start.getTime()) / 1000,
              );
              return (
                <View key={session.id}>
                  <NativeRow
                    title={end.toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      timeZone:
                        session.endTimeZoneIdentifier ??
                        session.startTimeZoneIdentifier ??
                        undefined,
                    })}
                    subtitle={`${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: session.startTimeZoneIdentifier ?? undefined })} -> ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: session.endTimeZoneIdentifier ?? session.startTimeZoneIdentifier ?? undefined })}`}
                    onPress={() =>
                      router.push(
                        `/modals/session-editor?sessionId=${session.id}`,
                      )
                    }
                    trailing={
                      <View style={{ alignItems: "flex-end", gap: 5 }}>
                        <Text
                          style={{
                            color: theme.textPrimary,
                            fontSize: 15,
                            fontWeight: "900",
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {duration}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={theme.textSecondary}
                        />
                      </View>
                    }
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      paddingHorizontal: 16,
                      paddingBottom: 12,
                    }}
                  >
                    <TwilightButton
                      title="Edit"
                      subtle
                      style={{
                        flex: 1,
                        minHeight: 36,
                        borderRadius: 10,
                        paddingVertical: 6,
                      }}
                      textStyle={{ fontSize: 13 }}
                      onPress={() =>
                        router.push(
                          `/modals/session-editor?sessionId=${session.id}`,
                        )
                      }
                    />
                    <TwilightButton
                      title="Delete"
                      subtle
                      danger
                      style={{
                        flex: 1,
                        minHeight: 36,
                        borderRadius: 10,
                        paddingVertical: 6,
                      }}
                      textStyle={{ fontSize: 13 }}
                      onPress={() => void removeSleepLog(session.id)}
                    />
                  </View>
                </View>
              );
            })}
          </NativeFieldSection>
        </NativeFieldGroup>
      )}
    </NativeScreen>
  );
}
