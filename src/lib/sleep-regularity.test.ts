import { sleepRegularitySeries } from "./sleep-regularity";
const day = 86400000;
const base = new Date(2026, 8, 1, 12).getTime();
const sleep = (index: number, offset = 11, hours = 8) => ({
  start: new Date(base + index * day + offset * 3600000),
  end: new Date(base + index * day + (offset + hours) * 3600000),
});
const week = Array.from({ length: 7 }, (_, i) => sleep(i));
const now = new Date(base + 7 * day);
test.each([7, 14, 28] as const)(
  "%i-day windows require all adjacent comparisons",
  (window) => {
    const result = sleepRegularitySeries(
      Array.from({ length: window }, (_, i) => sleep(i, 11 + (i % 2))),
      null,
      window,
      new Date(base + window * day),
    );
    expect(result.at(-1)?.rollingScore).toBeCloseTo(83.333333333);
    expect(result.at(-1)?.comparisonDays).toBe(window - 1);
    expect(result.slice(0, -1).every((p) => p.rollingScore == null)).toBe(true);
  },
);
test("unions overlapping intervals and includes naps", () => {
  expect(
    sleepRegularitySeries([...week, ...week, sleep(0, 12, 2)], null, 7, now).at(
      -1,
    )?.rollingScore,
  ).toBe(100);
  expect(
    sleepRegularitySeries(
      [...week, ...[0, 2, 4, 6].map((i) => sleep(i, 2, 1))],
      null,
      7,
      now,
    ).at(-1)?.rollingScore,
  ).toBeCloseTo(91.666666667);
});
test("gaps do not count as awake or bridge comparisons; stale history is insufficient", () => {
  const result = sleepRegularitySeries(
    week.filter((_, i) => i !== 3),
    null,
    7,
    now,
  );
  expect(result.at(-1)?.rollingScore).toBeNull();
  expect(result.at(-1)?.comparisonDays).toBe(4);
  expect(
    sleepRegularitySeries(week, null, 7, new Date(base + 20 * day)).at(-1)
      ?.rollingScore,
  ).toBeNull();
});
test("range clipping retains full lookback", () => {
  const full = sleepRegularitySeries(week, null, 7, now);
  expect(
    sleepRegularitySeries(week, 2, 7, now).map(
      ({ segment, ...point }) => point,
    ),
  ).toEqual(full.slice(-2).map(({ segment, ...point }) => point));
});
test("opposite schedules can score negative", () => {
  expect(
    sleepRegularitySeries(
      week.map((_, i) => sleep(i, i % 2 ? 12 : 0, 12)),
      null,
      7,
      now,
    ).at(-1)?.rollingScore,
  ).toBe(-100);
});
test("future, incomplete, and overlong intervals are excluded", () => {
  expect(sleepRegularitySeries([sleep(0, 0, 48)], null, 7, now)).toEqual([]);
  expect(
    sleepRegularitySeries(
      week,
      null,
      7,
      new Date(base + 6 * day + 20 * 3600000),
    ).at(-1)?.comparisonDays,
  ).toBe(5);
});
test.each([new Date(2026, 2, 5, 23), new Date(2026, 9, 29, 23)])(
  "local DST transitions leave gaps",
  (start) => {
    const intervals = Array.from({ length: 9 }, (_, i) => {
      const night = new Date(start);
      night.setDate(night.getDate() + i);
      const morning = new Date(night);
      morning.setDate(morning.getDate() + 1);
      morning.setHours(7);
      return { start: night, end: morning };
    });
    const end = new Date(intervals.at(-1)!.end);
    end.setHours(12);
    const result = sleepRegularitySeries(intervals, null, 7, end);
    expect(result.filter((p) => p.dayToDayScore == null)).toHaveLength(
      intervals[0].start.getTimezoneOffset() ===
        intervals.at(-1)!.start.getTimezoneOffset()
        ? 1
        : 3,
    );
    expect(
      result
        .flatMap((p) => (p.dayToDayScore == null ? [] : [p.dayToDayScore]))
        .every((v) => v === 100),
    ).toBe(true);
  },
);

test("fragmentation and noon crossings remain identical binary states", () => {
  const intervals = Array.from({ length: 9 }, (_, i) => [
    sleep(i, -1, 3),
    sleep(i, 12, 3),
    sleep(i, 16, 3),
  ]).flat();
  const series = sleepRegularitySeries(
    intervals,
    null,
    7,
    new Date(base + 10 * day),
  );
  expect(
    series.find((point) => +point.date === base + 7 * day)?.rollingScore,
  ).toBe(100);
});

test("exact interval agreement matches an independent minute-state oracle", () => {
  const intervals = Array.from({ length: 7 }, (_, i) => [
    sleep(i, 8 + ((i * 7) % 5) / 2, 6 + (i % 3)),
    sleep(i, 2, ((i % 4) + 1) / 4),
  ]).flat();
  let matches = 0;
  for (let minute = 0; minute < 6 * 1440; minute++) {
    const time = base + (minute + 0.5) * 60000;
    const asleep = (value: number) =>
      intervals.some(
        (interval) => +interval.start <= value && value < +interval.end,
      );
    if (asleep(time) === asleep(time + day)) matches++;
  }
  const expected = (200 * matches) / (6 * 1440) - 100;
  expect(
    sleepRegularitySeries(intervals, null, 7, now).at(-1)?.rollingScore,
  ).toBeCloseTo(expected, 8);
});
