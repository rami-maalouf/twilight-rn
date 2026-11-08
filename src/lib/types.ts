export type ISODateString = string;

export type ThemeMode = "System" | "Sunset" | "Night Sky";
export type ColorPalette = "Twilight" | "Amethyst";

export type SleepMetricsRange = "30D" | "90D" | "1Y" | "All";

export type SleepSession = {
  id: string;
  tag: string;
  startTime: ISODateString;
  endTime: ISODateString | null;
  startTimeZoneIdentifier: string | null;
  endTimeZoneIdentifier: string | null;
  needsHealthKitSync: boolean;
  healthKitSyncVersion: number;
};

export type SleepSettings = {
  isOnboarded: boolean;
  optimalSleepMinutes: number;
  optimalWakeMinutes: number;
  windDownReminderEnabled: boolean;
  healthSyncEnabled: boolean;
};

export type AppearanceSettings = {
  themeMode: ThemeMode;
  colorPalette: ColorPalette;
};

export type DemoRestoreState = {
  backupArchiveJson: string | null;
  backupCreatedAt: ISODateString | null;
  isDemoActive: boolean;
};

export type AppStateRecord = {
  pendingExternalAction: string | null;
  lastViewedTab: string;
};

export type ArchiveMetadata = {
  archiveType: string;
  schemaVersion: number;
  exportedAt: ISODateString;
  timeZoneIdentifier: string;
  appVersion: string | null;
};

export type ArchivePayload = {
  metadata: ArchiveMetadata;
  sleepSettings: SleepSettings;
  appearance: AppearanceSettings;
  sessions: Record<string, unknown>[];
};

export type DataArchivePreview = {
  exportedAt: ISODateString;
  appVersion: string | null;
  sessionCount: number;
  newSessions: number;
  updatedSessions: number;
  settingsChanges: number;
  appearanceChanges: number;
};

export type DailySleepData = {
  dayLabel: string;
  date: Date;
  startOffset: number;
  endOffset: number;
  duration: number;
};

export type SleepNightRecord = {
  date: Date;
  weekday: number;
  durationHours: number;
  bedtimeOffset: number;
  wakeOffset: number;
  midpointOffset: number;
};

export type SleepMovingAveragePoint = {
  date: Date;
  durationHours: number;
  movingAverageHours: number | null;
};

export type SleepConsistencyPoint = {
  date: Date;
  sleepConsistency: number | null;
  wakeConsistency: number | null;
  scheduleAccuracy: number | null;
};

export type SleepDebtPoint = {
  date: Date;
  cumulativeHours: number;
};

export type SleepWeekdayAverage = {
  weekday: number;
  dayName: string;
  averageHours: number;
  nights: number;
};

export type SleepDurationBucket = {
  label: string;
  count: number;
  share: number;
};

export type SleepTrendPeriod = {
  days: number;
  averageDuration: number | null;
  previousAverageDuration: number | null;
  changePercent: number | null;
  sparkline: number[];
};

export type SleepAlignmentScorePoint = {
  date: Date;
  dailyScore: number;
  trendScore: number;
  coreScore: number;
  coreTrendScore: number;
  durationScore: number;
  timingScore: number;
  phaseScore: number;
  consistencyScore: number;
};

export type SleepTimingPoint = {
  date: Date;
  bedtimeOffset: number;
  wakeOffset: number;
  midpointOffset: number;
  durationHours: number;
};

export type SleepSocialJetlag = {
  weekdayMidpoint: number | null;
  weekendMidpoint: number | null;
  deltaHours: number | null;
};

export type HydratedAppState = {
  ready: boolean;
  sessions: SleepSession[];
  sleepSettings: SleepSettings;
  appearance: AppearanceSettings;
  demoRestore: DemoRestoreState;
  appState: AppStateRecord;
  activeSessionId: string | null;
  currentErrorMessage: string | null;
};
