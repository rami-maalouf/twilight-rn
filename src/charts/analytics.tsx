import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import { formatClock, formatSignedHours } from "@/lib/format";
import { buildSleepMetrics, clipSleepSeries } from "@/lib/sleep";
import type { SleepMetricsRange, SleepNightRecord } from "@/lib/types";
import type { SleepRegularityWindow } from "@/lib/sleep-regularity";
import { SectionHeader, chartPalette, useTwilightTheme } from "@/ui/surface";

export function AnalyticsSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { theme } = useTwilightTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <SegmentedControl
        values={[...options]}
        selectedIndex={options.indexOf(value)}
        onChange={(event) =>
          onChange(options[event.nativeEvent.selectedSegmentIndex])
        }
        tintColor={theme.textPrimary}
        style={{ flex: 1, minWidth: options.length * 64, minHeight: 44 }}
      />
    </ScrollView>
  );
}

type Metrics = ReturnType<typeof buildSleepMetrics>;
type PlotPoint = { date: Date; values: (number | null)[]; summary: string };

// a native svg plot keeps selection and text readouts available without skia.
function SelectablePlot({
  points,
  colors,
  labels,
  domain,
}: {
  points: PlotPoint[];
  colors: string[];
  labels: string[];
  domain?: [number, number];
}) {
  const { theme } = useTwilightTheme();
  const [selection, setSelection] = useState<{ date: number } | null>(null);
  const [width, setWidth] = useState(1);
  const finite = points.flatMap((point) =>
    point.values.filter((v): v is number => v != null),
  );
  if (!points.length)
    return (
      <Text style={{ color: theme.textSecondary }}>
        No completed nights in this range.
      </Text>
    );
  const selectedIndex =
    selection == null
      ? points.length - 1
      : Math.max(
          0,
          points.findIndex((p) => +p.date === selection.date),
        );
  const selected = points[selectedIndex];
  const min = domain?.[0] ?? Math.min(...finite, 0);
  const max = Math.max(min + 1, domain?.[1] ?? Math.max(...finite, 1));
  const x = (index: number) =>
    10 + (index / Math.max(1, points.length - 1)) * 280;
  const y = (value: number) => 130 - ((value - min) / (max - min)) * 120;
  const choose = (index: number) =>
    setSelection({
      date: +points[Math.max(0, Math.min(points.length - 1, index))].date,
    });
  return (
    <View style={{ gap: 10 }}>
      <Text
        selectable
        accessibilityLiveRegion="polite"
        style={{ color: theme.textPrimary, fontSize: 14, lineHeight: 21 }}
      >
        {selected.date.toLocaleDateString()}: {selected.summary}
      </Text>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) =>
          choose(
            Math.round(
              (((event.nativeEvent.locationX / width) * 300 - 10) / 280) *
                (points.length - 1),
            ),
          )
        }
        onResponderMove={(event) =>
          choose(
            Math.round(
              (((event.nativeEvent.locationX / width) * 300 - 10) / 280) *
                (points.length - 1),
            ),
          )
        }
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={labels.join(" and ")}
        accessibilityValue={{ text: selected.summary }}
        accessibilityActions={[
          { name: "increment", label: "Next day" },
          { name: "decrement", label: "Previous day" },
        ]}
        onAccessibilityAction={(event) =>
          choose(
            selectedIndex +
              (event.nativeEvent.actionName === "increment" ? 1 : -1),
          )
        }
      >
        <Svg width="100%" height={150} viewBox="0 0 300 150">
          <Line x1={10} y1={130} x2={290} y2={130} stroke={theme.outline} />
          {colors.flatMap((color, component) => {
            const segments: string[][] = [[]];
            points.forEach((point, index) => {
              const value = point.values[component];
              if (value == null) {
                if (segments.at(-1)!.length) segments.push([]);
              } else segments.at(-1)!.push(`${x(index)},${y(value)}`);
            });
            return segments
              .filter((segment) => segment.length)
              .map((segment, i) => (
                <Polyline
                  key={`${component}-${i}`}
                  points={segment.join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ));
          })}
          {selected.values.map((value, index) =>
            value == null ? null : (
              <Circle
                key={index}
                cx={x(selectedIndex)}
                cy={y(value)}
                r={3}
                fill={colors[index]}
              />
            ),
          )}
          <Line
            x1={x(selectedIndex)}
            y1={8}
            x2={x(selectedIndex)}
            y2={135}
            stroke={theme.textSecondary}
            strokeDasharray="3 3"
          />
        </Svg>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {labels.map((label, i) => (
          <Text key={label} style={{ color: colors[i], fontSize: 12 }}>
            {label}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {(
          [
            [-1, "Previous day"],
            [1, "Next day"],
          ] as const
        ).map(([delta, label]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            disabled={
              selectedIndex + delta < 0 ||
              selectedIndex + delta >= points.length
            }
            onPress={() => choose(selectedIndex + delta)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              opacity:
                selectedIndex + delta < 0 ||
                selectedIndex + delta >= points.length
                  ? 0.4
                  : 1,
            }}
          >
            <Text style={{ color: theme.textPrimary }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function SleepRegularityCard({
  metrics,
  range,
}: {
  metrics: Metrics;
  range: SleepMetricsRange;
}) {
  const [windowLabel, setWindowLabel] = useState<"7D" | "14D" | "28D">("7D");
  const window = parseInt(windowLabel, 10) as SleepRegularityWindow;
  const series = metrics.sleepRegularitySeries(range, window);
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader
        title="Sleep Regularity Index"
        subtitle="Agreement between sleep and awake states 24 hours apart. Includes naps; missing days and daylight-saving transitions remain gaps."
        compact
      />
      <AnalyticsSelector
        options={["7D", "14D", "28D"]}
        value={windowLabel}
        onChange={setWindowLabel}
      />
      {series.at(-1)?.rollingScore == null ? (
        <Text style={{ color: theme.textSecondary }}>
          Insufficient current data. A {window}-day SRI needs {window - 1}{" "}
          consecutive adjacent-day comparisons.
        </Text>
      ) : null}
      <SelectablePlot
        key={`${range}-${window}`}
        colors={[palette.cyan, palette.indigo]}
        labels={["Day-to-day", `${window}-day SRI`]}
        domain={[-100, 100]}
        points={series.map((point) => ({
          date: point.date,
          values: [point.dayToDayScore, point.rollingScore],
          summary: `SRI ${point.rollingScore == null ? "insufficient data" : point.rollingScore.toFixed(1)}; day-to-day ${point.dayToDayScore?.toFixed(1) ?? "unknown"}; ${point.comparisonDays}/${window - 1} comparisons`,
        }))}
      />
      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
        Session-based estimate. Unlogged time on recorded days is assumed awake.
        Scores range from -100 to 100.
      </Text>
    </View>
  );
}

export function SleepTimeCard({
  metrics,
  records,
}: {
  metrics: Metrics;
  records: SleepNightRecord[];
}) {
  const [mode, setMode] = useState<"Sleep" | "Wake" | "Both">("Both");
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const sleep = clipSleepSeries(
    metrics.timingMovingAverageSeries(metrics.records, "bedtimeOffset"),
    records,
  );
  const wake = clipSleepSeries(
    metrics.timingMovingAverageSeries(metrics.records, "wakeOffset"),
    records,
  );
  const clock = (offset: number | null) =>
    offset == null
      ? "pending"
      : formatClock(Math.round((offset + 18) * 60) % 1440);
  const delta = (actual: number, target: number) =>
    formatSignedHours(((actual - target + 36) % 24) - 12);
  const showSleep = mode !== "Wake";
  const showWake = mode !== "Sleep";
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader
        title="Sleep / Wake Time"
        subtitle="Actual times and 7-night averages, compared with your targets."
        compact
      />
      <AnalyticsSelector
        options={["Sleep", "Wake", "Both"]}
        value={mode}
        onChange={setMode}
      />
      <SelectablePlot
        key={mode}
        colors={[
          ...(showSleep ? [palette.indigo, palette.cyan] : []),
          ...(showWake ? [palette.orange, palette.green] : []),
        ]}
        labels={[
          ...(showSleep ? ["Sleep", "Sleep average"] : []),
          ...(showWake ? ["Wake", "Wake average"] : []),
        ]}
        points={sleep.map((point, i) => ({
          date: point.date,
          values: [
            ...(showSleep
              ? [point.actualOffset, point.movingAverageOffset]
              : []),
            ...(showWake
              ? [wake[i].actualOffset, wake[i].movingAverageOffset]
              : []),
          ],
          summary: [
            showSleep
              ? `Sleep ${clock(point.actualOffset)}, average ${clock(point.movingAverageOffset)}, ${delta(point.actualOffset, metrics.targetSleepOffset)} vs target`
              : "",
            showWake
              ? `Wake ${clock(wake[i].actualOffset)}, average ${clock(wake[i].movingAverageOffset)}, ${delta(wake[i].actualOffset, metrics.targetWakeOffset)} vs target`
              : "",
          ]
            .filter(Boolean)
            .join(". "),
        }))}
      />
    </View>
  );
}
