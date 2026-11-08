import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import type { SleepSettings } from "@/lib/types";

const reminderId = "wind-down-reminder";
const channelId = "wind-down";

async function prepareChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: "Wind-down reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function ensureNotificationPermission() {
  await prepareChannel();
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted || !permission.canAskAgain) return permission;
  return Notifications.requestPermissionsAsync();
}

export function openNotificationSettings() {
  return Linking.openSettings();
}

let pending: Promise<unknown> = Promise.resolve();

// serialize replacement so rapid target changes cannot leave duplicate reminders.
export function scheduleWindDownReminder(settings: SleepSettings) {
  const next = { ...settings };
  const task = pending
    .catch(() => undefined)
    .then(async () => {
      await Notifications.cancelScheduledNotificationAsync(reminderId);
      if (!next.windDownReminderEnabled) return;
      await prepareChannel();
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return;
      const minutes = (((next.optimalSleepMinutes - 180) % 1440) + 1440) % 1440;
      await Notifications.scheduleNotificationAsync({
        identifier: reminderId,
        content: {
          title: "Wind Down Time",
          body: "3 hours to bedtime. Dim the lights, finish your last meal, and make time to relax.",
          sound: "default",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
        },
      });
    });
  pending = task;
  return task;
}
