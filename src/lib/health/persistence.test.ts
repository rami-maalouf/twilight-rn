type MockSqlite = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
  close(): void;
};
// Node's experimental sqlite types are not in the Expo tsconfig `types` list.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => MockSqlite;
};

let mockSql: MockSqlite;
let mockFailWrites = false;
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    const wrap = {
      execAsync: async (query: string) => { mockSql.exec(query); },
      runAsync: async (query: string, params: unknown[] = []) => {
        if (mockFailWrites && query.startsWith('INSERT INTO sessions')) throw new Error('disk full');
        return mockSql.prepare(query).run(...params as []);
      },
      getAllAsync: async (query: string, params: unknown[] = []) => mockSql.prepare(query).all(...params as []),
      getFirstAsync: async (query: string, params: unknown[] = []) => mockSql.prepare(query).get(...params as []),
      withExclusiveTransactionAsync: async (action: (db: unknown) => Promise<void>) => {
        mockSql.exec('BEGIN IMMEDIATE');
        try { await action(wrap); mockSql.exec('COMMIT'); } catch (e) { mockSql.exec('ROLLBACK'); throw e; }
      },
    };
    return wrap;
  },
}));
jest.mock('./native', () => ({ healthBridge: null, getHealthStatus: async () => ({ availability: 'unavailable' }) }));
import { getDb, getSessions, makeSession, upsertSession, deleteSession, readHealthState, localTransaction, writeHealthState } from '../db';
import { exportArchiveJson, importArchiveJson, previewArchiveImport } from '../archive';
import { importDemoData, exitDemoData } from '../demo';

beforeAll(async () => { mockSql = new DatabaseSync(':memory:'); await getDb(); });
beforeEach(async () => { mockFailWrites = false; mockSql.exec('DELETE FROM sessions; DELETE FROM health_state; DELETE FROM demo_restore_state;'); });
afterAll(() => mockSql.close());
const session = () => makeSession('Personal', { id: 'personal', startTime: '2026-11-01T02:00:00Z', endTime: '2026-11-01T10:00:00Z' });

test('session and durable outbox roll back together on disk failure', async () => {
  mockFailWrites = true;
  await expect(upsertSession(session())).rejects.toThrow('disk full');
  expect(await getSessions()).toEqual([]);
  expect((await readHealthState(await getDb())).outbox).toEqual({});
});
test('offline saves and deletes persist versions and targeted deletion intent', async () => {
  await upsertSession(session());
  const initial = await readHealthState(await getDb());
  await deleteSession('personal');
  const next = await readHealthState(await getDb());
  expect(next.outbox.personal.operation).toBe('delete');
  expect(next.outbox.personal.version).toBeGreaterThan(initial.outbox.personal.version);
});
test('demo replaces personal sessions, repeated entry retains exact original, exit restores void', async () => {
  await upsertSession(session());
  const before = await exportArchiveJson();
  const health = await readHealthState(await getDb());
  await importDemoData();
  expect((await getSessions()).some(s => s.id === 'personal')).toBe(false);
  await importDemoData();
  await exitDemoData();
  expect(JSON.parse(await exportArchiveJson()).sessions).toEqual(JSON.parse(before).sessions);
  expect(await readHealthState(await getDb())).toEqual(health);
});
test('demo transaction failure preserves personal data and flag', async () => {
  await upsertSession(session()); mockFailWrites = true;
  await expect(importDemoData()).rejects.toThrow('disk full');
  expect((await getSessions())[0].id).toBe('personal');
  expect(mockSql.prepare("SELECT * FROM demo_restore_state WHERE key='isDemoActive'").get()).toBeUndefined();
});
test.each(['duplicate', 'newer', 'bad date', 'two active'])('invalid %s archive leaves data and sync state unchanged', async kind => {
  await upsertSession(session());
  const payload = JSON.parse(await exportArchiveJson());
  if (kind === 'duplicate') payload.sessions.push(payload.sessions[0]);
  if (kind === 'newer') payload.metadata.schemaVersion = 999;
  if (kind === 'bad date') payload.sessions[0].endTime = 'tomorrow';
  if (kind === 'two active') { payload.sessions[0].endTime = null; payload.sessions.push({ ...payload.sessions[0], id: 'second' }); }
  const before = await getSessions(); const state = await readHealthState(await getDb());
  await expect(previewArchiveImport(payload)).rejects.toThrow();
  await expect(importArchiveJson(JSON.stringify(payload))).rejects.toThrow();
  expect(await getSessions()).toEqual(before); expect(await readHealthState(await getDb())).toEqual(state);
});
test('archive transaction failure restores all local records and settings', async () => {
  await upsertSession(session()); const json = await exportArchiveJson(); mockFailWrites = true;
  await expect(importArchiveJson(json)).rejects.toThrow('disk full');
  expect((await getSessions())[0].id).toBe('personal');
  expect(mockSql.prepare("SELECT * FROM health_state WHERE key='safetyBackup'").get()).toBeUndefined();
});
test('editing foreign import adopts copy and deleting import persists tombstone', async () => {
  const external = { ...session(), healthProvenance: { platform: 'android' as const, source: 'watch', recordIds: ['raw-id'] } };
  await localTransaction(async db => { const s = await readHealthState(db); s.records = {}; await writeHealthState(db,s); await db.runAsync('INSERT INTO sessions VALUES (?,?,?,?)', [external.id, external.startTime, external.endTime, JSON.stringify(external)]); });
  await upsertSession({ ...external, tag: 'Edited' });
  expect((await getSessions())[0].healthProvenance?.adopted).toBe(true);
  expect((await readHealthState(await getDb())).outbox.personal.operation).toBe('upsert');
  await deleteSession(external.id);
  expect((await readHealthState(await getDb())).tombstones).toContain('raw-id');
});
