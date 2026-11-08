import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text } from "react-native";

import { TimingTimelineChart } from "@/charts";
import { formatClock } from "@/lib/format";
import { buildSleepMetrics, validCompletedSessions } from "@/lib/sleep";
import { useAppStore } from "@/lib/store";
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

import type { SleepMetricsRange } from "@/lib/types";
import { AnalyticsSelector, SleepTimeCard } from "@/charts/analytics";

export default function TimingSheetModal() {
  const [range, setRange] = useState<SleepMetricsRange>("90D");
  const sessions = useAppStore((state) => state.sessions);
  const sleepSettings = useAppStore((state) => state.sleepSettings);
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);

  const completedSessions = useMemo(
    () => validCompletedSessions(sessions),
    [sessions],
  );
  
  const metrics = useMemo(
    () => buildSleepMetrics(completedSessions, sleepSettings.optimalSleepMinutes, sleepSettings.optimalWakeMinutes),
    [completedSessions, sleepSettings.optimalSleepMinutes, sleepSettings.optimalWakeMinutes],
  );
  const records = metrics.recordsInRange(range);
  const timeline = metrics.timingTimelineSeries(records);
  const socialJetlag = metrics.socialJetlag(records);

  return (
    <NativeScreen>
      <SectionHeader title="Timing Timeline" subtitle="How Twilight interprets bedtime, wake time, midpoint, and wake-day semantics." />

      <AnalyticsSelector options={["30D", "90D", "1Y", "All"]} value={range} onChange={setRange} />
      {timeline.length === 0 ? (
        <EmptyPanel title="No timing data yet" subtitle="Complete sleep logs to unlock the timing timeline." />
      ) : (
        <>
          <GlassPanel style={{ gap: 12 }}>
            <SectionHeader title="Bedtime Trend" subtitle="Offsets are normalized from 6 PM so overnight sleep windows remain continuous." compact />
            <SleepTimeCard metrics={metrics} records={records} />
            <TimingTimelineChart series={timeline} />
          </GlassPanel>

          <GlassPanel style={{ gap: 12 }}>
            <SectionHeader title="Timing Targets" subtitle="Target values used by regularity and alignment scores." compact />
            <MetricGrid>
              <MetricCard title="Target Bed" value={formatClock(sleepSettings.optimalSleepMinutes)} subtitle="configured" icon="☾" tint={palette.indigo} />
              <MetricCard title="Target Wake" value={formatClock(sleepSettings.optimalWakeMinutes)} subtitle="configured" icon="☀" tint={palette.orange} />
              <MetricCard title="Social Jetlag" value={socialJetlag.deltaHours == null ? "-" : `${Math.abs(socialJetlag.deltaHours).toFixed(1)}h`} subtitle="weekday/weekend midpoint" icon="⇄" tint={palette.pink} />
              <MetricCard title="Nights" value={`${records.length}`} subtitle={`${range} timing sample`} icon="◎" tint={palette.green} />
            </MetricGrid>
          </GlassPanel>
        </>
      )}

      <GlassPanel style={{ gap: 10 }}>
        <SectionHeader
          title="Wake-Day Semantics"
          subtitle="Each sleep session belongs to the day you woke up on. If bedtime is after noon, Twilight treats it as the night before the selected wake day."
          compact
        />
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
          This keeps overnight sessions, manual logs, charts, and streaks aligned.
        </Text>
      </GlassPanel>

      <TwilightButton title="Close" onPress={() => router.back()} />
    </NativeScreen>
  );
}
