import { validateArchive } from "./health/archive-validation";
import { enqueue } from "./health/model";
import { getDb, getKeyValue, setKeyValue, localTransaction, readHealthState, writeHealthState, sessionsIn, writeSession } from "./db";
import { APP_VERSION, ARCHIVE_TYPE, CURRENT_ARCHIVE_SCHEMA_VERSION } from "@/lib/constants";
import { getSessions, getSleepSettings, getAppearance, getHydratedState } from "@/lib/db";
import { serializeJson } from "@/lib/format";
import type {
  ArchivePayload,
  SleepSession,
  DataArchivePreview,
} from "@/lib/types";

export async function exportArchiveJson() {
  const [sessions, sleepSettings, appearance] = await Promise.all([
    getSessions(),
    getSleepSettings(),
    getAppearance(),
  ]);

  const payload: ArchivePayload = {
    metadata: {
      archiveType: ARCHIVE_TYPE,
      schemaVersion: CURRENT_ARCHIVE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      timeZoneIdentifier: Intl.DateTimeFormat().resolvedOptions().timeZone,
      appVersion: APP_VERSION,
    },
    sleepSettings,
    appearance,
    sessions,
  };

  return JSON.stringify(payload, null, 2);
}

export async function previewArchiveImport(input: unknown): Promise<DataArchivePreview> {
  const payload = validateArchive(input);
  const current = await getHydratedState();
  const currentSessions = new Map(current.sessions.map((session) => [session.id, serializeJson(session)]));

  let newSessions = 0;
  let updatedSessions = 0;
  for (const rawSession of payload.sessions) {
    const normalized = rawSession;
    const currentPayload = currentSessions.get(normalized.id);
    if (!currentPayload) {
      newSessions += 1;
    } else if (currentPayload !== serializeJson(normalized)) {
      updatedSessions += 1;
    }
  }

  const settingsChanges = Number(serializeJson(current.sleepSettings) !== serializeJson(payload.sleepSettings));
  const appearanceChanges = Number(serializeJson(current.appearance) !== serializeJson(payload.appearance));

  return {
    exportedAt: payload.metadata.exportedAt,
    appVersion: payload.metadata.appVersion,
    sessionCount: payload.sessions.length,
    newSessions,
    updatedSessions,
    settingsChanges,
    appearanceChanges,
  };
}

export async function importArchivePayload(input: unknown) {
  const payload = validateArchive(input);
  const preview = await previewArchiveImport(payload);
  await localTransaction(async db => {
    if (await getKeyValue(db, 'demo_restore_state', 'isDemoActive', false)) throw new Error('Exit demo mode before importing.');
    const before = await snapshot(db);
    const combined = new Map((await sessionsIn(db)).map(s => [s.id, s]));
    for (const session of payload.sessions) combined.set(session.id, session);
    if ([...combined.values()].filter(s => !s.endTime).length > 1) throw new Error('Import would create multiple active sessions. Finish the current session first.');
    await setKeyValue(db, 'health_state', 'safetyBackup', JSON.stringify(before));
    const health = await readHealthState(db);
    for (const session of payload.sessions) { await writeSession(db, session); enqueue(health, session, 'upsert'); }
    await writeHealthState(db, health);
    await writeSettings(db, payload);
  });
  return { preview };
}
export async function importArchiveJson(json: string) { return importArchivePayload(JSON.parse(json)); }
const tables = ['sessions', 'sleep_settings', 'appearance_settings', 'app_state', 'health_state'] as const;
export async function snapshot(db: Awaited<ReturnType<typeof getDb>>) {
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const table of tables) result[table] = await db.getAllAsync(`SELECT * FROM ${table}${table === 'health_state' ? " WHERE key != 'safetyBackup'" : ''}`);
  return result;
}
export async function restoreSnapshot(db: Awaited<ReturnType<typeof getDb>>, data: Awaited<ReturnType<typeof snapshot>>) {
  for (const table of tables) {
    await db.runAsync(`DELETE FROM ${table}${table === 'health_state' ? " WHERE key != 'safetyBackup'" : ''}`);
    for (const row of data[table]) {
      const columns = Object.keys(row);
      await db.runAsync(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, Object.values(row) as (string | null)[]);
    }
  }
}
export async function writeSettings(db: Awaited<ReturnType<typeof getDb>>, payload: ReturnType<typeof validateArchive>) {
  for (const [table, settings] of [['sleep_settings', payload.sleepSettings], ['appearance_settings', payload.appearance]] as const) {
    for (const [key, value] of Object.entries(settings)) {
      if (key !== 'healthSyncEnabled') await setKeyValue(db, table, key, JSON.stringify(value));
    }
  }
}
export async function restoreSafetyBackup() {
  await localTransaction(async db => {
    if (await getKeyValue(db, 'demo_restore_state', 'isDemoActive', false)) throw new Error('Exit demo first.');
    const backup = await getKeyValue<Awaited<ReturnType<typeof snapshot>> | null>(db, 'health_state', 'safetyBackup', null);
    if (!backup) throw new Error('No pre-import backup is available.');
    const current = await snapshot(db);
    // remote writes may have happened since import: retain their delete intent.
    const currentHealth = await readHealthState(db);
    await restoreSnapshot(db, backup);
    const health = await readHealthState(db);
    const restored = await sessionsIn(db);
    for (const session of (current.sessions.map(r => JSON.parse(r.payload as string)) as SleepSession[])) if (!restored.some(s => s.id === session.id)) enqueue(currentHealth, session, 'delete');
    health.versions = { ...health.versions, ...currentHealth.versions };
    health.outbox = { ...health.outbox, ...currentHealth.outbox };
    for (const session of restored) enqueue(health, session, 'upsert');
    health.token = null;
    await writeHealthState(db, health);
  });
}
export async function exportSafetyBackup() {
  const db = await getDb();
  const data = await getKeyValue<Awaited<ReturnType<typeof snapshot>> | null>(db, 'health_state', 'safetyBackup', null);
  if (!data) throw new Error('No pre-import backup is available.');
  const settings = (table: string) => Object.fromEntries(data[table].map(r => [r.key, JSON.parse(r.value as string)]));
  return JSON.stringify({ metadata: { archiveType: ARCHIVE_TYPE, schemaVersion: CURRENT_ARCHIVE_SCHEMA_VERSION, exportedAt: new Date().toISOString(), timeZoneIdentifier: 'UTC', appVersion: APP_VERSION }, sessions: data.sessions.map(r => JSON.parse(r.payload as string)), sleepSettings: settings('sleep_settings'), appearance: settings('appearance_settings') }, null, 2);
}
