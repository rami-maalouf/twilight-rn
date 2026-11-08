import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import {
  DurationMomentumChart,
  SleepAlignmentChart,
  WeeklySleepWindowChart,
} from "@/charts";
import {
  AnalyticsSelector,
  SleepRegularityCard,
  SleepTimeCard,
} from "@/charts/analytics";
import { formatDuration, formatHours, formatSignedHours } from "@/lib/format";
import {
  buildSleepMetrics,
  clipSleepSeries,
  sleepStreaks,
  validCompletedSessions,
  getSleepGreeting,
  processWeeklySleepData,
} from "@/lib/sleep";
import { useAppStore } from "@/lib/store";
import {
  EmptyPanel,
  GlassPanel,
  MetricCard,
  MetricGrid,
  NativeScreen,
  SectionHeader,
  TrendDelta,
  TwilightButton,
  chartPalette,
  useTwilightTheme,
} from "@/ui/surface";

const initialNow = Date.now();
type HomeMode = "Week" | "Trend" | "Time" | "SRI" | "Score" | "Core";
type HistoryRange = "90D" | "All";

function useNow(refreshIntervalMs: number) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const timer = setInterval(updateNow, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refreshIntervalMs]);

  return now;
}

export default function HomeRoute() {
  const [viewMode, setViewMode] = useState<HomeMode>("Week");
  const [trendWindow, setTrendWindow] = useState<"7-Night" | "Monthly">(
    "7-Night",
  );
  const [historyRange, setHistoryRange] = useState<HistoryRange>("90D");
  const [greetingSeed, setGreetingSeed] = useState(0);
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sleepSettings = useAppStore((state) => state.sleepSettings);
  const now = useNow(activeSessionId ? 1000 : 60_000);
  const startSleepSession = useAppStore((state) => state.startSleepSession);
  const stopActiveSession = useAppStore((state) => state.stopActiveSession);
  const setLastViewedTab = useAppStore((state) => state.setLastViewedTab);
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);

  useEffect(() => {
    setLastViewedTab("home").catch(() => undefined);
  }, [setLastViewedTab]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );

  const completedSessions = useMemo(
    () => validCompletedSessions(sessions),
    [sessions],
  );

  const metrics = useMemo(
    () =>
      buildSleepMetrics(
        completedSessions,
        sleepSettings.optimalSleepMinutes,
        sleepSettings.optimalWakeMinutes,
      ),
    [
      completedSessions,
      sleepSettings.optimalSleepMinutes,
      sleepSettings.optimalWakeMinutes,
    ],
  );

  const weeklyData = useMemo(
    () => processWeeklySleepData(completedSessions),
    [completedSessions],
  );
  const rangeRecords =
    historyRange === "90D"
      ? metrics.recordsInRange("90D")
      : metrics.recordsInRange("All");
  const movingAverageSeries = clipSleepSeries(
    metrics.movingAverageSeries(
      metrics.records,
      trendWindow === "Monthly" ? 30 : 7,
    ),
    rangeRecords,
  );
  const alignmentSeries = clipSleepSeries(
    metrics.sleepAlignmentSeries(metrics.records),
    rangeRecords,
  );

  const isSleeping = !!activeSession;
  const activeDurationSeconds = activeSession
    ? Math.max(
        0,
        Math.floor((now - new Date(activeSession.startTime).getTime()) / 1000),
      )
    : 0;

  const lastSleepSession = useMemo(
    () =>
      completedSessions.sort(
        (left, right) =>
          new Date(right.endTime!).getTime() -
          new Date(left.endTime!).getTime(),
      )[0],
    [completedSessions],
  );

  const currentStreak = sleepStreaks(
    metrics.records.map((record) => record.date),
    new Date(now),
  ).current;
  const durationTrend = metrics.durationTrendPercent(
    metrics.recordsInRange("30D"),
  );

  const latestTracked = weeklyData.filter((item) => item.duration > 0).at(-1);
  const previousTracked = weeklyData.filter((item) => item.duration > 0).at(-2);
  const lastNightDelta =
    latestTracked && previousTracked
      ? ((latestTracked.duration - previousTracked.duration) /
          Math.max(1, previousTracked.duration)) *
        100
      : null;

  const greeting = getSleepGreeting(
    sleepSettings.optimalSleepMinutes,
    sleepSettings.optimalWakeMinutes,
    isSleeping,
    new Date(now),
    greetingSeed,
  );

  return (
    <NativeScreen>
      <SectionHeader
        title={greeting}
        subtitle={new Date(now).toLocaleDateString([], {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        trailing={
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Ionicons
              name="sparkles"
              size={24}
              color={theme.textSecondary}
              onPress={() => setGreetingSeed((value) => value + 7_777)}
            />
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={theme.textSecondary}
              onPress={() => router.push("/modals/metrics-guide")}
            />
          </View>
        }
      />

      <View style={{ gap: 10 }}>
        <View style={{ gap: 8 }}>
          {viewMode !== "Week" ? (
            <TwilightButton
              title={historyRange}
              subtle
              style={{
                minHeight: 36,
                minWidth: 60,
                borderRadius: 13,
                paddingVertical: 8,
              }}
              textStyle={{ fontSize: 12 }}
              onPress={() =>
                setHistoryRange((value) => (value === "90D" ? "All" : "90D"))
              }
            />
          ) : null}
          <View>
            <AnalyticsSelector
              options={["Week", "Trend", "Time", "SRI", "Score", "Core"]}
              value={viewMode}
              onChange={setViewMode}
            />
          </View>
        </View>

        <GlassPanel padded={false} style={{ padding: 14 }}>
          {viewMode === "Week" ? (
            weeklyData.length === 0 ? (
              <EmptyPanel
                title="Your sleep story starts tonight"
                subtitle="Log your first night to see your patterns here."
              />
            ) : (
              <WeeklySleepWindowChart
                data={weeklyData}
                optimalSleepMinutes={sleepSettings.optimalSleepMinutes}
                optimalWakeMinutes={sleepSettings.optimalWakeMinutes}
                targetDurationHours={metrics.targetDurationHours}
              />
            )
          ) : viewMode === "Time" ? (
            <SleepTimeCard metrics={metrics} records={rangeRecords} />
          ) : viewMode === "SRI" ? (
            <SleepRegularityCard metrics={metrics} range={historyRange} />
          ) : viewMode === "Trend" ? (
            <View style={{ gap: 12 }}>
              <AnalyticsSelector
                options={["7-Night", "Monthly"]}
                value={trendWindow}
                onChange={setTrendWindow}
              />
              {movingAverageSeries.filter(
                (point) => point.movingAverageHours != null,
              ).length === 0 ? (
                <EmptyPanel
                  title={
                    trendWindow === "Monthly"
                      ? "Track 30 nights"
                      : "Track 7 nights"
                  }
                  subtitle="A rolling trend appears once Twilight has enough completed sleep logs."
                />
              ) : (
                <View style={{ gap: 12 }}>
                  <SectionHeader
                    title={
                      trendWindow === "Monthly"
                        ? "Monthly Moving Average"
                        : "7-Night Moving Average"
                    }
                    subtitle="Bars are nightly sleep. Line smooths short-term noise."
                    compact
                  />
                  <DurationMomentumChart
                    key={`${historyRange}-${trendWindow}`}
                    window={trendWindow === "Monthly" ? 30 : 7}
                    series={movingAverageSeries}
                    targetHours={metrics.targetDurationHours}
                  />
                </View>
              )}
            </View>
          ) : alignmentSeries.length === 0 ? (
            <EmptyPanel
              title="Score locked"
              subtitle="Track a completed night with a target bedtime and wake time to unlock your alignment trend."
            />
          ) : (
            <View style={{ gap: 12 }}>
              <SectionHeader
                title={
                  viewMode === "Score"
                    ? "Sleep Alignment Score"
                    : "Core Sleep Score"
                }
                subtitle={
                  viewMode === "Score"
                    ? "Duration, timing, phase, and consistency."
                    : "A cleaner duration and consistency read."
                }
                compact
              />
              <SleepAlignmentChart
                key={`${historyRange}-${viewMode}`}
                series={alignmentSeries}
                coreOnly={viewMode === "Core"}
              />
            </View>
          )}
        </GlassPanel>
      </View>

      <GlassPanel style={{ gap: 16 }}>
        {isSleeping && activeSession ? (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  selectable
                  style={{
                    color: theme.textPrimary,
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  Sleep mode activated
                </Text>
                <Text
                  selectable
                  style={{
                    color: theme.textSecondary,
                    marginTop: 3,
                    fontSize: 13,
                  }}
                >
                  Dream Big!
                </Text>
              </View>
              <Text
                style={{ color: theme.accent, fontSize: 14, fontWeight: "900" }}
              >
                {formatDuration(activeDurationSeconds)}
              </Text>
            </View>
            <Text
              selectable
              style={{
                color: theme.textPrimary,
                fontSize: 42,
                fontWeight: "900",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatDuration(activeDurationSeconds)}
            </Text>
            <TwilightButton
              title="Wake Up"
              onPress={() => void stopActiveSession()}
            />
            <Text
              selectable
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              Stay rested. Your session is being tracked locally.
            </Text>
          </>
        ) : (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  selectable
                  style={{
                    color: theme.textPrimary,
                    fontSize: 18,
                    fontWeight: "900",
                  }}
                >
                  {lastSleepSession ? "Last Night's Sleep" : "Start tonight!"}
                </Text>
                <Text
                  selectable
                  style={{
                    color: theme.textSecondary,
                    marginTop: 3,
                    fontSize: 13,
                  }}
                >
                  {lastSleepSession
                    ? "Consistency compounds. Keep the rhythm."
                    : "Track your first night to see insights."}
                </Text>
              </View>
              {currentStreak > 0 ? (
                <View
                  style={{
                    borderRadius: 15,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    backgroundColor: theme.glass,
                  }}
                >
                  <Text style={{ color: theme.textPrimary, fontWeight: "900" }}>
                    🔥 {currentStreak}
                  </Text>
                </View>
              ) : null}
            </View>
            {lastSleepSession ? (
              <View
                style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
              >
                <Text
                  selectable
                  style={{
                    color: theme.textPrimary,
                    fontSize: 37,
                    fontWeight: "900",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatDuration(
                    (new Date(lastSleepSession.endTime!).getTime() -
                      new Date(lastSleepSession.startTime).getTime()) /
                      1000,
                  )}
                </Text>
                <TrendDelta value={lastNightDelta} />
              </View>
            ) : null}
            <MetricGrid>
              <MetricCard
                title="30D avg"
                value={formatHours(
                  metrics.averageDuration(metrics.recordsInRange("30D")) ?? 0,
                )}
                subtitle="recent rhythm"
                icon="◒"
                tint={palette.green}
              />
              <MetricCard
                title="vs target"
                value={formatSignedHours(
                  (metrics.averageDuration(metrics.recordsInRange("30D")) ??
                    0) - metrics.targetDurationHours,
                )}
                subtitle="sleep debt"
                icon="⌁"
                tint={palette.orange}
              />
              <MetricCard
                title="trend"
                value={
                  durationTrend == null ? "-" : `${Math.round(durationTrend)}%`
                }
                subtitle="last week"
                icon="↗"
                tint={palette.cyan}
              />
              <MetricCard
                title="goal hit"
                value={`${metrics.goalHitRate(metrics.recordsInRange("30D"))}%`}
                subtitle="within 45m"
                icon="◎"
                tint={palette.pink}
              />
            </MetricGrid>
            <TwilightButton
              title="Go to Sleep"
              onPress={() => void startSleepSession()}
            />
            <Text
              selectable
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              Tap to start your sleep session when you head to bed.
            </Text>
          </>
        )}
      </GlassPanel>
    </NativeScreen>
  );
}
