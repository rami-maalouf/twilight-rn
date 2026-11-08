import { useAppStore } from "./store";
import { setSleepSettings, upsertSession } from "./db";
import { scheduleWindDownReminder } from "./notifications";

jest.mock("./db", () => ({
  makeSession: () => ({ id: "new", tag: "Manual Log" }),
  upsertSession: jest.fn(),
  getHydratedState: async () => ({}),
  setSleepSettings: jest.fn(),
}));
jest.mock("./archive", () => ({}));
jest.mock("./demo", () => ({}));
jest.mock("./exporters", () => ({}));
jest.mock("./notifications", () => ({ scheduleWindDownReminder: jest.fn() }));

test("explicit missing zone metadata stays missing instead of being rewritten to the device zone", async () => {
  await useAppStore
    .getState()
    .upsertSleepLog({
      id: "existing",
      startTime: "2026-07-02T03:00:00Z",
      endTime: "2026-07-02T11:00:00Z",
      startTimeZoneIdentifier: null,
      endTimeZoneIdentifier: null,
    });
  expect(upsertSession).toHaveBeenCalledWith(
    expect.objectContaining({
      startTimeZoneIdentifier: null,
      endTimeZoneIdentifier: null,
    }),
  );
});
test("saved settings remain visible even if native scheduling fails", async () => {
  const settings = {
    ...useAppStore.getState().sleepSettings,
    optimalSleepMinutes: 1380,
  };
  jest.mocked(setSleepSettings).mockResolvedValue(settings);
  jest
    .mocked(scheduleWindDownReminder)
    .mockRejectedValue(new Error("Scheduling unavailable"));
  await expect(
    useAppStore.getState().updateSleepSettings({ optimalSleepMinutes: 1380 }),
  ).rejects.toThrow("Scheduling unavailable");
  expect(useAppStore.getState().sleepSettings.optimalSleepMinutes).toBe(1380);
});
