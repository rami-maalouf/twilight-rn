import { addDays, formatClock, formatDay, formatDurationLong, formatTime, startOfDay } from './format';
import { buildSleepMetrics } from './sleep';
import type { HydratedAppState } from './types';

export function buildWidgetSnapshot(state: HydratedAppState, now = new Date()) {
  const { optimalSleepMinutes, optimalWakeMinutes } = state.sleepSettings;
  const metrics = buildSleepMetrics(state.sessions, optimalSleepMinutes, optimalWakeMinutes);
  const today = startOfDay(now);
  const records = metrics.records.filter((record) => startOfDay(record.date) <= today);
  const weekly = records.filter((record) => startOfDay(record.date) >= addDays(today, -6));
  const latest = records.at(-1);
  const average = metrics.averageDuration(weekly);
  const active = state.sessions.find((session) => session.id === state.activeSessionId && session.endTime == null);
  const start = active ? new Date(active.startTime) : null;
  return {
    status: active ? 'Sleep in progress' : 'Ready for rest',
    statusDetail: start && Number.isFinite(+start) ? `Started ${formatDay(start)}, ${formatTime(start)}` : 'Track your next sleep in Twilight',
    latestLabel: latest ? `Sleep ending ${formatDay(latest.date)}` : 'Your sleep history',
    latestDuration: latest ? formatDurationLong(latest.durationHours * 3600) : 'No sleep yet',
    weeklyAverage: average == null ? 'No sleep yet' : formatDurationLong(average * 3600),
    weeklyDetail: `${weekly.length} of 7 nights logged`,
    weeklyRange: `${formatDay(addDays(today, -6))} - ${formatDay(today)}`,
    goal: formatDurationLong(metrics.targetDurationHours * 3600),
    target: `${formatClock(optimalSleepMinutes)} - ${formatClock(optimalWakeMinutes)}`,
    demo: state.demoRestore.isDemoActive,
    themeMode: state.appearance.themeMode,
    colorPalette: state.appearance.colorPalette,
  };
}

export type SleepWidgetProps = ReturnType<typeof buildWidgetSnapshot>;
