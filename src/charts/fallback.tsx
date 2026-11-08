import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { dateFromMinutes, formatClock, formatDuration, formatHours, minutesFromDate } from "@/lib/format";
import type {
  DailySleepData,
  SleepAlignmentScorePoint,
  SleepConsistencyPoint,
  SleepDebtPoint,
  SleepDurationBucket,
  SleepMovingAveragePoint,
  SleepTimingPoint,
  SleepTrendPeriod,
  SleepWeekdayAverage,
} from "@/lib/types";
import {
  GlassPanel,
  InsightPill,
  SectionHeader,
  chartPalette,
  useTwilightTheme,
} from "@/ui/surface";

type Point = {
  label: string;
  value: number;
  helper?: string;
};

function normalize(value: number, values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return 0;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (Math.abs(max - min) < 0.0001) return 0.55;
  return Math.max(0.04, Math.min(1, (value - min) / (max - min)));
}

function FallbackNotice() {
  const { theme } = useTwilightTheme();
  return (
    <Text style={{ color: theme.warning, fontSize: 11, lineHeight: 15 }}>
      Skia charts will enable after rebuilding the Android development client.
    </Text>
  );
}

function BarStrip({
  data,
  color,
  height = 150,
  formatValue,
}: {
  data: Point[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const values = data.map((item) => item.value);

  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          height,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.outline,
          backgroundColor: theme.cardMuted,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 12,
        }}
      >
        {data.map((item, index) => {
          const ratio = normalize(item.value, values);
          return (
            <View key={`${item.label}-${index}`} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.textSecondary, fontSize: 9 }}>
                {formatValue ? formatValue(item.value) : item.value.toFixed(1)}
              </Text>
              <View
                style={{
                  width: "72%",
                  minHeight: 5,
                  height: Math.max(5, ratio * (height - 56)),
                  borderRadius: 7,
                  backgroundColor: color ?? item.helper ?? palette.cyan,
                }}
              />
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.textSecondary, fontSize: 9 }}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
      <FallbackNotice />
    </View>
  );
}

function MetricStrip({ data, color, suffix = "" }: { data: Point[]; color?: string; suffix?: string }) {
  const { theme } = useTwilightTheme();
  const latest = data.at(-1);
  return (
    <View style={{ gap: 8 }}>
      <BarStrip data={data.slice(-18)} color={color} formatValue={(value) => `${Math.round(value)}${suffix}`} />
      {latest ? (
        <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: "center" }}>
          Latest {latest.label}: <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>{latest.value.toFixed(suffix === "%" ? 0 : 1)}{suffix}</Text>
        </Text>
      ) : null}
    </View>
  );
}

export function WeeklySleepWindowChart({
  data,
  optimalSleepMinutes,
  optimalWakeMinutes,
  targetDurationHours,
}: {
  data: DailySleepData[];
  optimalSleepMinutes: number;
  optimalWakeMinutes: number;
  targetDurationHours: number;
}) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const chartData = data.map((item) => ({
    label: item.dayLabel.slice(0, 3),
    value: item.duration / 3600,
  }));

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 7 }}>
        <InsightPill title="avg sleep" value={formatHours(targetDurationHours)} subtitle="goal duration" tint={palette.cyan} />
        <InsightPill title="bedtime" value={formatClock(optimalSleepMinutes)} subtitle="target" tint={palette.indigo} />
        <InsightPill title="wake" value={formatClock(optimalWakeMinutes)} subtitle="target" tint={palette.orange} />
        <InsightPill title="nights" value={`${data.filter((item) => item.duration > 0).length}`} subtitle="week" tint={palette.green} />
      </View>
      <BarStrip data={chartData} color={palette.cyan} formatValue={(value) => (value > 0 ? formatHours(value) : "-")} />
      <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: "center" }}>
        Latest: <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>{formatDuration(data.at(-1)?.duration ?? 0)}</Text>
      </Text>
    </View>
  );
}

export function DurationMomentumChart({ series, targetHours }: { series: SleepMovingAveragePoint[]; targetHours: number; window?: number }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const data = series
    .filter((point) => point.movingAverageHours != null)
    .map((point) => ({
      label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
      value: point.movingAverageHours ?? 0,
    }));
  return (
    <View style={{ gap: 8 }}>
      <MetricStrip data={data} color={palette.cyan} suffix="h" />
      <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: "center" }}>Target {formatHours(targetHours)}</Text>
    </View>
  );
}

export function MovingAverageChart(props: { series: SleepMovingAveragePoint[]; targetHours: number; window?: number }) {
  return <DurationMomentumChart {...props} />;
}

export function RollingConsistencyChart({ series }: { series: SleepConsistencyPoint[] }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const data = series
    .map((point) => {
      const values = [point.sleepConsistency, point.wakeConsistency, point.scheduleAccuracy].filter((value): value is number => value != null);
      return {
        label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
        value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      };
    })
    .filter((point) => point.value > 0);
  return <MetricStrip data={data} color={palette.indigo} suffix="%" />;
}

export function RegularityComponentsChart({
  series,
  component,
}: {
  series: SleepConsistencyPoint[];
  component: "All" | "Bedtime" | "Wake" | "Accuracy";
}) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const pick = (point: SleepConsistencyPoint) => {
    if (component === "Bedtime") return point.sleepConsistency;
    if (component === "Wake") return point.wakeConsistency;
    if (component === "Accuracy") return point.scheduleAccuracy;
    const values = [point.sleepConsistency, point.wakeConsistency, point.scheduleAccuracy].filter((value): value is number => value != null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const data = series
    .map((point) => ({
      label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
      value: pick(point) ?? 0,
    }))
    .filter((point) => point.value > 0);
  return <MetricStrip data={data} color={component === "Wake" ? palette.orange : component === "Accuracy" ? palette.green : palette.indigo} suffix="%" />;
}

export function CumulativeDebtChart({ series }: { series: SleepDebtPoint[] }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const data = series.map((point) => ({
    label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
    value: point.cumulativeHours,
  }));
  return <MetricStrip data={data} color={palette.green} suffix="h" />;
}

export function WeekdayAverageChart({ days }: { days: SleepWeekdayAverage[] }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  return (
    <BarStrip
      data={days.map((day) => ({
        label: day.dayName.slice(0, 3),
        value: day.averageHours,
      }))}
      color={palette.cyan}
      formatValue={(value) => value.toFixed(1)}
    />
  );
}

export function DurationDistributionChart({ buckets }: { buckets: SleepDurationBucket[] }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  return (
    <BarStrip
      data={buckets.map((bucket) => ({ label: bucket.label, value: Math.round(bucket.share * 100) }))}
      color={palette.orange}
      formatValue={(value) => `${Math.round(value)}%`}
    />
  );
}

export function TrendSparkline({ values, color }: { values: number[]; color?: string }) {
  return <BarStrip data={values.map((value, index) => ({ label: `${index + 1}`, value }))} color={color} height={54} />;
}

function SparkBars({ values, color }: { values: number[]; color: string }) {
  return (
    <View style={{ height: 34 }}>
      <BarStrip data={values.map((value, index) => ({ label: `${index + 1}`, value }))} color={color} height={34} />
    </View>
  );
}

export function TrendsAnalysisCard({ periods }: { periods: SleepTrendPeriod[] }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const sevenDay = periods.find((period) => period.days === 7);
  const insight = sevenDay?.averageDuration == null
    ? "Track more nights to unlock trend comparisons."
    : `Over the last 7 days, you're averaging ${formatHours(sevenDay.averageDuration)} of sleep.`;

  return (
    <GlassPanel style={{ gap: 14 }}>
      <SectionHeader title="Trends Analysis" subtitle={insight} compact />
      {periods.map((period) => {
        const positive = (period.changePercent ?? 0) >= 0;
        return (
          <View
            key={period.days}
            style={{ borderTopWidth: 1, borderTopColor: theme.outline, paddingTop: 10, gap: 8 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, color: theme.textSecondary, fontSize: 13 }}>{period.days}-day</Text>
              <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: "800" }}>{period.averageDuration == null ? "-" : formatHours(period.averageDuration)}</Text>
              <Text style={{ color: positive ? palette.cyan : palette.orange, fontSize: 14, fontWeight: "800" }}>{period.changePercent == null ? "-" : `${positive ? "+" : ""}${Math.round(period.changePercent)}%`}</Text>
            </View>
            <SparkBars values={period.sparkline} color={period.days <= 14 ? palette.indigo : palette.cyan} />
          </View>
        );
      })}
      <FallbackNotice />
    </GlassPanel>
  );
}

export function SleepAlignmentChart({
  series,
  coreOnly,
}: {
  series: SleepAlignmentScorePoint[];
  coreOnly?: boolean;
}) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const data = series.map((point) => ({
    label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
    value: coreOnly ? point.coreScore : point.dailyScore,
  }));
  return <MetricStrip data={data} color={coreOnly ? palette.cyan : palette.green} suffix="%" />;
}

export function TimingTimelineChart({ series }: { series: SleepTimingPoint[] }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const data = series.map((point) => ({
    label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
    value: point.bedtimeOffset,
  }));
  return <MetricStrip data={data} color={palette.indigo} />;
}

export function SleepWindowDialChart({
  sleepMinutes,
  wakeMinutes,
  onSleepChange,
  onWakeChange,
}: {
  sleepMinutes: number;
  wakeMinutes: number;
  onSleepChange: (minutes: number) => void;
  onWakeChange: (minutes: number) => void;
  size?: number;
}) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const durationMinutes = (wakeMinutes - sleepMinutes + 24 * 60) % (24 * 60);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  return (
    <GlassPanel style={{ alignItems: "center", gap: 14 }}>
      <View
        style={{
          height: 220,
          width: 220,
          borderRadius: 110,
          borderWidth: 26,
          borderColor: palette.indigo,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.glass,
        }}
      >
        <Text style={{ color: theme.textPrimary, fontSize: 42, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
          {hours}h {minutes}m
        </Text>
        <Text style={{ color: theme.textSecondary, marginTop: 4, fontSize: 12 }}>sleep duration</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
        <NativeTimeControl label="Bedtime" icon="☾" value={sleepMinutes} color={palette.indigo} onChange={onSleepChange} />
        <NativeTimeControl label="Wake up" icon="☀" value={wakeMinutes} color={palette.orange} onChange={onWakeChange} />
      </View>
      <FallbackNotice />
    </GlassPanel>
  );
}

function NativeTimeControl({
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
  onChange: (value: number) => void;
}) {
  const { theme } = useTwilightTheme();
  const dateValue = useMemo(() => dateFromMinutes(value), [value]);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  return (
    <View style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: color, backgroundColor: theme.glass, padding: 12, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ color, fontSize: 14 }}>{icon}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      </View>
      {Platform.OS === "ios" ? (
        <DateTimePicker
          value={dateValue}
          mode="time"
          display="compact"
          minuteInterval={5}
          accentColor={color}
          onValueChange={(_event, date) => {
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
            <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: "800" }}>
              {formatClock(value)}
            </Text>
          </Pressable>
          {showAndroidPicker ? (
            <DateTimePicker
              value={dateValue}
              mode="time"
              display="spinner"
              minuteInterval={5}
              onValueChange={(_event, date) => {
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
