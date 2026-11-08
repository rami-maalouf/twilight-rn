import { emptyHealthState, enqueue, imported, type HealthState } from "./health/model";
import * as SQLite from "expo-sqlite";

import {
  APP_VERSION,
  CURRENT_ARCHIVE_SCHEMA_VERSION,
  DB_NAME,
  DEFAULT_APP_STATE,
  DEFAULT_APPEARANCE,
  DEFAULT_SLEEP_SETTINGS,
} from "@/lib/constants";
import { parseJson, serializeJson } from "@/lib/format";
import type {
  AppearanceSettings,
  AppStateRecord,
  SleepSession,
  DemoRestoreState,
  HydratedAppState,
  SleepSettings,
} from "@/lib/types";

type SessionRow = {
  id: string;
  payload: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const DEFAULT_DEMO_RESTORE: DemoRestoreState = {
  backupArchiveJson: null,
  backupCreatedAt: null,
  isDemoActive: false,
};

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

async function setKeyValue(
  db: SQLite.SQLiteDatabase,
  table: string,
  key: string,
  value: string,
) {
  await db.runAsync(
    `INSERT INTO ${table} (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

async function getKeyValue<T>(
  db: SQLite.SQLiteDatabase,
  table: string,
  key: string,
  fallback: T,
) {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM ${table} WHERE key = ?`,
    [key],
  );
  return parseJson(row?.value ?? null, fallback);
}

async function seedKeyValueTable<T extends Record<string, unknown>>(
  db: SQLite.SQLiteDatabase,
  table: string,
  value: T,
) {
  for (const [key, entry] of Object.entries(value)) {
    const existing = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM ${table} WHERE key = ?`,
      [key],
    );
    if (!existing) {
      await setKeyValue(db, table, key, serializeJson(entry));
    }
  }
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Legacy Concepts Removal (Migration)
    -- If the sessions table exists and has blocked_profile_id, we need to drop the constraint.
    -- SQLite doesn't allow dropping NOT NULL easily, so we handle it by checking columns.
  `);

  const tableInfo = await db.getAllAsync<{ name: string; notnull: number }>(
    "PRAGMA table_info(sessions)",
  );

  const hasBlockedProfileId = tableInfo.some((col) => col.name === "blocked_profile_id");
  const isNotNull = tableInfo.find((col) => col.name === "blocked_profile_id")?.notnull === 1;

  if (hasBlockedProfileId && isNotNull) {
    // Perform a safe migration to remove the NOT NULL constraint from blocked_profile_id
    // and eventually we'll just stop using it.
    await db.execAsync(`
      CREATE TABLE sessions_backup (
        id TEXT PRIMARY KEY NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        payload TEXT NOT NULL
      );
      
      INSERT INTO sessions_backup (id, start_time, end_time, payload)
      SELECT id, start_time, end_time, payload FROM sessions;
      
      DROP TABLE sessions;
      
      ALTER TABLE sessions_backup RENAME TO sessions;
      
      CREATE INDEX idx_sessions_start ON sessions(start_time DESC);
      CREATE INDEX idx_sessions_active ON sessions(end_time);
    `);
  } else {
    // Standard table creation (if it doesn't exist)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        payload TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(end_time);
    `);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sleep_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appearance_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS demo_restore_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  await db.execAsync(`CREATE TABLE IF NOT EXISTS health_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); PRAGMA user_version = 2;`);
  await seedKeyValueTable(db, "sleep_settings", DEFAULT_SLEEP_SETTINGS);
  await seedKeyValueTable(db, "appearance_settings", DEFAULT_APPEARANCE);
  await seedKeyValueTable(db, "app_state", DEFAULT_APP_STATE);
  await seedKeyValueTable(db, "demo_restore_state", DEFAULT_DEMO_RESTORE);
  await setKeyValue(db, "app_state", "archiveSchemaVersion", serializeJson(CURRENT_ARCHIVE_SCHEMA_VERSION));
  await setKeyValue(db, "app_state", "appVersion", serializeJson(APP_VERSION));
}

export async function getDb() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }

  return databasePromise;
}

export function makeSession(
  tag: string,
  partial?: Partial<SleepSession>,
): SleepSession {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    tag,
    startTime: now,
    endTime: null,
    startTimeZoneIdentifier: Intl.DateTimeFormat().resolvedOptions().timeZone,
    endTimeZoneIdentifier: null,
    needsHealthKitSync: true,
    healthKitSyncVersion: 2,
    ...partial,
  };
}

export async function getSessions() {
  const db = await getDb();
  const rows = await db.getAllAsync<SessionRow>(
    "SELECT id, payload FROM sessions ORDER BY start_time DESC",
  );
  return rows.map((row) =>
    parseJson<SleepSession>(row.payload, makeSession("Manual Log", { id: row.id })),
  );
}

export async function writeSession(db: SQLite.SQLiteDatabase, session: SleepSession) {
  await db.runAsync(
    `INSERT INTO sessions (id, start_time, end_time, payload)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       start_time = excluded.start_time,
       end_time = excluded.end_time,
       payload = excluded.payload`,
    [
      session.id,
      session.startTime,
      session.endTime,
      serializeJson(session),
    ],
  );
}

let transactionQueue: Promise<unknown> = Promise.resolve();
export function localTransaction<T>(action: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const run = transactionQueue.then(async () => {
    const db = await getDb();
    let value: T;
    await db.withExclusiveTransactionAsync(async tx => { value = await action(tx); });
    return value!;
  });
  transactionQueue = run.catch(() => undefined);
  return run;
}
export async function readHealthState(db: SQLite.SQLiteDatabase): Promise<HealthState> {
  return getKeyValue(db, "health_state", "sync", emptyHealthState());
}
export async function writeHealthState(db: SQLite.SQLiteDatabase, state: HealthState) {
  await setKeyValue(db, "health_state", "sync", JSON.stringify(state));
}
export async function sessionsIn(db: SQLite.SQLiteDatabase): Promise<SleepSession[]> {
  return (await db.getAllAsync<SessionRow>("SELECT id, payload FROM sessions")).map(r => JSON.parse(r.payload));
}
export async function upsertSession(session: SleepSession) {
  await localTransaction(async db => {
    const demo = await getKeyValue(db, "demo_restore_state", "isDemoActive", false);
    const old = (await sessionsIn(db)).find(s => s.id === session.id);
    if (old && imported(old)) session = { ...session, isHealthKitImported: false, healthProvenance: old.healthProvenance ? { ...old.healthProvenance, adopted: true } : { platform: 'apple', source: old.healthKitSourceBundleIdentifier ?? 'Apple Health', recordIds: [], adopted: true } };
    await writeSession(db, session);
    if (!demo) { const state = await readHealthState(db); enqueue(state, session, 'upsert'); await writeHealthState(db, state); }
  });
}
export async function deleteSession(sessionId: string) {
  await localTransaction(async db => {
    const session = (await sessionsIn(db)).find(s => s.id === sessionId);
    if (!session) return;
    if (!await getKeyValue(db, "demo_restore_state", "isDemoActive", false)) {
      const state = await readHealthState(db);
      state.tombstones = [...new Set([...state.tombstones, ...(session.healthProvenance?.recordIds ?? [])])];
      enqueue(state, session, 'delete'); await writeHealthState(db, state);
    }
    await db.runAsync("DELETE FROM sessions WHERE id = ?", [sessionId]);
  });
}
export { getKeyValue, setKeyValue };

export async function getSleepSettings(): Promise<SleepSettings> {
  const db = await getDb();
  return {
    isOnboarded: await getKeyValue(db, "sleep_settings", "isOnboarded", DEFAULT_SLEEP_SETTINGS.isOnboarded),
    optimalSleepMinutes: await getKeyValue(
      db,
      "sleep_settings",
      "optimalSleepMinutes",
      DEFAULT_SLEEP_SETTINGS.optimalSleepMinutes,
    ),
    optimalWakeMinutes: await getKeyValue(
      db,
      "sleep_settings",
      "optimalWakeMinutes",
      DEFAULT_SLEEP_SETTINGS.optimalWakeMinutes,
    ),
    windDownReminderEnabled: await getKeyValue(
      db,
      "sleep_settings",
      "windDownReminderEnabled",
      DEFAULT_SLEEP_SETTINGS.windDownReminderEnabled,
    ),
    healthSyncEnabled: await getKeyValue(
      db,
      "sleep_settings",
      "healthSyncEnabled",
      DEFAULT_SLEEP_SETTINGS.healthSyncEnabled,
    ),
  };
}

export async function setSleepSettings(partial: Partial<SleepSettings>) {
  const db = await getDb();
  const merged = { ...(await getSleepSettings()), ...partial };
  for (const [key, value] of Object.entries(merged)) {
    await setKeyValue(db, "sleep_settings", key, serializeJson(value));
  }
  return merged;
}

export async function getAppearance(): Promise<AppearanceSettings> {
  const db = await getDb();
  return {
    themeMode: await getKeyValue(db, "appearance_settings", "themeMode", DEFAULT_APPEARANCE.themeMode),
    colorPalette: await getKeyValue(
      db,
      "appearance_settings",
      "colorPalette",
      DEFAULT_APPEARANCE.colorPalette,
    ),
  };
}

export async function setAppearance(partial: Partial<AppearanceSettings>) {
  const db = await getDb();
  const merged = { ...(await getAppearance()), ...partial };
  for (const [key, value] of Object.entries(merged)) {
    await setKeyValue(db, "appearance_settings", key, serializeJson(value));
  }
  return merged;
}

export async function getAppState(): Promise<AppStateRecord> {
  const db = await getDb();
  return {
    pendingExternalAction: await getKeyValue(
      db,
      "app_state",
      "pendingExternalAction",
      DEFAULT_APP_STATE.pendingExternalAction,
    ),
    lastViewedTab: await getKeyValue(db, "app_state", "lastViewedTab", DEFAULT_APP_STATE.lastViewedTab),
  };
}

export async function setAppState(partial: Partial<AppStateRecord>) {
  const db = await getDb();
  const merged = { ...(await getAppState()), ...partial };
  for (const [key, value] of Object.entries(merged)) {
    await setKeyValue(db, "app_state", key, serializeJson(value));
  }
  return merged;
}

export async function getDemoRestoreState(): Promise<DemoRestoreState> {
  const db = await getDb();
  return {
    backupArchiveJson: await getKeyValue(
      db,
      "demo_restore_state",
      "backupArchiveJson",
      DEFAULT_DEMO_RESTORE.backupArchiveJson,
    ),
    backupCreatedAt: await getKeyValue(
      db,
      "demo_restore_state",
      "backupCreatedAt",
      DEFAULT_DEMO_RESTORE.backupCreatedAt,
    ),
    isDemoActive: await getKeyValue(
      db,
      "demo_restore_state",
      "isDemoActive",
      DEFAULT_DEMO_RESTORE.isDemoActive,
    ),
  };
}

export async function setDemoRestoreState(partial: Partial<DemoRestoreState>) {
  const db = await getDb();
  const merged = { ...(await getDemoRestoreState()), ...partial };
  for (const [key, value] of Object.entries(merged)) {
    await setKeyValue(db, "demo_restore_state", key, serializeJson(value));
  }
  return merged;
}

export async function getHydratedState(): Promise<HydratedAppState> {
  const [sessions, sleepSettings, appearance, demoRestore, appState] =
    await Promise.all([
      getSessions(),
      getSleepSettings(),
      getAppearance(),
      getDemoRestoreState(),
      getAppState(),
    ]);

  const activeSession = sessions.find((session) => session.endTime == null) ?? null;

  return {
    ready: true,
    sessions,
    sleepSettings,
    appearance,
    demoRestore,
    appState,
    activeSessionId: activeSession?.id ?? null,
    currentErrorMessage: null,
  };
}

export async function clearAllData() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM sessions;
    DELETE FROM sleep_settings;
    DELETE FROM appearance_settings;
    DELETE FROM app_state;
    DELETE FROM demo_restore_state;
  `);
  await migrate(db);
}
