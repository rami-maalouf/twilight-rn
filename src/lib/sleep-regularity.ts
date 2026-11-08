import { addDays } from "./format";

export type SleepRegularityWindow = 7 | 14 | 28;
export type SleepInterval = { start: Date; end: Date };
export type SleepRegularityPoint = {
  date: Date;
  dayToDayScore: number | null;
  rollingScore: number | null;
  comparisonDays: number;
  segment: number;
};
const DAY = 86400000;
function noon(date: Date) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  return date < result ? addDays(result, -1) : result;
}
function merged(intervals: SleepInterval[]) {
  const result: SleepInterval[] = [];
  for (const interval of intervals.sort((a, b) => +a.start - +b.start)) {
    const last = result.at(-1);
    if (last && interval.start <= last.end)
      last.end = new Date(Math.max(+last.end, +interval.end));
    else result.push({ ...interval });
  }
  return result;
}

// logged sleep is compared exactly as binary states; missing days are unknown.
export function sleepRegularitySeries(
  intervals: SleepInterval[],
  days: number | null = null,
  window: SleepRegularityWindow = 7,
  referenceDate = new Date(),
): SleepRegularityPoint[] {
  const valid = intervals.filter(
    ({ start, end }) =>
      +end > +start && +end - +start <= DAY && end <= referenceDate,
  );
  if (!valid.length || (days != null && days <= 0)) return [];
  const recorded = new Map<number, SleepInterval[]>();
  for (const interval of valid) {
    for (
      let start = noon(interval.start);
      start < interval.end;
      start = addDays(start, 1)
    ) {
      const end = addDays(start, 1);
      if (end > referenceDate || +end - +start !== DAY) continue;
      const clipped = {
        start: new Date(Math.max(+start, +interval.start)),
        end: new Date(Math.min(+end, +interval.end)),
      };
      if (clipped.end <= clipped.start) continue;
      recorded.set(+start, [...(recorded.get(+start) ?? []), clipped]);
    }
  }
  for (const [date, values] of recorded) recorded.set(date, merged(values));
  const scores = new Map<number, number>();
  for (const [start, current] of recorded) {
    const next = recorded.get(start + DAY);
    if (!next) continue;
    let overlap = 0;
    for (const left of current)
      for (const right of next) {
        overlap += Math.max(
          0,
          Math.min(+left.end, +right.end - DAY) -
            Math.max(+left.start, +right.start - DAY),
        );
      }
    const duration = [...current, ...next].reduce(
      (sum, value) => sum + +value.end - +value.start,
      0,
    );
    scores.set(start + 2 * DAY, 100 - (200 * (duration - 2 * overlap)) / DAY);
  }
  const last = noon(referenceDate);
  let first = addDays(
    noon(new Date(Math.min(...valid.map((v) => +v.start)))),
    1,
  );
  if (days != null)
    first = new Date(Math.max(+first, +addDays(last, -(days - 1))));
  const result: SleepRegularityPoint[] = [];
  let segment = 0;
  for (let end = first; end <= last; end = addDays(end, 1)) {
    const comparisons: number[] = [];
    for (let offset = 0; offset < window - 1; offset++) {
      const score = scores.get(+addDays(end, -offset));
      if (score != null) comparisons.push(score);
    }
    const rollingScore =
      comparisons.length === window - 1
        ? comparisons.reduce((a, b) => a + b, 0) / comparisons.length
        : null;
    if (rollingScore == null) segment++;
    result.push({
      date: end,
      dayToDayScore: scores.get(+end) ?? null,
      rollingScore,
      comparisonDays: comparisons.length,
      segment,
    });
  }
  return result;
}
