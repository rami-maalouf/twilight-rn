import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import {
  useColorScheme,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { formatHours } from "@/lib/format";
import { getTheme, type AppTheme } from "@/lib/theme";
import { useAppStore } from "@/lib/store";

export function useTwilightTheme() {
  const appearance = useAppStore((state) => state.appearance);
  const deviceScheme = useColorScheme();
  return {
    appearance,
    theme: getTheme(appearance, deviceScheme),
  };
}

export function TwilightBackground({ children }: { children?: React.ReactNode }) {
  const { theme } = useTwilightTheme();
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[theme.backgroundStart, theme.backgroundEnd]}
        style={StyleSheet.absoluteFill}
      />
      <Starfield />
      {children}
    </View>
  );
}

export function NativeScreen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const scrollTopPadding = process.env.EXPO_OS === "ios" ? 10 : 8;
  const scrollBottomPadding = process.env.EXPO_OS === "ios" ? 24 : 96;
  const fixedTopPadding = 10;
  const fixedBottomPadding = 16;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      <TwilightBackground />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            {
              paddingHorizontal: 16,
              paddingTop: scrollTopPadding,
              paddingBottom: scrollBottomPadding,
              gap: 16,
            },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            {
              flex: 1,
              paddingHorizontal: 16,
              paddingTop: fixedTopPadding,
              paddingBottom: fixedBottomPadding,
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function GlassPanel({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  const { appearance, theme } = useTwilightTheme();
  return (
    <BlurView
      intensity={24}
      tint={appearance.themeMode === "Sunset" ? "light" : "dark"}
      style={[
        {
          overflow: "hidden",
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.outline,
          backgroundColor: theme.card,
          padding: padded ? 16 : 0,
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

export function SectionHeader({
  title,
  subtitle,
  trailing,
  compact,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  compact?: boolean;
}) {
  const { theme } = useTwilightTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          selectable
          style={{
            color: theme.textPrimary,
            fontSize: compact ? 15 : 30,
            lineHeight: compact ? 20 : 36,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  tint,
  icon,
  style,
}: {
  title: string;
  value: string;
  subtitle?: string;
  tint?: string;
  icon?: string;
  style?: ViewStyle;
}) {
  const { theme } = useTwilightTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          minWidth: "47%",
          borderRadius: 16,
          backgroundColor: theme.cardMuted,
          borderWidth: 1,
          borderColor: theme.outline,
          paddingHorizontal: 12,
          paddingVertical: 12,
          gap: 5,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        {icon ? <Text style={{ color: tint ?? theme.accent, fontSize: 17 }}>{icon}</Text> : null}
        <Text
          selectable
          numberOfLines={1}
          style={{
            color: theme.textSecondary,
            fontSize: 11,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
      </View>
      <Text
        selectable
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: tint ?? theme.textPrimary,
          fontSize: 20,
          lineHeight: 25,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      {subtitle ? (
        <Text selectable numberOfLines={2} style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 15 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>;
}

export function InsightPill({
  title,
  value,
  subtitle,
  tint,
}: {
  title: string;
  value: string;
  subtitle: string;
  tint?: string;
}) {
  const { theme } = useTwilightTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 12,
        backgroundColor: theme.glass,
        paddingHorizontal: 9,
        paddingVertical: 8,
        gap: 3,
      }}
    >
      <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 9, fontWeight: "800" }}>
        {title.toUpperCase()}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: tint ?? theme.accent, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 10 }}>
        {subtitle}
      </Text>
    </View>
  );
}

export function TwilightButton({
  title,
  onPress,
  subtle,
  disabled,
  danger,
  style,
  textStyle,
}: {
  title: string;
  onPress?: () => void;
  subtle?: boolean;
  disabled?: boolean;
  danger?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  const { appearance, theme } = useTwilightTheme();
  const backgroundColor = danger ? theme.danger : subtle ? theme.glass : theme.accent;
  const foreground = subtle || danger ? theme.textPrimary : appearance.themeMode === "Sunset" ? "#FFFFFF" : "#06131B";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: 50,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingVertical: 13,
          backgroundColor,
          opacity: disabled ? 0.55 : pressed ? 0.84 : 1,
          borderWidth: subtle ? 1 : 0,
          borderColor: theme.outline,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[{ color: foreground, fontSize: 16, fontWeight: "800" }, textStyle]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function SegmentedPills<T extends string>({
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
    <View
      style={{
        flexDirection: "row",
        borderRadius: 18,
        backgroundColor: theme.cardMuted,
        borderWidth: 1,
        borderColor: theme.outline,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={{
              flex: 1,
              minHeight: 29,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 15,
              backgroundColor: active ? "rgba(255,255,255,0.27)" : "transparent",
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                color: active ? theme.textPrimary : theme.textSecondary,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DemoExitOverlay({
  visible,
  onPress,
  top = 10,
}: {
  visible: boolean;
  onPress: () => void;
  top?: number;
}) {
  const { theme } = useTwilightTheme();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <Pressable
        onPress={onPress}
        style={{
          position: "absolute",
          right: 16,
          top: insets.top + top,
          minHeight: 36,
          borderRadius: 18,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.outline,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
        }}
      >
        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "900" }}>x</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: "800" }}>Exit Demo</Text>
      </Pressable>
    </View>
  );
}

export function EmptyPanel({ title, subtitle }: { title: string; subtitle: string }) {
  const { theme } = useTwilightTheme();
  return (
    <GlassPanel style={{ alignItems: "center", paddingVertical: 36 }}>
      <Text selectable style={{ color: theme.textPrimary, fontSize: 20, fontWeight: "800", textAlign: "center" }}>
        {title}
      </Text>
      <Text selectable style={{ color: theme.textSecondary, marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
        {subtitle}
      </Text>
    </GlassPanel>
  );
}

export function TrendDelta({ value }: { value: number | null }) {
  const { theme } = useTwilightTheme();
  if (value == null) {
    return <Text style={{ color: theme.textSecondary, fontWeight: "800" }}>-</Text>;
  }

  const positive = value >= 0;
  return (
    <Text style={{ color: positive ? theme.success : theme.danger, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
      {positive ? "↗" : "↘"} {Math.abs(Math.round(value))}%
    </Text>
  );
}

export function formatHoursCompact(hours: number | null | undefined) {
  if (hours == null || Number.isNaN(hours)) return "-";
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes === 0) return `${whole}h`;
  return `${whole}h ${minutes}m`;
}

export function formatSignedHoursCompact(hours: number | null | undefined) {
  if (hours == null || Number.isNaN(hours)) return "-";
  const prefix = hours > 0 ? "+" : "";
  return `${prefix}${formatHours(hours)}`;
}

function Starfield() {
  const { theme } = useTwilightTheme();
  const stars = useMemo(
    () =>
      Array.from({ length: 58 }, (_, index) => ({
        id: index,
        left: `${(index * 17 + 7) % 100}%` as `${number}%`,
        top: `${(index * 29 + 11) % 100}%` as `${number}%`,
        size: index % 9 === 0 ? 3 : 1 + (index % 3),
        opacity: 0.12 + (index % 7) * 0.045,
      })),
    [],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((star) => (
        <View
          key={star.id}
          style={{
            position: "absolute",
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            opacity: star.opacity,
            backgroundColor: theme.textPrimary,
          }}
        />
      ))}
    </View>
  );
}

export function chartPalette(theme: AppTheme) {
  return {
    cyan: theme.accent,
    cyanMuted: "rgba(0,212,255,0.22)",
    indigo: "#7B68EE",
    orange: "#FFB347",
    pink: "#C13BDD",
    green: theme.success,
    red: theme.danger,
    grid: "rgba(255,255,255,0.11)",
    label: theme.textSecondary,
    text: theme.textPrimary,
  };
}
