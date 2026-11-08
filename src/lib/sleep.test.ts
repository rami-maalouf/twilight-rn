import {
  buildSleepMetrics,
  clipSleepSeries,
  sleepStreaks,
  isValidSession,
  calculateAccuracy,
  calculateSleepConsistency,
  calculateWakeConsistency,
  canonicalSessions,
  getSleepGreeting,
  processWeeklySleepData,
  sessionDurationSeconds,
} from "@/lib/sleep";
import type { SleepSession } from "@/lib/types";

function makeSession(
  id: string,
  startTime: string,
  endTime: string | null,
  partial?: Partial<SleepSession>,
): SleepSession {
  return {
    id,
    tag: "Manual Log",
    startTime,
    endTime,
    startTimeZoneIdentifier: "UTC",
    endTimeZoneIdentifier: "UTC",
    needsHealthKitSync: true,
    healthKitSyncVersion: 2,
    ...partial,
  };
}

describe("sleep metrics utilities", () => {
  test("sessionDurationSeconds computes elapsed seconds from ISO timestamps", () => {
    const session = makeSession(
      "s1",
      "2026-04-01T23:00:00.000Z",
      "2026-04-02T07:00:00.000Z",
    );
    expect(sessionDurationSeconds(session)).toBe(8 * 60 * 60);
  });

  test("canonicalSessions keeps the longest valid session per wake day", () => {
    const sessions = [
      makeSession(
        "short",
        "2026-04-02T00:00:00.000Z",
        "2026-04-02T05:00:00.000Z",
      ),
      makeSession(
        "long",
        "2026-04-01T22:00:00.000Z",
        "2026-04-02T07:30:00.000Z",
      ),
      makeSession(
        "other-day",
        "2026-04-02T23:00:00.000Z",
        "2026-04-03T07:00:00.000Z",
      ),
    ];

    expect(canonicalSessions(sessions).map((session) => session.id)).toEqual([
      "long",
      "other-day",
    ]);
  });

  test("processWeeklySleepData returns a seven-day window ending on the latest completed night", () => {
    const sessions = [
      makeSession("s1", "2026-04-01T23:00:00.000Z", "2026-04-02T07:00:00.000Z"),
      makeSession("s2", "2026-04-03T23:30:00.000Z", "2026-04-04T07:30:00.000Z"),
      makeSession("s3", "2026-04-05T22:45:00.000Z", "2026-04-06T06:45:00.000Z"),
    ];

    const weekly = processWeeklySleepData(sessions);

    expect(weekly).toHaveLength(7);
    expect(weekly.at(-1)?.date.toISOString()).toContain("2026-04-06");
    expect(weekly.filter((entry) => entry.duration > 0)).toHaveLength(3);
  });

  test("consistency and accuracy scores stay high for near-target sleep timing", () => {
    const sessions = [
      makeSession("s1", "2026-04-01T23:00:00.000Z", "2026-04-02T07:00:00.000Z"),
      makeSession("s2", "2026-04-02T23:10:00.000Z", "2026-04-03T07:05:00.000Z"),
      makeSession("s3", "2026-04-03T22:55:00.000Z", "2026-04-04T06:50:00.000Z"),
      makeSession("s4", "2026-04-04T23:05:00.000Z", "2026-04-05T07:15:00.000Z"),
    ];

    const weekly = processWeeklySleepData(sessions);

    expect(calculateSleepConsistency(weekly)).toBeGreaterThan(90);
    expect(calculateWakeConsistency(weekly)).toBeGreaterThan(90);
    expect(calculateAccuracy(weekly, 23 * 60, 7 * 60)).toBeGreaterThan(90);
  });

  test("buildSleepMetrics summarizes duration, buckets, and debt correctly", () => {
    const sessions = [
      makeSession("s1", "2026-04-01T23:00:00.000Z", "2026-04-02T07:00:00.000Z"),
      makeSession("s2", "2026-04-02T23:30:00.000Z", "2026-04-03T07:00:00.000Z"),
      makeSession("s3", "2026-04-03T22:30:00.000Z", "2026-04-04T07:00:00.000Z"),
      makeSession("s4", "2026-04-04T23:30:00.000Z", "2026-04-05T05:30:00.000Z"),
    ];

    const metrics = buildSleepMetrics(sessions, 23 * 60, 7 * 60);
    const records = metrics.recordsInRange("All");
    const buckets = metrics.durationBuckets(records);
    const debt = metrics.cumulativeDebtSeries(records);

    expect(records).toHaveLength(4);
    expect(metrics.averageDuration(records)).toBeCloseTo(7.5, 5);
    expect(metrics.goalHitRate(records)).toBe(75);
    expect(buckets.find((bucket) => bucket.label === "6-6.5h")?.count).toBe(1);
    expect(buckets.find((bucket) => bucket.label === "7.5-8h")?.count).toBe(1);
    expect(buckets.find((bucket) => bucket.label === "8h+")?.count).toBe(2);
    expect(debt.at(-1)?.cumulativeHours).toBeCloseTo(-2, 5);
  });

  test("getSleepGreeting matches the active state and schedule windows", () => {
    const atLocalTime = (hour: number, minute = 0) =>
      new Date(2026, 3, 7, hour, minute, 0, 0);

    expect(getSleepGreeting(23 * 60, 7 * 60, true, atLocalTime(2))).toBe(
      "Sweet Dreams 🌙",
    );
    expect(getSleepGreeting(22 * 60, 7 * 60, false, atLocalTime(21, 30))).toBe(
      "Bedtime Soon! 🛏️",
    );
    expect(getSleepGreeting(22 * 60, 7 * 60, false, atLocalTime(2))).toBe(
      "Why Up? 🤨",
    );
  });
});

describe("swift analytics parity", () => {
  test("duration uses asymmetric exponential penalties and geometric core", () => {
    const metrics = buildSleepMetrics([], 23 * 60, 7 * 60);
    const record = {
      date: new Date(2026, 3, 2),
      weekday: 5,
      durationHours: 7,
      bedtimeOffset: 5,
      wakeOffset: 12,
      midpointOffset: 8.5,
    };
    const short = metrics.sleepAlignmentSeries([record])[0];
    expect(short.durationScore).toBeCloseTo(52.7292424, 5);
    expect(short.timingScore).toBeCloseTo(87.5, 5);
    expect(short.phaseScore).toBeCloseTo(94.5959469, 5);
    expect(short.coreScore).toBeCloseTo(63.8904684, 3);
    expect(
      metrics.sleepAlignmentSeries([
        { ...record, durationHours: 9, midpointOffset: 9.5 },
      ])[0].durationScore,
    ).toBeCloseTo(77.8800783, 5);
  });
  test("streaks deduplicate, handle stale history, and retain longest run", () => {
    const dates = [7, 8, 9, 9].map((day) => new Date(2026, 2, day));
    expect(sleepStreaks(dates, new Date(2026, 2, 10))).toEqual({
      current: 3,
      longest: 3,
    });
    expect(sleepStreaks(dates, new Date(2026, 2, 12))).toEqual({
      current: 0,
      longest: 3,
    });
  });
  test("valid completed sessions require five finite elapsed minutes", () => {
    expect(
      isValidSession(
        makeSession("a", "2026-04-01T00:00:00Z", "2026-04-01T00:04:59Z"),
      ),
    ).toBe(false);
    expect(
      isValidSession(
        makeSession("b", "2026-04-01T00:00:00Z", "2026-04-01T00:05:00Z"),
      ),
    ).toBe(true);
    expect(isValidSession(makeSession("c", "bad", "bad"))).toBe(false);
  });
});

test("history is warmed before clipping duration, timing, debt and score trends", () => {
  const sessions = Array.from({ length: 40 }, (_, i) => {
    const start = new Date(Date.UTC(2026, 0, 1 + i, 23));
    return makeSession(
      `${i}`,
      start.toISOString(),
      new Date(+start + (i < 10 ? 7 : 8) * 3600000).toISOString(),
    );
  });
  const metrics = buildSleepMetrics(sessions, 23 * 60, 7 * 60);
  const visible = metrics.records.slice(-3);
  const clip = <T extends { date: Date }>(points: T[]) =>
    clipSleepSeries(points, visible);
  expect(
    clip(metrics.movingAverageSeries(metrics.records, 30))[0]
      .movingAverageHours,
  ).toBeCloseTo(7.933333333);
  expect(
    clip(metrics.timingMovingAverageSeries(metrics.records, "bedtimeOffset"))[0]
      .movingAverageOffset,
  ).toBe(5);
  expect(
    clip(metrics.cumulativeDebtSeries(metrics.records))[0].cumulativeHours,
  ).toBe(-10);
  const score = clip(metrics.sleepAlignmentSeries(metrics.records))[0];
  expect(score.trendScore).toBeGreaterThan(99);
  expect(score.trendScore).toBeLessThan(100);
  expect(score.coreTrendScore).toBeLessThan(100);
});

test("alignment omits components at or below one percent and uses population variance", () => {
  const metrics = buildSleepMetrics([], 23 * 60, 7 * 60);
  const score = metrics.sleepAlignmentSeries([
    {
      date: new Date(2026, 0, 1),
      weekday: 5,
      durationHours: 1,
      bedtimeOffset: 5,
      wakeOffset: 6,
      midpointOffset: 5.5,
    },
  ])[0];
  expect(score.durationScore).toBeLessThan(1);
  expect(score.coreScore).toBe(100);
  expect(score.dailyScore).toBeCloseTo(16.57376624, 5);
  const records = [7, 9].map((durationHours, i) => ({
    date: new Date(2026, 0, i + 1),
    weekday: 5,
    durationHours,
    bedtimeOffset: 5,
    wakeOffset: 5 + durationHours,
    midpointOffset: 5 + durationHours / 2,
  }));
  expect(metrics.sleepAlignmentSeries(records)[1].consistencyScore).toBeCloseTo(
    73.91737858,
    6,
  );
});

test("SRI adapter keeps naps instead of using canonical nights only", () => {
  const base = new Date(2026, 8, 1, 12).getTime();
  const interval = (day: number, offset: number, hours: number) =>
    makeSession(
      `${day}-${offset}`,
      new Date(base + (day * 24 + offset) * 3600000).toISOString(),
      new Date(base + (day * 24 + offset + hours) * 3600000).toISOString(),
    );
  const sessions = Array.from({ length: 7 }, (_, i) => interval(i, 11, 8));
  sessions.push(...[0, 2, 4, 6].map((i) => interval(i, 2, 1)));
  const metrics = buildSleepMetrics(sessions, 23 * 60, 7 * 60);
  expect(metrics.records).toHaveLength(8);
  expect(
    metrics
      .sleepRegularitySeries("All", 7, new Date(base + 7 * 86400000))
      .at(-1)?.rollingScore,
  ).toBeCloseTo(91.666666667);
});
