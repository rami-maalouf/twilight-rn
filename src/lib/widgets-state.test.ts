import { buildWidgetSnapshot } from './widgets-state';
import type { HydratedAppState, SleepSession } from './types';

const now = new Date(2026, 10, 8, 12);
const state: HydratedAppState = {
  ready: true, sessions: [], activeSessionId: null, currentErrorMessage: null,
  sleepSettings: { isOnboarded: true, optimalSleepMinutes: 23 * 60, optimalWakeMinutes: 7 * 60, windDownReminderEnabled: false, healthSyncEnabled: false },
  appearance: { themeMode: 'System', colorPalette: 'Twilight' },
  demoRestore: { isDemoActive: false, backupArchiveJson: null, backupCreatedAt: null },
  appState: { pendingExternalAction: null, lastViewedTab: 'home' },
};
const session = (minutes: number, end = new Date(2026, 10, 8, 7)): SleepSession => ({
  id: 'sleep', tag: 'Manual Log', startTime: new Date(+end - minutes * 60000).toISOString(), endTime: end.toISOString(),
  startTimeZoneIdentifier: null, endTimeZoneIdentifier: null, needsHealthKitSync: false, healthKitSyncVersion: 2,
});

test('empty data has no invented metrics and preserves overnight targets', () => {
  expect(buildWidgetSnapshot(state, now)).toMatchObject({ status: 'Ready for rest', latestDuration: 'No sleep yet', weeklyAverage: 'No sleep yet', weeklyDetail: '0 of 7 nights logged', target: '11:00 PM - 7:00 AM', goal: '8 hr', demo: false });
});
test('only completed sessions of at least five minutes enter summaries', () => {
  expect(buildWidgetSnapshot({ ...state, sessions: [session(4.99)] }, now).latestDuration).toBe('No sleep yet');
  expect(buildWidgetSnapshot({ ...state, sessions: [session(5)] }, now)).toMatchObject({ latestDuration: '5 min', weeklyAverage: '5 min', weeklyDetail: '1 of 7 nights logged' });
});
test('active status uses a start date instead of claiming a live elapsed duration', () => {
  const active = { ...session(480), endTime: null };
  expect(buildWidgetSnapshot({ ...state, sessions: [active], activeSessionId: active.id }, now)).toMatchObject({ status: 'Sleep in progress', latestDuration: 'No sleep yet' });
  expect(buildWidgetSnapshot({ ...state, sessions: [active], activeSessionId: active.id }, now).statusDetail).toContain('Started');
});
test('weekly summary uses current calendar days and does not relabel old data last night', () => {
  const old = session(480, new Date(2026, 9, 1, 7));
  expect(buildWidgetSnapshot({ ...state, sessions: [old] }, now)).toMatchObject({ latestDuration: '8 hr', weeklyAverage: 'No sleep yet', weeklyDetail: '0 of 7 nights logged' });
  expect(buildWidgetSnapshot({ ...state, sessions: [old] }, now).latestLabel).toContain('Oct');
});
test('canonical nightly analytics, demo marker and appearance are preserved', () => {
  const snapshot = buildWidgetSnapshot({ ...state, sessions: [session(480), { ...session(60), id: 'nap' }], appearance: { themeMode: 'Sunset', colorPalette: 'Amethyst' }, demoRestore: { ...state.demoRestore, isDemoActive: true } }, now);
  expect(snapshot).toMatchObject({ weeklyAverage: '8 hr', weeklyDetail: '1 of 7 nights logged', demo: true, themeMode: 'Sunset', colorPalette: 'Amethyst' });
});
