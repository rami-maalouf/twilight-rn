// Skia-backed chart implementation. Import only through ./index so missing native modules can fall back.
import {
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  matchFont,
  Path,
  rect,
  RoundedRect,
  Skia,
  Text as SkiaText,
  vec,
} from "@shopify/react-native-skia";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { dateFromMinutes, formatClock, formatDuration, formatHours, minutesFromDate } from "@/lib/format";
import { calculateSleepConsistency, calculateWakeConsistency, calculateAccuracy } from "@/lib/sleep";
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
import { chartPalette, GlassPanel, InsightPill, SectionHeader, useTwilightTheme } from "@/ui/surface";
import { chartBounds, clampChart, DEFAULT_FRAME, linearScale, nearestIndex, niceDomain } from "@/charts/chart-scales";

type LineDatum = {
  label: string;
  value: number;
  helper?: string;
};

type BarDatum = {
  label: string;
  value: number;
  helper?: string;
  color?: string;
};

const isAndroid = Platform.OS === "android";
const font11 = matchFont({ fontFamily: isAndroid ? "sans-serif" : "System", fontSize: 11, fontWeight: "500" }) ?? matchFont({ fontSize: 11 });
const font12 = matchFont({ fontFamily: isAndroid ? "sans-serif" : "System", fontSize: 12, fontWeight: "600" }) ?? matchFont({ fontSize: 12 });
const font13 = matchFont({ fontFamily: isAndroid ? "sans-serif" : "System", fontSize: 13, fontWeight: "700" }) ?? matchFont({ fontSize: 13 });

function makeLinePath(points: { x: number; y: number }[]) {
  const builder = Skia.PathBuilder.Make();
  points.forEach((point, index) => {
    if (index === 0) {
      builder.moveTo(point.x, point.y);
    } else {
      builder.lineTo(point.x, point.y);
    }
  });
  return builder.build();
}

function makeAreaPath(points: { x: number; y: number }[], bottom: number) {
  if (points.length === 0) return Skia.Path.Make();
  const builder = Skia.PathBuilder.Make();
  points.forEach((point, index) => {
    if (index === 0) {
      builder.moveTo(point.x, point.y);
    } else {
      builder.lineTo(point.x, point.y);
    }
  });
  builder.lineTo(points[points.length - 1].x, bottom);
  builder.lineTo(points[0].x, bottom);
  builder.close();
  return builder.build();
}

function ChartCanvas({
  height = 210,
  children,
  onSelect,
}: {
  height?: number;
  children: (frame: typeof DEFAULT_FRAME & { width: number; height: number }) => React.ReactNode;
  onSelect?: (x: number) => void;
}) {
  const [width, setWidth] = useState(DEFAULT_FRAME.width);
  const frame = { ...DEFAULT_FRAME, width, height };

  return (
    <View
      style={{ height, width: "100%" }}
      onLayout={(event) => setWidth(Math.max(260, event.nativeEvent.layout.width))}
      onStartShouldSetResponder={() => Boolean(onSelect)}
      onResponderGrant={(event) => onSelect?.(event.nativeEvent.locationX)}
      onResponderMove={(event) => onSelect?.(event.nativeEvent.locationX)}
    >
      <Canvas style={{ flex: 1 }}>{children(frame)}</Canvas>
    </View>
  );
}

function AxisGrid({
  frame,
  yTicks,
  yDomain,
}: {
  frame: typeof DEFAULT_FRAME & { width: number; height: number };
  yTicks: number[];
  yDomain: [number, number];
}) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const bounds = chartBounds(frame);
  return (
    <Group>
      {yTicks.map((tick) => {
        const y = linearScale(tick, yDomain, [bounds.bottom, bounds.top]);
        return (
          <Group key={tick}>
            <Line p1={vec(bounds.left, y)} p2={vec(bounds.right, y)} color={palette.grid} strokeWidth={1} />
            <SkiaText text={`${Math.round(tick)}`} x={4} y={y + 4} font={font11} color={palette.label} />
          </Group>
        );
      })}
    </Group>
  );
}

function LineChart({
  data,
  yDomain,
  yTicks,
  target,
  color,
  height = 210,
  suffix,
}: {
  data: LineDatum[];
  yDomain?: [number, number];
  yTicks?: number[];
  target?: number;
  color?: string;
  height?: number;
  suffix?: string;
}) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const tint = color ?? palette.cyan;
  const domain = yDomain ?? niceDomain(data.map((item) => item.value), [0, 10], 0.16);
  const ticks = yTicks ?? [domain[0], (domain[0] + domain[1]) / 2, domain[1]];
  const [selected, setSelected] = useState(Math.max(0, data.length - 1));

  return (
    <View style={{ gap: 8 }}>
      <ChartCanvas
        height={height}
        onSelect={(x) => {
          const pseudo = data.map((_, index) => ({ x: index }));
          const bounds = chartBounds({ ...DEFAULT_FRAME, width: 320, height });
          const relative = ((x - bounds.left) / Math.max(1, bounds.width)) * Math.max(1, data.length - 1);
          setSelected(clampChart(nearestIndex(pseudo, relative), 0, Math.max(0, data.length - 1)));
        }}
      >
        {(frame) => {
          const bounds = chartBounds(frame);
          const points = data.map((item, index) => ({
            x: linearScale(index, [0, Math.max(1, data.length - 1)], [bounds.left, bounds.right]),
            y: linearScale(item.value, domain, [bounds.bottom, bounds.top]),
          }));
          const path = makeLinePath(points);
          const area = makeAreaPath(points, bounds.bottom);
          const selectedPoint = points[selected];
          return (
            <Group>
              <AxisGrid frame={frame} yTicks={ticks} yDomain={domain} />
              {target != null ? (
                <Line
                  p1={vec(bounds.left, linearScale(target, domain, [bounds.bottom, bounds.top]))}
                  p2={vec(bounds.right, linearScale(target, domain, [bounds.bottom, bounds.top]))}
                  color="rgba(255,255,255,0.36)"
                  strokeWidth={1.5}
                />
              ) : null}
              <Path path={area} opacity={0.22}>
                <LinearGradient start={vec(0, bounds.top)} end={vec(0, bounds.bottom)} colors={[tint, "transparent"]} />
              </Path>
              <Path path={path} color={tint} style="stroke" strokeWidth={3.5} strokeCap="round" strokeJoin="round" />
              {points.map((point, index) => (
                <Circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={index === selected ? 4.5 : 2.3} color={tint} />
              ))}
              {selectedPoint ? (
                <Group>
                  <Line p1={vec(selectedPoint.x, bounds.top)} p2={vec(selectedPoint.x, bounds.bottom)} color="rgba(255,255,255,0.23)" strokeWidth={1} />
                  <Circle cx={selectedPoint.x} cy={selectedPoint.y} r={7} color="rgba(255,255,255,0.2)" />
                </Group>
              ) : null}
              {data.map((item, index) => {
                if (index % Math.ceil(data.length / 4) !== 0 && index !== data.length - 1) return null;
                const x = linearScale(index, [0, Math.max(1, data.length - 1)], [bounds.left, bounds.right]);
                return <SkiaText key={`${item.label}-${index}`} text={item.label} x={x - 15} y={frame.height - 9} font={font11} color={palette.label} />;
              })}
            </Group>
          );
        }}
      </ChartCanvas>
      {data[selected] ? (
        <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: "center" }}>
          {data[selected].label}: <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>{data[selected].value.toFixed(suffix === "%" ? 0 : 1)}{suffix ?? ""}</Text>
          {data[selected].helper ? ` · ${data[selected].helper}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

function BarChart({
  data,
  yDomain,
  yTicks,
  height = 220,
  showValue,
}: {
  data: BarDatum[];
  yDomain?: [number, number];
  yTicks?: number[];
  height?: number;
  showValue?: (value: number) => string;
}) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const domain = yDomain ?? niceDomain(data.map((item) => item.value), [0, 10], 0.16);
  const ticks = yTicks ?? [domain[0], (domain[0] + domain[1]) / 2, domain[1]];

  return (
    <ChartCanvas height={height}>
      {(frame) => {
        const bounds = chartBounds(frame);
        const slot = bounds.width / Math.max(1, data.length);
        const barWidth = Math.max(15, Math.min(30, slot * 0.58));
        return (
          <Group>
            <AxisGrid frame={frame} yTicks={ticks} yDomain={domain} />
            {data.map((item, index) => {
              const x = bounds.left + slot * index + (slot - barWidth) / 2;
              const top = linearScale(item.value, domain, [bounds.bottom, bounds.top]);
              const barHeight = Math.max(2, bounds.bottom - top);
              return (
                <Group key={`${item.label}-${index}`}>
                  <RoundedRect x={x} y={top} width={barWidth} height={barHeight} r={5} color={item.color ?? palette.cyan} />
                  {showValue ? <SkiaText text={showValue(item.value)} x={x - 2} y={Math.max(12, top - 5)} font={font11} color={palette.text} /> : null}
                  <SkiaText text={item.label} x={x - 2} y={frame.height - 10} font={font11} color={palette.label} />
                </Group>
              );
            })}
          </Group>
        );
      }}
    </ChartCanvas>
  );
}

function formatTimeLabel(offset: number, showMinutes = false) {
  const totalMinutes = Math.round((18 + offset) * 60);
  let hour = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  if (hour >= 24) hour -= 24;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  
  if (showMinutes || min > 0) {
    return `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
  }
  return `${displayHour} ${ampm}`;
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
  const [selected, setSelected] = useState(Math.max(0, data.length - 1));

  const sleepTargetOffset = ((optimalSleepMinutes / 60 + 24 - 18) % 24);
  const wakeTargetOffset = ((optimalWakeMinutes / 60 + 24 - 18) % 24);

  const activeData = data.filter((d) => d.duration > 0);
  const allValues = [
    ...activeData.map((d) => d.startOffset),
    ...activeData.map((d) => d.endOffset),
    sleepTargetOffset,
    wakeTargetOffset,
  ];
  let [minY, maxY] = allValues.length > 0
    ? [Math.min(...allValues), Math.max(...allValues)]
    : [4, 14];
  
  minY = Math.max(0, minY - 1);
  maxY = Math.min(24, maxY + 1);
  const domain: [number, number] = [minY, maxY];

  const timeTicks: number[] = [];
  for (let h = Math.floor(minY); h <= Math.ceil(maxY); h++) {
    if (h % 2 === 0) timeTicks.push(h);
  }

  const avgDurationSeconds = activeData.length > 0
    ? activeData.reduce((sum, d) => sum + d.duration, 0) / activeData.length
    : 0;
  const sleepCons = calculateSleepConsistency(data);
  const wakeCons = calculateWakeConsistency(data);
  const accuracy = calculateAccuracy(data, optimalSleepMinutes, optimalWakeMinutes);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 7 }}>
        <InsightPill title="avg sleep" value={formatHours(avgDurationSeconds / 3600)} subtitle="last 7 nights" tint={palette.cyan} />
        <InsightPill title="sleep cons." value={`${sleepCons}%`} subtitle="bedtime rhythm" tint={palette.indigo} />
        <InsightPill title="wake cons." value={`${wakeCons}%`} subtitle="wake rhythm" tint={palette.orange} />
        <InsightPill title="accuracy" value={`${accuracy}%`} subtitle="target match" tint={palette.green} />
      </View>
      <ChartCanvas
        height={245}
        onSelect={(x) => {
          const bounds = chartBounds({ ...DEFAULT_FRAME, paddingRight: 40, width: 320, height: 245 });
          const relative = ((x - bounds.left) / Math.max(1, bounds.width)) * Math.max(1, data.length - 1);
          setSelected(clampChart(Math.round(relative), 0, Math.max(0, data.length - 1)));
        }}
      >
        {(frame) => {
          const frameWithPadding = { ...frame, paddingRight: 45, paddingLeft: 30 };
          const bounds = chartBounds(frameWithPadding);
          const slot = bounds.width / Math.max(1, data.length);
          const barWidth = Math.min(25, slot * 0.56);
          const collisionThreshold = 31 / 60;
          
          return (
            <Group>
              {[0, 4, 8, 12].map(durationTick => {
                const y = linearScale(durationTick, [0, 12], [bounds.bottom, bounds.top]);
                const clashDuration = Math.abs(durationTick - targetDurationHours) < collisionThreshold;
                return (
                  <Group key={`dur-${durationTick}`}>
                    <Line p1={vec(bounds.left, y)} p2={vec(bounds.right, y)} color={palette.grid} strokeWidth={1} />
                    {!clashDuration && (
                      <SkiaText text={`${durationTick}h`} x={4} y={y + 4} font={font11} color={palette.label} />
                    )}
                  </Group>
                );
              })}

              {timeTicks.map(timeTick => {
                const y = linearScale(timeTick, domain, [bounds.top, bounds.bottom]);
                const clashSleep = Math.abs(timeTick - sleepTargetOffset) < collisionThreshold;
                const clashWake = Math.abs(timeTick - wakeTargetOffset) < collisionThreshold;
                
                return (
                  <Group key={`time-${timeTick}`}>
                    {!clashSleep && !clashWake && (
                       <SkiaText text={formatTimeLabel(timeTick)} x={bounds.right + 6} y={y + 4} font={font11} color={palette.cyan} />
                    )}
                  </Group>
                );
              })}

              {(() => {
                const targetY = linearScale(targetDurationHours, [0, 12], [bounds.bottom, bounds.top]);
                const dashes = [];
                for (let i = bounds.left; i < bounds.right; i += 8) {
                  dashes.push(<Line key={`dur-dash-${i}`} p1={vec(i, targetY)} p2={vec(Math.min(i + 4, bounds.right), targetY)} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />);
                }
                return (
                  <Group>
                    <Group>{dashes}</Group>
                    <SkiaText text={`${targetDurationHours.toFixed(1)}h`} x={bounds.left + 2} y={targetY - 4} font={font11} color="rgba(255,255,255,0.6)" />
                  </Group>
                );
              })()}

              {(() => {
                const points = data.map((item, index) => {
                   const x = bounds.left + slot * index + slot / 2;
                   const y = linearScale(item.duration / 3600, [0, 12], [bounds.bottom, bounds.top]);
                   return {x, y, valid: item.duration > 0};
                }).filter(p => p.valid);
                if (points.length === 0) return null;
                const path = makeLinePath(points);
                return (
                  <Group>
                    <Path path={path} color="rgba(255,255,255,0.15)" style="stroke" strokeWidth={2} />
                    {points.map((p, i) => (
                       <Circle key={`point-${i}`} cx={p.x} cy={p.y} r={3} color="rgba(255,255,255,0.3)" />
                    ))}
                  </Group>
                );
              })()}

              {(() => {
                const sleepY = linearScale(sleepTargetOffset, domain, [bounds.top, bounds.bottom]);
                const wakeY = linearScale(wakeTargetOffset, domain, [bounds.top, bounds.bottom]);
                
                const sleepDashes = [];
                const wakeDashes = [];
                for (let i = bounds.left; i < bounds.right; i += 8) {
                  sleepDashes.push(<Line key={`sleep-dash-${i}`} p1={vec(i, sleepY)} p2={vec(Math.min(i + 4, bounds.right), sleepY)} color={palette.indigo} strokeWidth={1.5} />);
                  wakeDashes.push(<Line key={`wake-dash-${i}`} p1={vec(i, wakeY)} p2={vec(Math.min(i + 4, bounds.right), wakeY)} color={palette.orange} strokeWidth={1.5} />);
                }
                
                return (
                  <Group>
                    <Group>{sleepDashes}</Group>
                    <SkiaText text={formatTimeLabel(sleepTargetOffset, true)} x={bounds.right + 6} y={sleepY - 4} font={font11} color={palette.indigo} />
                    
                    <Group>{wakeDashes}</Group>
                    <SkiaText text={formatTimeLabel(wakeTargetOffset, true)} x={bounds.right + 6} y={wakeY - 4} font={font11} color={palette.orange} />
                  </Group>
                );
              })()}

              {data.map((item, index) => {
                const x = bounds.left + slot * index + (slot - barWidth) / 2;
                const top = item.duration > 0 ? linearScale(item.startOffset, domain, [bounds.top, bounds.bottom]) : 0;
                const bottom = item.duration > 0 ? linearScale(item.endOffset, domain, [bounds.top, bounds.bottom]) : 0;
                const yTop = Math.min(top, bottom);
                const yBottom = Math.max(top, bottom);

                return (
                  <Group key={`${item.dayLabel}-${index}`}>
                    {item.duration > 0 ? (
                      <RoundedRect
                        x={x}
                        y={yTop}
                        width={barWidth}
                        height={Math.max(8, yBottom - yTop)}
                        r={5}
                        color={index === selected ? palette.cyan : "rgba(0,212,255,0.78)"}
                      />
                    ) : null}
                    {index === selected ? (
                      <Line p1={vec(x + barWidth / 2, bounds.top)} p2={vec(x + barWidth / 2, bounds.bottom)} color="rgba(255,255,255,0.15)" strokeWidth={1} />
                    ) : null}
                    <SkiaText text={item.dayLabel.slice(0, 3)} x={x - 1} y={frame.height - 18} font={font11} color={palette.label} />
                    <SkiaText text={item.duration > 0 ? formatHours(item.duration / 3600) : "-"} x={x - 2} y={frame.height - 5} font={font11} color={palette.label} />
                  </Group>
                );
              })}
            </Group>
          );
        }}
      </ChartCanvas>
      {data[selected] ? (
        <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: "center" }}>
          {data[selected].dayLabel}: <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>{formatDuration(data[selected].duration)}</Text>
        </Text>
      ) : null}
    </View>
  );
}

export function DurationMomentumChart({ series, targetHours }: { series: SleepMovingAveragePoint[]; targetHours: number }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  const [selected, setSelected] = useState<number | null>(null);

  const displayPoints = useMemo(() => series.filter((p) => p.movingAverageHours != null), [series]);

  if (displayPoints.length === 0) return null;

  const pointToDisplay = selected != null ? displayPoints[selected] : displayPoints[displayPoints.length - 1];
  const selectedIndex = displayPoints.findIndex(p => p.date.getTime() === pointToDisplay.date.getTime());
  const point7dAgo = selectedIndex >= 7 ? displayPoints[selectedIndex - 7] : null;

  const currentAvg = pointToDisplay.movingAverageHours!;
  const prevAvg = point7dAgo?.movingAverageHours ?? currentAvg;
  
  const delta7d = currentAvg - prevAvg;
  const vsTarget = currentAvg - targetHours;

  const minRange = Math.min(...displayPoints.map(p => p.movingAverageHours!));
  const maxRange = Math.max(...displayPoints.map(p => p.movingAverageHours!));

  const formatSignedHours = (val: number) => {
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toFixed(1)}h`;
  };

  const deltaColor = delta7d > 0 ? palette.green : (delta7d < 0 ? palette.orange : theme.textSecondary);
  const targetColor = vsTarget >= 0 ? palette.green : palette.orange;

  const yDomain: [number, number] = [
    Math.min(targetHours - 0.5, Math.floor(minRange * 2) / 2),
    Math.max(targetHours + 0.5, Math.ceil(maxRange * 2) / 2)
  ];
  const yTicks = [];
  for (let i = yDomain[0]; i <= yDomain[1]; i += 0.5) yTicks.push(i);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 7 }}>
        <InsightPill 
          title="VS 7D AGO" 
          value={formatSignedHours(delta7d)} 
          subtitle={Math.abs(delta7d) < 0.1 ? "Stable" : (delta7d > 0 ? "Improving" : "Declining")} 
          tint={deltaColor} 
        />
        <InsightPill 
          title="VS TARGET" 
          value={formatSignedHours(vsTarget)} 
          subtitle={vsTarget >= 0 ? "Above target" : "Below target"} 
          tint={targetColor} 
        />
        <InsightPill 
          title="RANGE" 
          value={`${minRange.toFixed(1)}-${maxRange.toFixed(1)}h`} 
          subtitle="selected span" 
          tint={palette.cyan} 
        />
      </View>

      <ChartCanvas 
        height={245}
        onSelect={(x) => {
          const bounds = chartBounds({ width: 320, height: 245, paddingTop: 10, paddingBottom: 25, paddingLeft: 30, paddingRight: 10 });
          const slot = bounds.width / Math.max(1, displayPoints.length);
          const relative = (x - bounds.left) / slot;
          setSelected(clampChart(Math.floor(relative), 0, Math.max(0, displayPoints.length - 1)));
        }}
      >
        {(frame) => {
          const bounds = chartBounds(frame);
          const slot = bounds.width / Math.max(1, displayPoints.length);
          const targetY = linearScale(targetHours, yDomain, [bounds.bottom, bounds.top]);

          return (
            <Group>
              <AxisGrid frame={frame} yTicks={yTicks} yDomain={yDomain} suffix="h" />

              {/* Target rule mark */}
              {(() => {
                 const dashes = [];
                 for (let i = bounds.left; i < bounds.right; i += 8) {
                   dashes.push(<Line key={`target-dash-${i}`} p1={vec(i, targetY)} p2={vec(Math.min(i + 4, bounds.right), targetY)} color="rgba(255, 255, 255, 0.4)" strokeWidth={1.2} />);
                 }
                 return <Group>{dashes}</Group>;
              })()}

              {/* Area Fill */}
              {(() => {
                const areaPath = Skia.PathBuilder.Make();
                displayPoints.forEach((point, index) => {
                  const x = bounds.left + slot * index + slot / 2;
                  const y = linearScale(point.movingAverageHours!, yDomain, [bounds.bottom, bounds.top]);
                  if (index === 0) {
                    areaPath.moveTo(x, targetY);
                    areaPath.lineTo(x, y);
                  } else {
                    areaPath.lineTo(x, y);
                  }
                });
                const lastX = bounds.left + slot * (displayPoints.length - 1) + slot / 2;
                areaPath.lineTo(lastX, targetY);
                areaPath.close();
                
                const ratio = Math.max(0, Math.min(1, (targetY - bounds.top) / bounds.height));
                
                return (
                  <Path path={areaPath.detach()}>
                    <LinearGradient
                      start={vec(0, bounds.top)}
                      end={vec(0, bounds.bottom)}
                      colors={[
                        "rgba(52, 199, 89, 0.25)",
                        "rgba(52, 199, 89, 0.25)",
                        "rgba(255, 149, 0, 0.25)",
                        "rgba(255, 149, 0, 0.25)"
                      ]}
                      positions={[0, ratio, ratio, 1]}
                    />
                  </Path>
                );
              })()}

              {/* Trend Line */}
              {(() => {
                const linePath = Skia.PathBuilder.Make();
                displayPoints.forEach((point, index) => {
                  const x = bounds.left + slot * index + slot / 2;
                  const y = linearScale(point.movingAverageHours!, yDomain, [bounds.bottom, bounds.top]);
                  if (index === 0) linePath.moveTo(x, y);
                  else linePath.lineTo(x, y);
                });
                return <Path path={linePath.detach()} color={palette.cyan} style="stroke" strokeWidth={3} />;
              })()}

              {/* Selected Point Marker */}
              {(() => {
                 if (selected == null) return null;
                 const point = displayPoints[selected];
                 const x = bounds.left + slot * selected + slot / 2;
                 const y = linearScale(point.movingAverageHours!, yDomain, [bounds.bottom, bounds.top]);
                 
                 const dashes = [];
                 for (let yDash = bounds.top; yDash < bounds.bottom; yDash += 5) {
                   dashes.push(<Line key={`vdash-${yDash}`} p1={vec(x, yDash)} p2={vec(x, Math.min(yDash + 2, bounds.bottom))} color="rgba(255,255,255,0.4)" strokeWidth={1} />);
                 }

                 return (
                   <Group>
                     {dashes}
                     <Circle cx={x} cy={y} r={6} color="white" />
                   </Group>
                 );
              })()}

              {/* X Axis Labels */}
              {displayPoints.map((point, index) => {
                if (index % Math.ceil(displayPoints.length / 4) !== 0 && index !== displayPoints.length - 1) return null;
                const x = bounds.left + slot * index + slot / 2;
                const label = point.date.toLocaleDateString([], { month: "short", day: "numeric" });
                return <SkiaText key={`label-${index}`} text={label} x={x - 15} y={frame.height - 9} font={font11} color={palette.label} />;
              })}
            </Group>
          );
        }}
      </ChartCanvas>

      <View style={{ marginTop: 4, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.green }} />
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Above Target</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.orange }} />
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Below Target</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {pointToDisplay.date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              {formatSignedHours(delta7d)} vs 7d ago
            </Text>
          </View>
          
          <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: "600", textAlign: "right" }}>
            Avg {currentAvg.toFixed(1)}h <Text style={{ color: theme.textSecondary }}>•</Text>{" "}
            <Text style={{ color: targetColor }}>
              {formatSignedHours(vsTarget)} vs target
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

export function MovingAverageChart(props: { series: SleepMovingAveragePoint[]; targetHours: number }) {
  return <DurationMomentumChart {...props} />;
}

export function RollingConsistencyChart({ series }: { series: SleepConsistencyPoint[] }) {
  const data = series
    .map((point) => {
      const values = [point.sleepConsistency, point.wakeConsistency, point.scheduleAccuracy].filter((value): value is number => value != null);
      return {
        label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
        value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      };
    })
    .filter((point) => point.value > 0);
  return <LineChart data={data} yDomain={[50, 92]} yTicks={[50, 60, 70, 80, 90]} target={80} suffix="%" />;
}

export function RegularityComponentsChart({
  series,
  component,
}: {
  series: SleepConsistencyPoint[];
  component: "All" | "Bedtime" | "Wake" | "Accuracy";
}) {
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
  return <LineChart data={data} yDomain={[50, 96]} yTicks={[50, 60, 70, 80, 90]} suffix="%" color={component === "Wake" ? "#FFB347" : component === "Accuracy" ? "#00FF88" : "#7B68EE"} />;
}

export function CumulativeDebtChart({ series }: { series: SleepDebtPoint[] }) {
  const data = series.map((point) => ({
    label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
    value: point.cumulativeHours,
  }));
  const domain = niceDomain(data.map((item) => item.value), [-4, 4], 0.2);
  return <LineChart data={data} yDomain={domain} yTicks={[domain[0], 0, domain[1]]} suffix="h" color="#34C759" />;
}

export function WeekdayAverageChart({ days }: { days: SleepWeekdayAverage[] }) {
  const { theme } = useTwilightTheme();
  const palette = chartPalette(theme);
  return (
    <BarChart
      data={days.map((day, index) => ({
        label: day.dayName.slice(0, 3),
        value: day.averageHours,
        color: index === 0 || index === 6 ? palette.pink : palette.cyan,
      }))}
      yDomain={[0, 10]}
      yTicks={[0, 5, 10]}
      showValue={(value) => value.toFixed(1)}
    />
  );
}

export function DurationDistributionChart({ buckets }: { buckets: SleepDurationBucket[] }) {
  return (
    <BarChart
      data={buckets.map((bucket) => ({ label: bucket.label, value: Math.round(bucket.share * 100) }))}
      yDomain={[0, Math.max(40, ...buckets.map((bucket) => Math.round(bucket.share * 100)))]}
      yTicks={[0, 10, 20, 30, 40]}
      showValue={(value) => `${Math.round(value)}%`}
    />
  );
}

export function TrendSparkline({ values, color }: { values: number[]; color?: string }) {
  return <LineChart data={values.map((value, index) => ({ label: `${index + 1}`, value }))} height={54} color={color} />;
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
      <View style={{ gap: 0 }}>
        <View style={{ flexDirection: "row", paddingBottom: 8 }}>
          <Text style={{ flex: 0.7, color: theme.textSecondary, fontSize: 12 }}>Period</Text>
          <Text style={{ flex: 0.85, color: theme.textSecondary, fontSize: 12 }}>Average</Text>
          <Text style={{ flex: 0.75, color: theme.textSecondary, fontSize: 12 }}>Change</Text>
          <Text style={{ flex: 1, color: theme.textSecondary, fontSize: 12, textAlign: "right" }}>Trend</Text>
        </View>
        {periods.map((period) => {
          const positive = (period.changePercent ?? 0) >= 0;
          return (
            <View
              key={period.days}
              style={{
                minHeight: 48,
                borderTopWidth: 1,
                borderTopColor: theme.outline,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ flex: 0.7, color: theme.textSecondary, fontSize: 14 }}>{period.days}-day</Text>
              <Text style={{ flex: 0.85, color: theme.textPrimary, fontSize: 14, fontWeight: "800" }}>{period.averageDuration == null ? "-" : formatHours(period.averageDuration)}</Text>
              <Text style={{ flex: 0.75, color: positive ? palette.cyan : palette.orange, fontSize: 14, fontWeight: "800" }}>{period.changePercent == null ? "-" : `${positive ? "+" : ""}${Math.round(period.changePercent)}%`}</Text>
              <View style={{ flex: 1, height: 34 }}>
                <Sparkline values={period.sparkline} color={period.days <= 14 ? palette.indigo : palette.cyan} />
              </View>
            </View>
          );
        })}
      </View>
    </GlassPanel>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  return (
    <ChartCanvas height={34}>
      {(frame) => {
        const bounds = { left: 0, right: frame.width, top: 4, bottom: 30, width: frame.width, height: 26 };
        const domain = niceDomain(values, [0, 10], 0.12);
        const points = values.map((value, index) => ({
          x: linearScale(index, [0, Math.max(1, values.length - 1)], [bounds.left, bounds.right]),
          y: linearScale(value, domain, [bounds.bottom, bounds.top]),
        }));
        return <Path path={makeLinePath(points)} color={color} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" />;
      }}
    </ChartCanvas>
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
  const targetScore = 70;

  const [selected, setSelected] = useState<number | null>(null);

  const displayPoints = useMemo(() => {
    let previousTrend: number | null = null;
    return series.map((point) => {
      const daily = coreOnly ? point.coreScore : point.dailyScore;
      const trend = previousTrend != null ? 0.8 * previousTrend + 0.2 * daily : daily;
      previousTrend = trend;
      return {
        ...point,
        displayDaily: Math.round(daily),
        displayTrend: Math.round(trend),
      };
    });
  }, [series, coreOnly]);

  const currentTargetStreak = useMemo(() => {
    let streak = 0;
    for (let i = displayPoints.length - 1; i >= 0; i--) {
      if (displayPoints[i].displayDaily >= targetScore) streak++;
      else break;
    }
    return streak;
  }, [displayPoints]);

  const bestTargetStreak = useMemo(() => {
    let current = 0;
    let best = 0;
    for (const p of displayPoints) {
      if (p.displayDaily >= targetScore) {
        current++;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    return best;
  }, [displayPoints]);

  const yDomain: [number, number] = [0, 100];
  const yTicks = [0, 25, 50, 70, 100];

  if (displayPoints.length === 0) return null;

  const pointToDisplay = selected != null ? displayPoints[selected] : displayPoints[displayPoints.length - 1];
  const prevPointIndex = selected != null ? selected - 1 : displayPoints.length - 2;
  const prevPoint = displayPoints[prevPointIndex];
  const selectedDailyDelta = prevPoint ? pointToDisplay.displayDaily - prevPoint.displayDaily : 0;
  
  const trendDirectionText = pointToDisplay.displayTrend >= (prevPoint?.displayTrend ?? 0) ? "Improving" : "Declining";
  const trendColor = pointToDisplay.displayTrend >= targetScore ? palette.green : palette.orange;

  const components = [
    { title: "Duration", score: pointToDisplay.durationScore, tint: palette.cyan },
    { title: "Consistency", score: pointToDisplay.consistencyScore, tint: palette.orange },
  ];
  if (!coreOnly) {
    components.splice(1, 0, { title: "Timing", score: pointToDisplay.timingScore, tint: palette.green });
    components.splice(2, 0, { title: "Phase", score: pointToDisplay.phaseScore, tint: palette.indigo });
  }
  const weakestComponent = components.reduce((min, c) => c.score < min.score ? c : min, components[0]);

  const MetricBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 13, width: 85 }}>{label}</Text>
      <View style={{ flex: 1, height: 4, backgroundColor: theme.outline, borderRadius: 2, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", backgroundColor: color, borderRadius: 2 }} />
      </View>
      <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: "600", width: 28, textAlign: "right", fontVariant: ["tabular-nums"] }}>{Math.round(value)}</Text>
    </View>
  );

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 7 }}>
        <InsightPill 
          title="DAILY" 
          value={`${pointToDisplay.displayDaily}`} 
          subtitle={`${selectedDailyDelta >= 0 ? "+" : ""}${selectedDailyDelta}`} 
          tint={palette.cyan} 
        />
        <InsightPill 
          title="TREND" 
          value={`${pointToDisplay.displayTrend}`} 
          subtitle={trendDirectionText} 
          tint={trendColor} 
        />
        <InsightPill 
          title="MAIN DRAG" 
          value={weakestComponent.title} 
          subtitle={`${Math.round(weakestComponent.score)}`} 
          tint={weakestComponent.tint} 
        />
        <InsightPill 
          title=" " 
          value={`🔥 ${currentTargetStreak}`} 
          subtitle={bestTargetStreak > 0 ? `best ${bestTargetStreak}d` : "hit 70+"} 
          tint={palette.orange} 
        />
      </View>

      <ChartCanvas 
        height={245}
        onSelect={(x) => {
          const bounds = chartBounds({ width: 320, height: 245, paddingTop: 10, paddingBottom: 25, paddingLeft: 30, paddingRight: 10 });
          const slot = bounds.width / Math.max(1, displayPoints.length);
          const relative = (x - bounds.left) / slot;
          setSelected(clampChart(Math.floor(relative), 0, Math.max(0, displayPoints.length - 1)));
        }}
      >
      {(frame) => {
        const bounds = chartBounds(frame);
        const slot = bounds.width / Math.max(1, displayPoints.length);
        const barWidth = Math.min(25, slot * 0.56);

        return (
          <Group>
            <AxisGrid frame={frame} yTicks={yTicks} yDomain={yDomain} />

            {(() => {
               const targetY = linearScale(targetScore, yDomain, [bounds.bottom, bounds.top]);
               const dashes = [];
               for (let i = bounds.left; i < bounds.right; i += 8) {
                 dashes.push(<Line key={`target-dash-${i}`} p1={vec(i, targetY)} p2={vec(Math.min(i + 4, bounds.right), targetY)} color="rgba(52, 199, 89, 0.65)" strokeWidth={1.2} />);
               }
               return <Group>{dashes}</Group>;
            })()}

            {displayPoints.map((point, index) => {
              const x = bounds.left + slot * index + (slot - barWidth) / 2;
              const y = linearScale(point.displayDaily, yDomain, [bounds.bottom, bounds.top]);
              const color = point.displayDaily >= targetScore ? "rgba(52, 199, 89, 0.68)" : "rgba(255, 149, 0, 0.65)";
              return (
                <RoundedRect
                  key={`bar-${index}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, bounds.bottom - y)}
                  r={4}
                  color={color}
                />
              );
            })}

            {(() => {
               if (displayPoints.length === 0) return null;
               const path = Skia.PathBuilder.Make();
               displayPoints.forEach((point, index) => {
                 const x = bounds.left + slot * index + slot / 2;
                 const y = linearScale(point.displayTrend, yDomain, [bounds.bottom, bounds.top]);
                 if (index === 0) path.moveTo(x, y);
                 else path.lineTo(x, y);
               });
               return <Path path={path.detach()} color={palette.cyan} style="stroke" strokeWidth={3} />;
            })()}

            {(() => {
               if (selected == null) return null;
               const point = displayPoints[selected];
               const x = bounds.left + slot * selected + slot / 2;
               const y = linearScale(point.displayTrend, yDomain, [bounds.bottom, bounds.top]);
               
               const dashes = [];
               for (let yDash = bounds.top; yDash < bounds.bottom; yDash += 5) {
                 dashes.push(<Line key={`vdash-${yDash}`} p1={vec(x, yDash)} p2={vec(x, Math.min(yDash + 2, bounds.bottom))} color="rgba(255,255,255,0.4)" strokeWidth={1} />);
               }

               return (
                 <Group>
                   {dashes}
                   <Circle cx={x} cy={y} r={6} color="white" />
                 </Group>
               );
            })()}

            {displayPoints.map((point, index) => {
              if (index % Math.ceil(displayPoints.length / 4) !== 0 && index !== displayPoints.length - 1) return null;
              const x = bounds.left + slot * index + slot / 2;
              const label = point.date.toLocaleDateString([], { month: "short", day: "numeric" });
              return <SkiaText key={`label-${index}`} text={label} x={x - 15} y={frame.height - 9} font={font11} color={palette.label} />;
            })}
          </Group>
        );
      }}
    </ChartCanvas>

    <View style={{ gap: 2, marginTop: 4, paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {pointToDisplay.date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </Text>
        <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: "600" }}>
          Score {pointToDisplay.displayDaily} <Text style={{ color: theme.textSecondary }}>•</Text>{" "}
          <Text style={{ color: pointToDisplay.displayDaily >= targetScore ? palette.green : palette.orange }}>
            {pointToDisplay.displayDaily >= targetScore ? "+" : ""}{pointToDisplay.displayDaily - targetScore} vs target
          </Text>
        </Text>
      </View>
      {components.map((c) => (
        <MetricBar key={c.title} label={c.title} value={c.score} color={c.tint} />
      ))}
    </View>
  </View>
  );
}

export function TimingTimelineChart({ series }: { series: SleepTimingPoint[] }) {
  const data = series.map((point) => ({
    label: point.date.toLocaleDateString([], { month: "short", day: "numeric" }),
    value: point.bedtimeOffset,
    helper: `wake ${point.wakeOffset.toFixed(1)}`,
  }));
  return <LineChart data={data} yDomain={[0, 16]} yTicks={[0, 4, 8, 12, 16]} color="#7B68EE" />;
}

export function SleepWindowDialChart({
  sleepMinutes,
  wakeMinutes,
  onSleepChange,
  onWakeChange,
  size = 280,
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
  const radius = size / 2 - 38;
  const center = size / 2;
  const sleepAngle = (sleepMinutes / (24 * 60)) * 360 - 90;
  const sweep = durationMinutes / (24 * 60) * 360;
  const arcPath = useMemo(() => {
    return Skia.PathBuilder.Make()
      .addArc(rect(center - radius, center - radius, radius * 2, radius * 2), sleepAngle, sweep)
      .build();
  }, [center, radius, sleepAngle, sweep]);
  const knob = (minutes: number) => {
    const angle = (minutes / (24 * 60)) * Math.PI * 2 - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  };
  const sleepKnob = knob(sleepMinutes);
  const wakeKnob = knob(wakeMinutes);
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  const healthy = h >= 7 && h <= 9;

  return (
    <GlassPanel style={{ alignItems: "center", gap: 14 }}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={center} cy={center} r={radius + 22} color="rgba(123,104,238,0.10)" />
        <Circle cx={center} cy={center} r={radius} color="rgba(255,255,255,0.08)" style="stroke" strokeWidth={38} />
        <Path path={arcPath} style="stroke" strokeWidth={38} strokeCap="round">
          <LinearGradient start={vec(sleepKnob.x, sleepKnob.y)} end={vec(wakeKnob.x, wakeKnob.y)} colors={[palette.indigo, "#f093fb", palette.orange]} />
        </Path>
        {[0, 6, 12, 18].map((hour) => {
          const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
          const x = center + Math.cos(angle) * (radius + 33);
          const y = center + Math.sin(angle) * (radius + 33);
          return <SkiaText key={hour} text={hour === 0 ? "12" : `${hour}`} x={x - 7} y={y + 4} font={font12} color={palette.label} />;
        })}
        <Circle cx={sleepKnob.x} cy={sleepKnob.y} r={25} color="#F9FAFB" />
        <Circle cx={wakeKnob.x} cy={wakeKnob.y} r={25} color="#F9FAFB" />
        <SkiaText text="☾" x={sleepKnob.x - 7} y={sleepKnob.y + 8} font={font13} color={palette.indigo} />
        <SkiaText text="☀" x={wakeKnob.x - 8} y={wakeKnob.y + 7} font={font13} color={palette.orange} />
        <SkiaText text={`${h}`} x={center - 49} y={center - 3} font={matchFont({ fontSize: 46, fontWeight: "800" })} color={healthy ? palette.green : palette.text} />
        <SkiaText text="h" x={center - 11} y={center - 2} font={font13} color={palette.label} />
        <SkiaText text={`${m}`} x={center + 7} y={center - 3} font={matchFont({ fontSize: 46, fontWeight: "800" })} color={healthy ? palette.green : palette.text} />
        <SkiaText text="m" x={center + 49} y={center - 2} font={font13} color={palette.label} />
        <SkiaText text="sleep duration" x={center - 44} y={center + 24} font={font12} color={palette.label} />
      </Canvas>
      <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
        <NativeTimeControl label="Bedtime" icon="☾" value={sleepMinutes} color={palette.indigo} onChange={onSleepChange} />
        <NativeTimeControl label="Wake up" icon="☀" value={wakeMinutes} color={palette.orange} onChange={onWakeChange} />
      </View>
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
          onValueChange={(date) => {
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
              onValueChange={(date) => {
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
