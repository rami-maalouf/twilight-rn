import { router } from "expo-router";
import { Text, View } from "react-native";

import { GlassPanel, NativeScreen, SectionHeader, TwilightButton, useTwilightTheme } from "@/ui/surface";

export default function MetricsGuideModal() {
  const { theme } = useTwilightTheme();

  return (
    <NativeScreen>
      <SectionHeader title="Metrics Guide" subtitle="How Twilight reads your nights and scores your rhythm." />
      <GlassPanel>
        <View style={{ gap: 14 }}>
          {[
            "Sleep consistency measures bedtime stability.",
            "Wake consistency measures wake-time stability.",
            "Accuracy compares actual bedtime and wake time with your configured targets.",
            "Trend shows a 7-night or monthly (30-night) moving average. History is calculated before applying display ranges.",
            "Time shows sleep, wake, or both, with 7-night averages and target differences.",
            "SRI measures adjacent noon-to-noon sleep and awake agreement across 7, 14, or 28 days. Naps count, overlaps are merged, and missing or daylight-saving days remain gaps. Unlogged time on recorded days is assumed awake.",
            "Recovery accumulates actual sleep minus your target: negative is debt, positive is credit.",
            "Alignment combines asymmetric duration penalties, sleep-window overlap, midpoint phase, and consistency using weighted geometric scores. Components at or below 1% are excluded.",
          ].map((item) => (
            <Text key={item} style={{ color: theme.textPrimary, fontSize: 15, lineHeight: 23 }}>
              • {item}
            </Text>
          ))}
        </View>
      </GlassPanel>
      <TwilightButton title="Close" onPress={() => router.back()} />
    </NativeScreen>
  );
}
