import { create } from "zustand";

import {
  exportArchiveJson,
  importArchiveJson,
  previewArchiveImport,
} from "@/lib/archive";
import {
  deleteSession,
  getHydratedState,
  makeSession,
  setAppState,
  setAppearance,
  setSleepSettings,
  upsertSession,
} from "@/lib/db";
import { importDemoData, exitDemoData } from "@/lib/demo";
import { exportSessionsCsv, exportSessionsMarkdown } from "@/lib/exporters";
import { scheduleWindDownReminder } from "@/lib/notifications";
import { sessionDurationSeconds } from "@/lib/sleep";
import type {
  AppearanceSettings,
  SleepSession,
  HydratedAppState,
  SleepSettings,
} from "@/lib/types";

type AppStore = HydratedAppState & {
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
  setLastViewedTab: (tab: string) => Promise<void>;
  updateAppearance: (partial: Partial<AppearanceSettings>) => Promise<void>;
  updateSleepSettings: (partial: Partial<SleepSettings>) => Promise<void>;
  startSleepSession: () => Promise<void>;
  stopActiveSession: () => Promise<void>;
  upsertSleepLog: (input: Partial<SleepSession>) => Promise<void>;
  removeSleepLog: (sessionId: string) => Promise<void>;
  importDemoMode: () => Promise<void>;
  exitDemoMode: () => Promise<void>;
  exportCsv: () => Promise<string>;
  exportMarkdown: () => Promise<string>;
  exportBackup: () => Promise<string>;
  previewImport: (json: string) => Promise<Awaited<ReturnType<typeof previewArchiveImport>>>;
  importBackup: (json: string) => Promise<void>;
};

async function afterDataMutation(set: (state: Partial<AppStore>) => void) {
  const next = await getHydratedState();
  set(next);
}

function setError(set: (state: Partial<AppStore>) => void, currentErrorMessage: string) {
  set({ currentErrorMessage });
}

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  sessions: [],
  sleepSettings: {
    isOnboarded: false,
    optimalSleepMinutes: 22 * 60,
    optimalWakeMinutes: 7 * 60,
    windDownReminderEnabled: true,
    healthSyncEnabled: false,
  },
  appearance: {
    themeMode: "Night Sky",
    colorPalette: "Twilight",
  },
  demoRestore: {
    backupArchiveJson: null,
    backupCreatedAt: null,
    isDemoActive: false,
  },
  appState: {
    pendingExternalAction: null,
    lastViewedTab: "home",
  },
  activeSessionId: null,
  currentErrorMessage: null,

  async hydrate() {
    try {
      const hydrated = await getHydratedState();
      set(hydrated);
    } catch (error) {
      set({
        ready: true,
        currentErrorMessage:
          error instanceof Error
            ? `Twilight failed to load local data: ${error.message}`
            : "Twilight failed to load local data.",
      });
    }
  },

  async refresh() {
    await afterDataMutation(set);
  },

  clearError() {
    set({ currentErrorMessage: null });
  },

  async setLastViewedTab(tab) {
    await setAppState({ lastViewedTab: tab });
    set({
      appState: {
        ...get().appState,
        lastViewedTab: tab,
      },
    });
  },

  async updateAppearance(partial) {
    const appearance = await setAppearance(partial);
    set({ appearance });
  },

  async updateSleepSettings(partial) {
    const sleepSettings = await setSleepSettings(partial);
    set({ sleepSettings });
    await scheduleWindDownReminder(sleepSettings);
  },

  async startSleepSession() {
    if (get().activeSessionId) {
      setError(set, "A sleep session is already active.");
      return;
    }

    const session = makeSession("Manual Log");
    await upsertSession(session);
    await afterDataMutation(set);
  },

  async stopActiveSession() {
    const state = get();
    const activeSession = state.sessions.find((session) => session.id === state.activeSessionId);
    if (!activeSession) {
      setError(set, "No active session to stop.");
      return;
    }

    const updatedSession: SleepSession = {
      ...activeSession,
      endTime: new Date().toISOString(),
      endTimeZoneIdentifier: Intl.DateTimeFormat().resolvedOptions().timeZone,
      needsHealthKitSync: true,
    };
    await upsertSession(updatedSession);
    await afterDataMutation(set);

    if (sessionDurationSeconds(updatedSession) < 5 * 60) {
      setError(set, "That session was too short to count as real sleep.");
    }
  },

  async upsertSleepLog(input) {
    const existing = input.id ? get().sessions.find((session) => session.id === input.id) : null;
    
    const session: SleepSession = {
      ...(existing ?? makeSession("Manual Log")),
      ...input,
      tag: input.tag ?? existing?.tag ?? "Manual Log",
      startTime: input.startTime ?? existing?.startTime ?? new Date().toISOString(),
      endTime: input.endTime ?? existing?.endTime ?? null,
      startTimeZoneIdentifier:
        input.startTimeZoneIdentifier !== undefined
          ? input.startTimeZoneIdentifier
          : existing ? existing.startTimeZoneIdentifier : Intl.DateTimeFormat().resolvedOptions().timeZone,
      endTimeZoneIdentifier:
        input.endTimeZoneIdentifier !== undefined
          ? input.endTimeZoneIdentifier
          : existing ? existing.endTimeZoneIdentifier : Intl.DateTimeFormat().resolvedOptions().timeZone,
      needsHealthKitSync: true,
      healthKitSyncVersion: existing?.healthKitSyncVersion ?? 2,
    };

    await upsertSession(session);
    await afterDataMutation(set);
  },

  async removeSleepLog(sessionId) {
    await deleteSession(sessionId);
    await afterDataMutation(set);
  },

  async importDemoMode() {
    await importDemoData();
    await afterDataMutation(set);
    set({
      demoRestore: {
        ...get().demoRestore,
        isDemoActive: true,
      },
    });
  },

  async exitDemoMode() {
    await exitDemoData();
    await afterDataMutation(set);
  },

  async exportCsv() {
    return exportSessionsCsv(get().sessions);
  },

  async exportMarkdown() {
    return exportSessionsMarkdown(get().sessions);
  },

  async exportBackup() {
    return exportArchiveJson();
  },

  async previewImport(json) {
    return previewArchiveImport(JSON.parse(json));
  },

  async importBackup(json) {
    await importArchiveJson(json);
    await afterDataMutation(set);
  },
}));

export function selectDemoMode(state: AppStore) {
  return state.demoRestore.isDemoActive;
}
