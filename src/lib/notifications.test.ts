import * as Notifications from "expo-notifications";
import {
  ensureNotificationPermission,
  scheduleWindDownReminder,
} from "./notifications";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));
const settings = {
  isOnboarded: true,
  optimalSleepMinutes: 90,
  optimalWakeMinutes: 420,
  windDownReminderEnabled: true,
  healthSyncEnabled: false,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
});
test("requests real permission when it can ask", async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: false, canAskAgain: true } as never);
  jest
    .mocked(Notifications.requestPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  expect(await ensureNotificationPermission()).toMatchObject({ granted: true });
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});
test("wraps three hours before bedtime across midnight and replaces the reminder", async () => {
  await scheduleWindDownReminder(settings);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    "wind-down-reminder",
  );
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: "wind-down-reminder",
      trigger: expect.objectContaining({ hour: 22, minute: 30, type: "daily" }),
    }),
  );
});
test("disabled or denied cancels without scheduling or prompting", async () => {
  await scheduleWindDownReminder({
    ...settings,
    windDownReminderEnabled: false,
  });
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);
  await scheduleWindDownReminder(settings);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test("replaces schedules for changed bedtime and timezone reconciliation without stacking", async () => {
  await Promise.all([
    scheduleWindDownReminder(settings),
    scheduleWindDownReminder({ ...settings, optimalSleepMinutes: 23 * 60 }),
    scheduleWindDownReminder({ ...settings, optimalSleepMinutes: 23 * 60 }),
  ]);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(
    3,
  );
  expect(Notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({
      identifier: "wind-down-reminder",
      trigger: expect.objectContaining({ hour: 20, minute: 0 }),
    }),
  );
});
test("permission denial does not re-prompt when system requires settings recovery", async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: false, canAskAgain: false } as never);
  expect(await ensureNotificationPermission()).toMatchObject({
    granted: false,
  });
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
