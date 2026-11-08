import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Fragment, useMemo } from "react";
import {
  useColorScheme,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { formatClock, formatDuration, formatHours, formatTime } from "@/lib/format";
import { getTheme } from "@/lib/theme";
import { useAppStore } from "@/lib/store";

type ButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  subtle?: boolean;
  icon?: string;
};

export function AppScreen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  const insets = useSafeAreaInsets();
  const topPadding = 8;
  const bottomPadding = 96;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      <LinearGradient
        colors={[theme.backgroundStart, theme.backgroundEnd]}
        style={StyleSheet.absoluteFill}
      />
      <Starfield />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
            rowGap: 16,
          }}
          scrollIndicatorInsets={{ top: insets.top, bottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <BlurView
      intensity={24}
      tint={appearance.themeMode === "Sunset" ? "light" : "dark"}
      className={`overflow-hidden rounded-[28px] border px-4 py-4 ${className}`}
      style={{
        backgroundColor: theme.card,
        borderColor: theme.outline,
      }}
    >
      {children}
    </BlurView>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  subtle,
  icon,
}: ButtonProps) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  const background = subtle ? theme.glass : theme.accent;
  const color = subtle ? theme.textPrimary : appearance.themeMode === "Sunset" ? "#FFFFFF" : "#06131B";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="rounded-full px-5 py-4"
      style={{
        backgroundColor: disabled ? `${background}66` : background,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <Text
        style={{ color }}
        className="text-center text-base font-semibold"
      >
        {icon ? `${icon} ` : ""}
        {title}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <View className="flex-row items-end justify-between gap-4">
      <View className="flex-1">
        <Text style={{ color: theme.textPrimary }} className="text-2xl font-bold">
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: theme.textSecondary }} className="mt-1 text-sm leading-5">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <View
      className="flex-row rounded-full p-1"
      style={{ backgroundColor: theme.cardMuted, borderColor: theme.outline, borderWidth: 1 }}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            className="flex-1 rounded-full px-3 py-2"
            style={{ backgroundColor: active ? theme.accent : "transparent" }}
            onPress={() => onChange(option)}
          >
            <Text
              style={{
                color: active ? (appearance.themeMode === "Sunset" ? "#FFFFFF" : "#06131B") : theme.textSecondary,
              }}
              className="text-center text-sm font-semibold"
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatGrid({
  items,
}: {
  items: { label: string; value: string; tone?: string; helper?: string }[];
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map((item) => (
        <View
          key={item.label}
          className="min-w-[47%] flex-1 rounded-[22px] border px-4 py-4"
          style={{
            backgroundColor: theme.cardMuted,
            borderColor: theme.outline,
          }}
        >
          <Text style={{ color: theme.textSecondary }} className="text-xs uppercase tracking-[1.4px]">
            {item.label}
          </Text>
          <Text
            style={{ color: item.tone ?? theme.textPrimary }}
            className="mt-2 text-2xl font-bold"
          >
            {item.value}
          </Text>
          {item.helper ? (
            <Text style={{ color: theme.textSecondary }} className="mt-1 text-xs">
              {item.helper}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <GlassCard className="items-center py-10">
      <Text style={{ color: theme.textPrimary }} className="text-xl font-semibold">
        {title}
      </Text>
      <Text style={{ color: theme.textSecondary }} className="mt-3 text-center text-sm leading-6">
        {subtitle}
      </Text>
    </GlassCard>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <View className="flex-row items-center gap-4 py-3">
      <View className="flex-1">
        <Text style={{ color: theme.textPrimary }} className="text-base font-semibold">
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: theme.textSecondary }} className="mt-1 text-sm leading-5">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.accent, false: "#475569" }}
      />
    </View>
  );
}

export function InputRow({
  label,
  value,
  placeholder,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <View className="gap-2">
      <Text style={{ color: theme.textSecondary }} className="text-xs uppercase tracking-[1.4px]">
        {label}
      </Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={`${theme.textSecondary}AA`}
        onChangeText={onChangeText}
        multiline={multiline}
        style={{
          backgroundColor: theme.cardMuted,
          color: theme.textPrimary,
          borderColor: theme.outline,
          minHeight: multiline ? 120 : 56,
          textAlignVertical: multiline ? "top" : "center",
        }}
        className="rounded-[20px] border px-4 py-4 text-base"
      />
    </View>
  );
}

export function MiniTrendChart({
  values,
  height = 140,
}: {
  values: number[];
  height?: number;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  const width = 320;
  const safeValues = values.length > 0 ? values : [0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(0.1, max - min);
  const points = safeValues.map((value, index) => {
    const x = (index / Math.max(1, safeValues.length - 1)) * (width - 24) + 12;
    const y = height - 12 - ((value - min) / range) * (height - 24);
    return `${x},${y}`;
  });

  return (
    <Svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <Path
        d={`M ${points.join(" L ")}`}
        stroke={theme.accent}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => {
        const [cx, cy] = point.split(",").map(Number);
        return <Circle key={`${point}-${index}`} cx={cx} cy={cy} r={3.5} fill={theme.accent} />;
      })}
    </Svg>
  );
}

export function BarChart({
  values,
  labels,
  height = 180,
  formatLabel,
}: {
  values: number[];
  labels: string[];
  height?: number;
  formatLabel?: (value: number) => string;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  const max = Math.max(1, ...values);
  const width = Math.max(320, labels.length * 44);
  const barWidth = 24;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={width} height={height}>
        {values.map((value, index) => {
          const x = 12 + index * 42;
          const barHeight = ((height - 36) * value) / max;
          const y = height - 24 - barHeight;
          return (
            <Fragment key={`${labels[index]}-${value}`}>
              <Rect x={x} y={y} width={barWidth} height={barHeight} rx={10} fill={theme.accent} />
              <SvgText
                x={x + barWidth / 2}
                y={height - 8}
                fill={theme.textSecondary}
                fontSize="10"
                textAnchor="middle"
              >
                {labels[index]}
              </SvgText>
              {formatLabel ? (
                <SvgText
                  x={x + barWidth / 2}
                  y={Math.max(12, y - 6)}
                  fill={theme.textPrimary}
                  fontSize="10"
                  textAnchor="middle"
                >
                  {formatLabel(value)}
                </SvgText>
              ) : null}
            </Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

export function SleepWindowDial({
  sleepMinutes,
  wakeMinutes,
  onSleepChange,
  onWakeChange,
}: {
  sleepMinutes: number;
  wakeMinutes: number;
  onSleepChange: (minutes: number) => void;
  onWakeChange: (minutes: number) => void;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  const size = 240;
  const center = size / 2;
  const radius = 78;
  const sleepAngle = ((sleepMinutes / (24 * 60)) * 360 - 90) * (Math.PI / 180);
  const wakeAngle = ((wakeMinutes / (24 * 60)) * 360 - 90) * (Math.PI / 180);
  const sleepX = center + Math.cos(sleepAngle) * radius;
  const sleepY = center + Math.sin(sleepAngle) * radius;
  const wakeX = center + Math.cos(wakeAngle) * radius;
  const wakeY = center + Math.sin(wakeAngle) * radius;

  return (
    <GlassCard className="items-center gap-5">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={92} stroke={theme.outline} strokeWidth={1} fill="none" />
        <Circle cx={center} cy={center} r={78} stroke={theme.glass} strokeWidth={18} fill="none" />
        <Line x1={center} y1={center} x2={sleepX} y2={sleepY} stroke={theme.warning} strokeWidth={4} />
        <Line x1={center} y1={center} x2={wakeX} y2={wakeY} stroke={theme.accent} strokeWidth={4} />
        <Circle cx={sleepX} cy={sleepY} r={12} fill={theme.warning} />
        <Circle cx={wakeX} cy={wakeY} r={12} fill={theme.accent} />
        <SvgText x={center} y={center - 6} fill={theme.textPrimary} fontSize="18" textAnchor="middle">
          Sleep Window
        </SvgText>
        <SvgText x={center} y={center + 18} fill={theme.textSecondary} fontSize="12" textAnchor="middle">
          Bed {formatClock(sleepMinutes)} • Wake {formatClock(wakeMinutes)}
        </SvgText>
      </Svg>
      <View className="w-full flex-row gap-3">
        <View className="flex-1 gap-2 rounded-[20px] border p-3" style={{ borderColor: theme.outline }}>
          <Text style={{ color: theme.textSecondary }} className="text-xs uppercase tracking-[1.4px]">
            Bedtime
          </Text>
          <Text style={{ color: theme.textPrimary }} className="text-lg font-semibold">
            {formatClock(sleepMinutes)}
          </Text>
          <View className="flex-row gap-2">
            <PrimaryButton title="-15m" subtle onPress={() => onSleepChange((sleepMinutes + 24 * 60 - 15) % (24 * 60))} />
            <PrimaryButton title="+15m" subtle onPress={() => onSleepChange((sleepMinutes + 15) % (24 * 60))} />
          </View>
        </View>
        <View className="flex-1 gap-2 rounded-[20px] border p-3" style={{ borderColor: theme.outline }}>
          <Text style={{ color: theme.textSecondary }} className="text-xs uppercase tracking-[1.4px]">
            Wake up
          </Text>
          <Text style={{ color: theme.textPrimary }} className="text-lg font-semibold">
            {formatClock(wakeMinutes)}
          </Text>
          <View className="flex-row gap-2">
            <PrimaryButton title="-15m" subtle onPress={() => onWakeChange((wakeMinutes + 24 * 60 - 15) % (24 * 60))} />
            <PrimaryButton title="+15m" subtle onPress={() => onWakeChange((wakeMinutes + 15) % (24 * 60))} />
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

export function MetricRow({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <View className="flex-row items-center justify-between gap-3 py-2">
      <View className="flex-1">
        <Text style={{ color: theme.textPrimary }} className="text-base font-semibold">
          {label}
        </Text>
        {helper ? (
          <Text style={{ color: theme.textSecondary }} className="mt-1 text-sm">
            {helper}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: theme.textPrimary }} className="text-base font-bold">
        {value}
      </Text>
    </View>
  );
}

export function SessionRow({
  title,
  subtitle,
  duration,
  onPress,
}: {
  title: string;
  subtitle: string;
  duration?: string;
  onPress?: () => void;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <Pressable
      onPress={onPress}
      className="rounded-[22px] border px-4 py-4"
      style={{ borderColor: theme.outline, backgroundColor: theme.cardMuted }}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text style={{ color: theme.textPrimary }} className="text-base font-semibold">
            {title}
          </Text>
          <Text style={{ color: theme.textSecondary }} className="mt-1 text-sm">
            {subtitle}
          </Text>
        </View>
        {duration ? (
          <Text style={{ color: theme.textPrimary }} className="text-base font-bold">
            {duration}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function LinkButton({ href, title }: { href: string; title: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable>
        <PrimaryButton title={title} />
      </Pressable>
    </Link>
  );
}

function Starfield() {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, index) => ({
        id: index,
        left: `${(index * 17) % 100}%` as `${number}%`,
        top: `${(index * 29) % 100}%` as `${number}%`,
        size: 2 + (index % 3),
        opacity: 0.12 + (index % 6) * 0.04,
      })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      {stars.map((star) => (
        <View
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            backgroundColor: theme.textPrimary,
          }}
        />
      ))}
    </View>
  );
}

export function DurationBadge({ seconds }: { seconds: number }) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <View
      className="rounded-full px-3 py-2"
      style={{ backgroundColor: theme.glass, borderColor: theme.outline, borderWidth: 1 }}
    >
      <Text style={{ color: theme.textPrimary }} className="text-sm font-semibold">
        {formatDuration(seconds)}
      </Text>
    </View>
  );
}

export function TrendPill({ label, value }: { label: string; value: number | null }) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  return (
    <View
      className="rounded-full px-3 py-2"
      style={{ backgroundColor: theme.cardMuted, borderColor: theme.outline, borderWidth: 1 }}
    >
      <Text style={{ color: theme.textSecondary }} className="text-xs uppercase tracking-[1px]">
        {label}
      </Text>
      <Text style={{ color: theme.textPrimary }} className="mt-1 text-sm font-semibold">
        {value == null ? "—" : formatHours(value)}
      </Text>
    </View>
  );
}

export function SessionTimelineCard({
  bedtime,
  wake,
  goal,
}: {
  bedtime: Date;
  wake: Date;
  goal: number;
}) {
  const appearance = useAppStore((state) => state.appearance);
  const theme = getTheme(appearance, useColorScheme());
  const duration = (wake.getTime() - bedtime.getTime()) / 1000;
  return (
    <GlassCard>
      <Text style={{ color: theme.textSecondary }} className="text-xs uppercase tracking-[1.4px]">
        Sleep window
      </Text>
      <View className="mt-3 flex-row items-end justify-between">
        <View>
          <Text style={{ color: theme.textPrimary }} className="text-2xl font-bold">
            {formatDuration(duration)}
          </Text>
          <Text style={{ color: theme.textSecondary }} className="mt-1 text-sm">
            Goal match {goal}%
          </Text>
        </View>
        <View className="items-end">
          <Text style={{ color: theme.textPrimary }} className="text-base font-semibold">
            {formatTime(bedtime)} → {formatTime(wake)}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}
