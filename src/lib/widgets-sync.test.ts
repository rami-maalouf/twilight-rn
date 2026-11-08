import { createWidgetSync } from './widgets-sync';
import type { HydratedAppState } from './types';

const saved = (demo: boolean): HydratedAppState => ({
  ready: true, sessions: [], activeSessionId: null, currentErrorMessage: null,
  sleepSettings: { isOnboarded: true, optimalSleepMinutes: 1380, optimalWakeMinutes: 420, windDownReminderEnabled: false, healthSyncEnabled: false },
  appearance: { themeMode: 'System', colorPalette: 'Twilight' },
  demoRestore: { isDemoActive: demo, backupArchiveJson: null, backupCreatedAt: null },
  appState: { pendingExternalAction: null, lastViewedTab: 'home' },
});
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test('a new invalidation discards an older demo read and publishes persisted replacement', async () => {
  let complete!: (state: HydratedAppState) => void;
  const load = jest.fn().mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; })).mockResolvedValue(saved(false));
  const publish = jest.fn();
  const sync = createWidgetSync(load, publish);
  sync.request();
  sync.request();
  complete(saved(true));
  await settle();
  expect(publish).toHaveBeenCalledTimes(1);
  expect(publish.mock.calls[0][0].demo).toBe(false);
});
test('read and publication failures recover on the next invalidation', async () => {
  const load = jest.fn().mockRejectedValueOnce(new Error('database')).mockResolvedValue(saved(false));
  const publish = jest.fn().mockImplementationOnce(() => { throw new Error('native'); });
  const sync = createWidgetSync(load, publish);
  sync.request(); await settle();
  sync.request(); await settle();
  sync.request(); await settle();
  expect(publish).toHaveBeenCalledTimes(2);
});
test('unmount prevents an outstanding read publishing', async () => {
  const publish = jest.fn();
  const sync = createWidgetSync(async () => saved(false), publish);
  sync.request(); sync.dispose();
  await settle();
  expect(publish).not.toHaveBeenCalled();
});
