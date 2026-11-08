import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { makeSession } from "@/lib/db";
import { formatClock, formatDurationLong } from "@/lib/format";
import { resolveWallTime, wallTime, type WallTime } from "@/lib/session-editor";
import { isValidSession } from "@/lib/sleep";
import { useAppStore } from "@/lib/store";
import { NativeSegmentedControl } from "@/ui/native";
import {
  GlassPanel,
  NativeScreen,
  SectionHeader,
  TwilightButton,
  useTwilightTheme,
} from "@/ui/surface";

function Endpoint({
  title,
  value,
  zone,
  onChange,
  occurrence,
  onOccurrenceChange,
}: {
  title: string;
  value: WallTime;
  zone: string;
  onChange: (value: WallTime) => void;
  occurrence: string;
  onOccurrenceChange: (value: "Ask" | "First" | "Second") => void;
}) {
  const { theme } = useTwilightTheme();
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const date = new Date(`${value.date}T12:00:00`);
  if (picker === "time") date.setFullYear(2000, 0, 15);
  if (picker === "time")
    date.setHours(Math.floor(value.minutes / 60), value.minutes % 60);
  return (
    <GlassPanel style={{ gap: 12 }}>
      <SectionHeader title={title} subtitle={zone} compact />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TwilightButton
          title={value.date}
          subtle
          onPress={() => setPicker("date")}
        />
        <TwilightButton
          title={formatClock(value.minutes)}
          subtle
          onPress={() => setPicker("time")}
        />
      </View>
      {picker ? (
        <DateTimePicker
          value={date}
          mode={picker}
          onDismiss={() => setPicker(null)}
          onValueChange={(_, next) => {
            setPicker(null);
            onChange(
              picker === "date"
                ? {
                    ...value,
                    date: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`,
                  }
                : {
                    ...value,
                    minutes: next.getHours() * 60 + next.getMinutes(),
                  },
            );
          }}
        />
      ) : null}
      <Text style={{ color: theme.textSecondary }}>
        If the clocks repeat this time, choose its occurrence.
      </Text>
      <NativeSegmentedControl
        options={["Ask", "First", "Second"] as const}
        value={occurrence as "Ask" | "First" | "Second"}
        onChange={onOccurrenceChange}
      />
    </GlassPanel>
  );
}

export default function SessionEditorModal() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const sessions = useAppStore((state) => state.sessions);
  const settings = useAppStore((state) => state.sleepSettings);
  const upsert = useAppStore((state) => state.upsertSleepLog);
  const { theme } = useTwilightTheme();
  const [existing] = useState(() =>
    sessions.find((session) => session.id === sessionId),
  );
  const [zone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const startZone = existing?.startTimeZoneIdentifier ?? zone;
  const endZone = existing?.endTimeZoneIdentifier ?? startZone;
  const [end, setEnd] = useState(() =>
    existing?.endTime
      ? wallTime(existing.endTime, endZone)
      : {
          ...wallTime(new Date().toISOString(), endZone),
          minutes: settings.optimalWakeMinutes,
        },
  );
  const [start, setStart] = useState(() => {
    if (existing) return wallTime(existing.startTime, startZone);
    const date = new Date(`${end.date}T12:00:00Z`);
    if (settings.optimalSleepMinutes >= end.minutes)
      date.setUTCDate(date.getUTCDate() - 1);
    return {
      date: date.toISOString().slice(0, 10),
      minutes: settings.optimalSleepMinutes,
    };
  });
  const [startOccurrence, setStartOccurrence] = useState<
    "Ask" | "First" | "Second"
  >("Ask");
  const [endOccurrence, setEndOccurrence] = useState<
    "Ask" | "First" | "Second"
  >("Ask");
  const [tag, setTag] = useState(existing?.tag ?? "Manual Log");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [savedId] = useState(
    () => existing?.id ?? makeSession("Manual Log").id,
  );
  let input: { startTime: string; endTime: string } | undefined;
  let validation: string | undefined =
    sessionId && !existing
      ? "This sleep log no longer exists. Cancel and return to your logs."
      : undefined;
  try {
    input = {
      startTime: resolveWallTime(
        start,
        startZone,
        existing?.startTime,
        startOccurrence === "Ask" ? undefined : startOccurrence,
      ),
      endTime: resolveWallTime(
        end,
        endZone,
        existing?.endTime ?? undefined,
        endOccurrence === "Ask" ? undefined : endOccurrence,
      ),
    };
    if (Date.parse(input.endTime) <= Date.parse(input.startTime))
      validation =
        "Wake time must be after bedtime. Check both dates and time zones.";
    else if (
      !isValidSession({ ...existing, ...input } as Parameters<
        typeof isValidSession
      >[0])
    )
      validation = "A sleep log must last at least 5 minutes.";
  } catch (failure) {
    validation =
      failure instanceof Error ? failure.message : "Check the date and time.";
  }

  async function save() {
    if (submitting.current || validation || !input) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      await upsert({
        id: savedId,
        tag,
        ...input,
        startTimeZoneIdentifier: existing
          ? existing.startTimeZoneIdentifier
          : startZone,
        endTimeZoneIdentifier: existing
          ? existing.endTimeZoneIdentifier
          : endZone,
      });
      router.back();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Your draft is still here. Try again.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <NativeScreen>
      <SectionHeader
        title={existing ? "Edit Log" : "Log Sleep"}
        subtitle="Times stay in their original zones, including when you travel."
      />
      <Endpoint
        title="Bedtime"
        value={start}
        zone={startZone}
        onChange={setStart}
        occurrence={startOccurrence}
        onOccurrenceChange={setStartOccurrence}
      />
      <Endpoint
        title="Wake time"
        value={end}
        zone={endZone}
        onChange={setEnd}
        occurrence={endOccurrence}
        onOccurrenceChange={setEndOccurrence}
      />
      <GlassPanel style={{ gap: 12 }}>
        <TextInput
          accessibilityLabel="Log label"
          value={tag}
          onChangeText={setTag}
          style={{
            minHeight: 48,
            color: theme.textPrimary,
            borderColor: theme.outline,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
          }}
        />
        <Text
          selectable
          style={{
            color: validation || error ? theme.danger : theme.textSecondary,
          }}
        >
          {validation ??
            error ??
            (input
              ? formatDurationLong(
                  (Date.parse(input.endTime) - Date.parse(input.startTime)) /
                    1000,
                )
              : "")}
        </Text>
        <TwilightButton
          title={saving ? "Saving..." : error ? "Retry Save" : "Save Log"}
          disabled={saving || !!validation}
          onPress={() => void save()}
        />
        <TwilightButton
          title="Cancel"
          subtle
          disabled={saving}
          onPress={() => router.back()}
        />
      </GlassPanel>
    </NativeScreen>
  );
}
