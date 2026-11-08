import {
  sleepRegularitySeries,
  type SleepRegularityWindow,
} from "./sleep-regularity";
import { MINIMUM_VALID_SESSION_SECONDS } from "@/lib/constants";
import { addDays, clamp, minutesFromDate, startOfDay } from "@/lib/format";
import type {
  SleepSession,
  DailySleepData,
  SleepAlignmentScorePoint,
  SleepConsistencyPoint,
  SleepDebtPoint,
  SleepDurationBucket,
  SleepMetricsRange,
  SleepMovingAveragePoint,
  SleepNightRecord,
  SleepSocialJetlag,
  SleepTimingPoint,
  SleepTrendPeriod,
  SleepWeekdayAverage,
} from "@/lib/types";

export const SLEEP_DATA_BASE_HOUR = 18;

const RANGE_DAYS: Record<Exclude<SleepMetricsRange, "All">, number> = {
  "30D": 30,
  "90D": 90,
  "1Y": 365,
};

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function getParts(date: Date, timeZone?: string | null) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function makeDayKey(date: Date, timeZone?: string | null) {
  const parts = getParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function dateFromDayKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

export function sessionDurationSeconds(session: SleepSession) {
  const start = toDate(session.startTime);
  const end = toDate(session.endTime) ?? new Date();
  if (
    !start ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime())
  )
    return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

export function isValidSession(session: SleepSession) {
  return sessionDurationSeconds(session) >= MINIMUM_VALID_SESSION_SECONDS;
}

export function validCompletedSessions(sessions: SleepSession[]) {
  return sessions.filter(
    (session) => session.endTime != null && isValidSession(session),
  );
}

export function getSessionSleepDate(session: SleepSession) {
  const end = toDate(session.endTime);
  const start = toDate(session.startTime);
  const zone =
    session.endTimeZoneIdentifier ??
    session.startTimeZoneIdentifier ??
    undefined;

  if (end) {
    return dateFromDayKey(makeDayKey(end, zone));
  }

  if (!start) {
    return startOfDay(new Date());
  }

  return startOfDay(addDays(start, 1));
}

export function calculateTimeOffset(
  date: Date | null,
  timeZone?: string | null,
) {
  if (!date) return null;
  const parts = getParts(date, timeZone);
  let value = parts.hour + parts.minute / 60;
  if (value < SLEEP_DATA_BASE_HOUR) {
    value += 24;
  }
  return value - SLEEP_DATA_BASE_HOUR;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function consistencyScore(values: number[]) {
  if (values.length === 0) return 0;
  const mean = average(values) ?? 0;
  const variance = average(values.map((value) => (value - mean) ** 2)) ?? 0;
  return clamp(100 - Math.trunc(Math.sqrt(variance) * 40), 0, 100);
}

function geometricScore(components: [number, number][]) {
  const active = components.filter(
    ([score, weight]) => score > 0.01 && weight > 0,
  );
  const weight = active.reduce((sum, entry) => sum + entry[1], 0);
  return weight === 0
    ? 0
    : 100 *
        active.reduce(
          (product, [score, share]) => product * score ** (share / weight),
          1,
        );
}

function standardDeviation(values: number[]) {
  const mean = average(values) ?? 0;
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)) ?? 0);
}

function calendarDayOrdinal(date: Date) {
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  );
}

export function sleepStreaks(dates: Date[], referenceDate = new Date()) {
  const days = [...new Set(dates.map(calendarDayOrdinal))].sort(
    (a, b) => a - b,
  );
  let longest = 0;
  let run = 0;
  days.forEach((day, index) => {
    run = index > 0 && day === days[index - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  const tracked = new Set(days);
  let day = calendarDayOrdinal(referenceDate);
  if (!tracked.has(day)) day -= 1;
  let current = 0;
  while (tracked.has(day)) {
    current += 1;
    day -= 1;
  }
  return { current, longest };
}

// compute history-dependent series before clipping to the requested visible dates.
export function clipSleepSeries<T extends { date: Date }>(
  series: T[],
  records: { date: Date }[],
) {
  const dates = new Set(records.map((record) => record.date.getTime()));
  return series.filter((point) => dates.has(point.date.getTime()));
}

function rollingTrend(previous: number | null, current: number) {
  return previous == null ? current : previous * 0.8 + current * 0.2;
}

function wrappedMinuteDifference(actual: number, target: number) {
  const direct = Math.abs(actual - target);
  return Math.min(direct, 24 * 60 - direct);
}

function goalDurationHours(
  optimalSleepMinutes: number,
  optimalWakeMinutes: number,
) {
  let diff = optimalWakeMinutes - optimalSleepMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

function recordsFromSessions(
  sessions: SleepSession[],
  optimalSleepMinutes: number,
  optimalWakeMinutes: number,
) {
  const canonical = canonicalSessions(sessions);

  const records: SleepNightRecord[] = canonical
    .map((session) => {
      const start = toDate(session.startTime);
      const end = toDate(session.endTime);
      if (!start || !end) return null;

      const bedtimeOffset = calculateTimeOffset(
        start,
        session.startTimeZoneIdentifier,
      );
      const wakeOffset = calculateTimeOffset(
        end,
        session.endTimeZoneIdentifier,
      );
      if (bedtimeOffset == null || wakeOffset == null) return null;

      const date = getSessionSleepDate(session);
      return {
        date,
        weekday: date.getDay() + 1,
        durationHours: sessionDurationSeconds(session) / 3600,
        bedtimeOffset,
        wakeOffset,
        midpointOffset: bedtimeOffset + sessionDurationSeconds(session) / 7200,
      };
    })
    .filter(Boolean) as SleepNightRecord[];

  const targetDurationHours = goalDurationHours(
    optimalSleepMinutes,
    optimalWakeMinutes,
  );

  return {
    records,
    targetDurationHours,
    targetSleepOffset: timeOffsetFromMinutes(optimalSleepMinutes),
    targetWakeOffset: timeOffsetFromMinutes(optimalWakeMinutes),
  };
}

function timeOffsetFromMinutes(minutes: number) {
  let hours = minutes / 60;
  if (hours < SLEEP_DATA_BASE_HOUR) hours += 24;
  return hours - SLEEP_DATA_BASE_HOUR;
}

export function canonicalSessions(sessions: SleepSession[]) {
  const completed = validCompletedSessions(sessions);
  const bucket = new Map<string, SleepSession>();

  for (const session of completed) {
    const end = toDate(session.endTime);
    if (!end) continue;
    const key = makeDayKey(
      end,
      session.endTimeZoneIdentifier ?? session.startTimeZoneIdentifier,
    );
    const existing = bucket.get(key);
    if (
      !existing ||
      sessionDurationSeconds(session) > sessionDurationSeconds(existing)
    ) {
      bucket.set(key, session);
    }
  }

  return [...bucket.values()].sort(
    (left, right) =>
      getSessionSleepDate(left).getTime() -
      getSessionSleepDate(right).getTime(),
  );
}

export function processWeeklySleepData(sessions: SleepSession[]) {
  const canonical = canonicalSessions(sessions);
  if (canonical.length === 0) return [];

  const latest = canonical[canonical.length - 1];
  const latestDate = getSessionSleepDate(latest);
  const sessionsByKey = new Map(
    canonical.map(
      (session) => [makeDayKey(getSessionSleepDate(session)), session] as const,
    ),
  );

  const entries: DailySleepData[] = [];
  for (let index = 6; index >= 0; index -= 1) {
    const date = addDays(latestDate, -index);
    const key = makeDayKey(date);
    const session = sessionsByKey.get(key);
    const label = date.toLocaleDateString([], { weekday: "short" });
    if (!session) {
      entries.push({
        dayLabel: label,
        date,
        startOffset: 0,
        endOffset: 0,
        duration: 0,
      });
      continue;
    }

    const start = toDate(session.startTime);
    const end = toDate(session.endTime);
    if (!start || !end) continue;

    entries.push({
      dayLabel: label,
      date,
      startOffset:
        calculateTimeOffset(start, session.startTimeZoneIdentifier) ?? 0,
      endOffset: calculateTimeOffset(end, session.endTimeZoneIdentifier) ?? 0,
      duration: sessionDurationSeconds(session),
    });
  }

  return entries;
}

export function calculateSleepConsistency(data: DailySleepData[]) {
  return consistencyScore(
    data
      .filter((entry) => entry.duration > 0)
      .map((entry) => entry.startOffset),
  );
}

export function calculateWakeConsistency(data: DailySleepData[]) {
  return consistencyScore(
    data.filter((entry) => entry.duration > 0).map((entry) => entry.endOffset),
  );
}

export function calculateAccuracy(
  data: DailySleepData[],
  optimalSleepMinutes: number,
  optimalWakeMinutes: number,
) {
  const active = data.filter((entry) => entry.duration > 0);
  if (active.length === 0) return 0;

  const targetSleepOffset = timeOffsetFromMinutes(optimalSleepMinutes);
  const targetWakeOffset = timeOffsetFromMinutes(optimalWakeMinutes);

  const deviations = active.map((entry) => {
    const bedtimeMinutes =
      Math.round((entry.startOffset + SLEEP_DATA_BASE_HOUR) * 60) % (24 * 60);
    const wakeMinutes =
      Math.round((entry.endOffset + SLEEP_DATA_BASE_HOUR) * 60) % (24 * 60);
    return (
      (wrappedMinuteDifference(
        bedtimeMinutes,
        Math.round((targetSleepOffset + SLEEP_DATA_BASE_HOUR) * 60) % (24 * 60),
      ) +
        wrappedMinuteDifference(
          wakeMinutes,
          Math.round((targetWakeOffset + SLEEP_DATA_BASE_HOUR) * 60) %
            (24 * 60),
        )) /
      2
    );
  });

  const avgDeviationMinutes = average(deviations) ?? 0;
  const deduction = Math.round((avgDeviationMinutes / 60) * 30);
  return clamp(100 - deduction, 0, 100);
}

export function buildSleepMetrics(
  sessions: SleepSession[],
  optimalSleepMinutes: number,
  optimalWakeMinutes: number,
) {
  const model = recordsFromSessions(
    sessions,
    optimalSleepMinutes,
    optimalWakeMinutes,
  );
  return {
    ...model,
    sleepRegularitySeries(
      range: SleepMetricsRange,
      window: SleepRegularityWindow = 7,
      referenceDate = new Date(),
    ) {
      const intervals = validCompletedSessions(sessions).map((session) => ({
        start: new Date(session.startTime),
        end: new Date(session.endTime!),
      }));
      return sleepRegularitySeries(
        intervals,
        range === "All" ? null : RANGE_DAYS[range],
        window,
        referenceDate,
      );
    },
    recordsInRange(range: SleepMetricsRange, referenceDate = new Date()) {
      if (range === "All") return model.records;
      const days = RANGE_DAYS[range];
      const threshold = startOfDay(addDays(referenceDate, -(days - 1)));
      return model.records.filter((record) => record.date >= threshold);
    },
    averageDuration(records: SleepNightRecord[]) {
      return average(records.map((record) => record.durationHours));
    },
    medianDuration(records: SleepNightRecord[]) {
      return median(records.map((record) => record.durationHours));
    },
    totalSleepHours(records: SleepNightRecord[]) {
      return records.reduce((sum, record) => sum + record.durationHours, 0);
    },
    longestNight(records: SleepNightRecord[]) {
      return records.reduce<number | null>((max, record) => {
        if (max == null || record.durationHours > max)
          return record.durationHours;
        return max;
      }, null);
    },
    shortestNight(records: SleepNightRecord[]) {
      return records.reduce<number | null>((min, record) => {
        if (record.durationHours <= 0) return min;
        if (min == null || record.durationHours < min)
          return record.durationHours;
        return min;
      }, null);
    },
    trackingCoverage(
      records: SleepNightRecord[],
      range: SleepMetricsRange,
      referenceDate = new Date(),
    ) {
      const first = model.records[0]?.date;
      const historyDays = first
        ? calendarDayOrdinal(referenceDate) - calendarDayOrdinal(first) + 1
        : 0;
      const denominator =
        range === "All" ? Math.max(1, historyDays) : RANGE_DAYS[range];
      return Math.round(clamp(records.length / denominator, 0, 1) * 100);
    },
    goalHitRate(records: SleepNightRecord[], toleranceHours = 0.75) {
      if (records.length === 0) return 0;
      const hits = records.filter(
        (record) =>
          Math.abs(record.durationHours - model.targetDurationHours) <=
          toleranceHours,
      );
      return Math.round((hits.length / records.length) * 100);
    },
    durationTrendPercent(records: SleepNightRecord[], window = 7) {
      if (records.length < window * 2) return null;
      const current = records.slice(-window);
      const previous = records.slice(-(window * 2), -window);
      const currentAverage = average(
        current.map((record) => record.durationHours),
      );
      const previousAverage = average(
        previous.map((record) => record.durationHours),
      );
      if (!currentAverage || !previousAverage) return null;
      return ((currentAverage - previousAverage) / previousAverage) * 100;
    },
    sleepConsistencyScore(records: SleepNightRecord[]) {
      return consistencyScore(records.map((record) => record.bedtimeOffset));
    },
    wakeConsistencyScore(records: SleepNightRecord[]) {
      return consistencyScore(records.map((record) => record.wakeOffset));
    },
    scheduleAccuracyScore(records: SleepNightRecord[]) {
      if (records.length === 0) return 0;
      const targetSleepOffset = model.targetSleepOffset ?? 0;
      const targetWakeOffset = model.targetWakeOffset ?? 0;
      const deviations = records.map((record) => {
        const bedtimeDeviation = Math.abs(
          record.bedtimeOffset - targetSleepOffset,
        );
        const wakeDeviation = Math.abs(record.wakeOffset - targetWakeOffset);
        return (bedtimeDeviation + wakeDeviation) / 2;
      });
      const avgDeviation = average(deviations) ?? 0;
      return clamp(100 - Math.trunc(avgDeviation * 30), 0, 100);
    },
    movingAverageSeries(
      records: SleepNightRecord[],
      window = 7,
    ): SleepMovingAveragePoint[] {
      return records.map((record, index) => {
        if (index + 1 < window) {
          return {
            date: record.date,
            durationHours: record.durationHours,
            movingAverageHours: null,
          };
        }
        const slice = records.slice(index - window + 1, index + 1);
        return {
          date: record.date,
          durationHours: record.durationHours,
          movingAverageHours: average(
            slice.map((entry) => entry.durationHours),
          ),
        };
      });
    },
    timingMovingAverageSeries(
      records: SleepNightRecord[],
      component: "bedtimeOffset" | "wakeOffset",
      window = 7,
    ) {
      return records.map((record, index) => ({
        date: record.date,
        actualOffset: record[component],
        movingAverageOffset:
          index + 1 < window
            ? null
            : average(
                records
                  .slice(index - window + 1, index + 1)
                  .map((entry) => entry[component]),
              ),
      }));
    },
    rollingConsistencySeries(
      records: SleepNightRecord[],
      window = 14,
    ): SleepConsistencyPoint[] {
      return records.map((record, index) => {
        if (index + 1 < window) {
          return {
            date: record.date,
            sleepConsistency: null,
            wakeConsistency: null,
            scheduleAccuracy: null,
          };
        }
        const slice = records.slice(index - window + 1, index + 1);
        return {
          date: record.date,
          sleepConsistency: consistencyScore(
            slice.map((entry) => entry.bedtimeOffset),
          ),
          wakeConsistency: consistencyScore(
            slice.map((entry) => entry.wakeOffset),
          ),
          scheduleAccuracy: this.scheduleAccuracyScore(slice),
        };
      });
    },
    cumulativeDebtSeries(records: SleepNightRecord[]): SleepDebtPoint[] {
      let cumulative = 0;
      return records.map((record) => {
        cumulative += record.durationHours - model.targetDurationHours;
        return {
          date: record.date,
          cumulativeHours: Number(cumulative.toFixed(2)),
        };
      });
    },
    weekdayAverages(records: SleepNightRecord[]): SleepWeekdayAverage[] {
      return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
        const slice = records.filter((record) => record.weekday === weekday);
        const averageHours =
          average(slice.map((entry) => entry.durationHours)) ?? 0;
        const reference = slice[0]?.date ?? new Date(2024, 0, weekday);
        return {
          weekday,
          dayName: reference.toLocaleDateString([], { weekday: "short" }),
          averageHours,
          nights: slice.length,
        };
      });
    },
    durationBuckets(records: SleepNightRecord[]): SleepDurationBucket[] {
      const specs = [
        { label: "<5h", match: (value: number) => value < 5 },
        {
          label: "5-5.5h",
          match: (value: number) => value >= 5 && value < 5.5,
        },
        {
          label: "5.5-6h",
          match: (value: number) => value >= 5.5 && value < 6,
        },
        {
          label: "6-6.5h",
          match: (value: number) => value >= 6 && value < 6.5,
        },
        {
          label: "6.5-7h",
          match: (value: number) => value >= 6.5 && value < 7,
        },
        {
          label: "7-7.5h",
          match: (value: number) => value >= 7 && value < 7.5,
        },
        {
          label: "7.5-8h",
          match: (value: number) => value >= 7.5 && value < 8,
        },
        { label: "8h+", match: (value: number) => value >= 8 },
      ];

      return specs.map((spec) => {
        const count = records.filter((record) =>
          spec.match(record.durationHours),
        ).length;
        return {
          label: spec.label,
          count,
          share: records.length === 0 ? 0 : count / records.length,
        };
      });
    },
    durationTrendsAnalysis(): SleepTrendPeriod[] {
      return [3, 7, 14, 30, 90].map((days) => {
        const current = model.records.slice(-days);
        const previous = model.records.slice(-(days * 2), -days);
        return {
          days,
          averageDuration: average(
            current.map((record) => record.durationHours),
          ),
          previousAverageDuration: average(
            previous.map((record) => record.durationHours),
          ),
          changePercent:
            current.length > 0 && previous.length > 0
              ? (((average(current.map((record) => record.durationHours)) ??
                  0) -
                  (average(previous.map((record) => record.durationHours)) ??
                    0)) /
                  Math.max(
                    0.001,
                    average(previous.map((record) => record.durationHours)) ??
                      0.001,
                  )) *
                100
              : null,
          sparkline:
            days <= 14
              ? current.map((record) => record.durationHours)
              : this.movingAverageSeries(model.records, 7)
                  .flatMap((point) =>
                    point.movingAverageHours == null
                      ? []
                      : [point.movingAverageHours],
                  )
                  .slice(-days),
        };
      });
    },
    sleepAlignmentSeries(
      records: SleepNightRecord[],
    ): SleepAlignmentScorePoint[] {
      let previousTrend: number | null = null;
      let previousCoreTrend: number | null = null;
      if (model.targetDurationHours <= 0) return [];
      return records.map((record, index) => {
        const trailing = records.slice(Math.max(0, index - 13), index + 1);
        const deviation = record.durationHours - model.targetDurationHours;
        const durationScore = Math.exp(
          -((deviation / (deviation <= 0 ? 1.25 : 2)) ** 2),
        );
        const overlap = Math.max(
          0,
          Math.min(
            record.bedtimeOffset + record.durationHours,
            model.targetSleepOffset + model.targetDurationHours,
          ) - Math.max(record.bedtimeOffset, model.targetSleepOffset),
        );
        const timingScore = clamp(
          overlap / model.targetDurationHours -
            0.15 * Math.max(0, record.durationHours - overlap),
          0,
          1,
        );
        const rawPhase =
          Math.abs(
            record.midpointOffset -
              model.targetSleepOffset -
              model.targetDurationHours / 2,
          ) % 24;
        const phaseScore = Math.exp(
          -0.5 * (Math.min(rawPhase, 24 - rawPhase) / 1.5) ** 2,
        );
        const consistencyComponent = Math.exp(
          -0.5 *
            ((standardDeviation(trailing.map((entry) => entry.midpointOffset)) /
              1.25) **
              2 +
              (standardDeviation(trailing.map((entry) => entry.durationHours)) /
                1.5) **
                2),
        );
        const coreScore = geometricScore([
          [durationScore, 0.35],
          [consistencyComponent, 0.15],
        ]);
        const dailyScore = geometricScore([
          [durationScore, 0.35],
          [timingScore, 0.3],
          [phaseScore, 0.2],
          [consistencyComponent, 0.15],
        ]);
        const trendScore = rollingTrend(previousTrend, dailyScore);
        const coreTrendScore = rollingTrend(previousCoreTrend, coreScore);
        previousTrend = trendScore;
        previousCoreTrend = coreTrendScore;
        return {
          date: record.date,
          dailyScore,
          trendScore,
          coreScore,
          coreTrendScore,
          durationScore: durationScore * 100,
          timingScore: timingScore * 100,
          phaseScore: phaseScore * 100,
          consistencyScore: consistencyComponent * 100,
        };
      });
    },
    timingTimelineSeries(records: SleepNightRecord[]): SleepTimingPoint[] {
      return records.map((record) => ({
        date: record.date,
        bedtimeOffset: record.bedtimeOffset,
        wakeOffset: record.wakeOffset,
        midpointOffset: record.midpointOffset,
        durationHours: record.durationHours,
      }));
    },
    socialJetlag(records: SleepNightRecord[]): SleepSocialJetlag {
      const weekday = records.filter(
        (record) => record.weekday >= 2 && record.weekday <= 6,
      );
      const weekend = records.filter(
        (record) => record.weekday === 1 || record.weekday === 7,
      );
      const weekdayMidpoint = average(
        weekday.map((record) => record.midpointOffset),
      );
      const weekendMidpoint = average(
        weekend.map((record) => record.midpointOffset),
      );
      return {
        weekdayMidpoint,
        weekendMidpoint,
        deltaHours:
          weekdayMidpoint == null || weekendMidpoint == null
            ? null
            : weekendMidpoint - weekdayMidpoint,
      };
    },
  };
}

export function selectNearestSleepPoint<T extends { date: Date }>(
  series: T[],
  date: Date,
) {
  if (series.length === 0) return null;
  let selected = series[0];
  let distance = Math.abs(series[0].date.getTime() - date.getTime());
  for (const item of series.slice(1)) {
    const nextDistance = Math.abs(item.date.getTime() - date.getTime());
    if (nextDistance < distance) {
      selected = item;
      distance = nextDistance;
    }
  }
  return selected;
}

const EARLY_MORNING = [
  "Rise & Shine ☀️",
  "Morning, Champ! 🏆",
  "Early Bird Mode 🐦",
  "Fresh Start! ✨",
  "Coffee O'Clock ☕",
];

const MORNING = [
  "Crushing It! 💪",
  "You Got This! ⭐",
  "Carpe Diem! 🌟",
  "Boss Mode! 😎",
];
const AFTERNOON = [
  "Good Afternoon! 🌤️",
  "Still Going! 💪",
  "Keep Crushing! 🔥",
  "Power Through! ⚡",
];
const EVENING = [
  "Good Evening! 🌆",
  "Wind Down Time 🍃",
  "Relax Mode 🧘",
  "Golden Hour ⭐",
];
const NIGHT = [
  "Good Night 🌙",
  "Sleep Soon! 💤",
  "Rest Up! 🛏️",
  "Dim The Lights! 💡",
];
const HOUR_BEFORE_SLEEP = ["Bedtime Soon! 🛏️", "Wind Down! 🌙", "Get Cozy! 🧸"];
const HOUR_AFTER_WAKE = [
  "Awake Champion! 🏆",
  "Fresh & Ready! 🌟",
  "Go Time! 🎯",
];
const SHOULD_BE_SLEEPING = [
  "Why Up? 🤨",
  "Sleep, Please! 😴",
  "Go To Sleep! 💤",
];
const CURRENTLY_SLEEPING = ["Sweet Dreams 🌙", "Rest Well 💤", "Dream Big 🌟"];

function pick<T>(values: T[], seed = 0) {
  return values[Math.abs(Math.trunc(seed)) % values.length];
}

function shouldBeSleepingNow(
  currentMinutes: number,
  sleepMinutes: number,
  wakeMinutes: number,
) {
  if (sleepMinutes > wakeMinutes) {
    return currentMinutes >= sleepMinutes || currentMinutes < wakeMinutes;
  }
  return currentMinutes >= sleepMinutes && currentMinutes < wakeMinutes;
}

export function getSleepGreeting(
  optimalSleepMinutes: number,
  optimalWakeMinutes: number,
  isSleeping: boolean,
  now = new Date(),
  variantSeed = 0,
) {
  if (isSleeping) {
    return pick(CURRENTLY_SLEEPING, variantSeed);
  }

  const currentMinutes = minutesFromDate(now);
  const minutesBeforeSleep = optimalSleepMinutes - currentMinutes;
  if (minutesBeforeSleep > 0 && minutesBeforeSleep <= 60) {
    return pick(HOUR_BEFORE_SLEEP, variantSeed);
  }

  const minutesAfterWake = currentMinutes - optimalWakeMinutes;
  if (minutesAfterWake >= 0 && minutesAfterWake <= 60) {
    return pick(HOUR_AFTER_WAKE, variantSeed);
  }

  if (
    shouldBeSleepingNow(currentMinutes, optimalSleepMinutes, optimalWakeMinutes)
  ) {
    return pick(SHOULD_BE_SLEEPING, variantSeed);
  }

  const hour = now.getHours();
  if (hour >= 5 && hour < 9) return pick(EARLY_MORNING, variantSeed);
  if (hour >= 9 && hour < 12) return pick(MORNING, variantSeed);
  if (hour >= 12 && hour < 17) return pick(AFTERNOON, variantSeed);
  if (hour >= 17 && hour < 20) return pick(EVENING, variantSeed);
  return pick(NIGHT, variantSeed);
}
