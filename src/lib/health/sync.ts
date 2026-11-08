import { getDb, getDemoRestoreState, getSleepSettings, localTransaction, readHealthState, writeHealthState, sessionsIn, writeSession } from '../db';
import { acknowledge, enqueue, imported, reconcile } from './model';
import { getHealthStatus, healthBridge } from './native';

let paused = 0;
let running: Promise<void> | null = null;
export function syncHealth() {
  if (!running) running = synchronize().finally(() => { running = null; });
  return running;
}
export async function healthDetails() { return { ...await getHealthStatus(), ...await readHealthState(await getDb()) }; }
export async function withHealthIdle<T>(action: () => Promise<T>) {
  paused++;
  try { await running; return await action(); } finally { paused--; }
}
async function synchronize() {
  if (paused || !healthBridge || (await getDemoRestoreState()).isDemoActive || !(await getSleepSettings()).healthSyncEnabled) return;
  try {
    const status = await getHealthStatus();
    if (status.availability !== 'available') throw new Error('Health Connect needs installation or an update.');
    if (!status.read && !status.write) throw new Error('Sleep access is denied. Open Health Connect permissions to try again.');
    let state = await readHealthState(await getDb());
    if (status.read) {
      if (!state.token) {
        // acquire before reading so writes concurrent with pagination are drained below.
        const token = await healthBridge.getToken();
        const start = new Date(Date.now() - 29 * 86400000).toISOString();
        const end = new Date().toISOString();
        let page: string | null = null;
        const records = [];
        do { const next = await healthBridge.read(start, end, page); records.push(...next.records); page = next.page; } while (page);
        await apply(records, [], token, start, status.packageName);
        state = await readHealthState(await getDb());
      }
      let token = state.token!;
      for (;;) {
        const changes = await healthBridge.changes(token);
        if (changes.expired) {
          await localTransaction(async db => { const state = await readHealthState(db); state.token = null; await writeHealthState(db, state); });
          // no absence-based deletions: history access can shrink after revocation.
          throw new Error('Health Connect history cursor expired. Sync again to refresh the recent 29 days; older local imports are retained.');
        }
        await apply(changes.records, changes.deleted, changes.token, null, status.packageName);
        token = changes.token;
        if (!changes.hasMore) break;
      }
    }
    if (status.write) {
      await localTransaction(async db => {
        const state = await readHealthState(db);
        for (const session of await sessionsIn(db)) if (!imported(session) && !state.versions[session.id] && !state.suppressed.includes(session.id)) enqueue(state, session, 'upsert');
        await writeHealthState(db, state);
      });
      const pending = Object.values((await readHealthState(await getDb())).outbox);
      for (const item of pending) {
        let remoteId: string | undefined;
        if (item.operation === 'delete') await healthBridge.delete(`twilight:${item.id}`);
        else remoteId = await healthBridge.write(`twilight:${item.id}`, item.version, item.session.startTime, item.session.endTime!, offset(item.session.startTime, item.session.startTimeZoneIdentifier), offset(item.session.endTime!, item.session.endTimeZoneIdentifier));
        await localTransaction(async db => { const state = await readHealthState(db); acknowledge(state, item, remoteId); state.exported++; await writeHealthState(db, state); });
      }
    }
    await localTransaction(async db => { const state = await readHealthState(db); state.lastSuccess = new Date().toISOString(); state.error = null; await writeHealthState(db, state); });
  } catch (error) {
    await localTransaction(async db => { const state = await readHealthState(db); state.error = error instanceof Error ? error.message : String(error); await writeHealthState(db, state); });
  }
}
async function apply(records: import('./model').ExternalSleep[], deleted: string[], token: string, start: string | null, packageName: string) {
  await localTransaction(async db => {
    const state = await readHealthState(db);
    for (const record of records) state.records[record.id] = record;
    for (const id of deleted) {
      delete state.records[id];
      for (const [localId, remoteId] of Object.entries(state.owned)) if (remoteId === id) {
        // explicit remote removal pauses export until the next intentional local edit.
        state.suppressed.push(localId); delete state.owned[localId];
        delete state.outbox[localId];
      }
    }
    const sessions = reconcile(state, await sessionsIn(db), packageName);
    await db.runAsync('DELETE FROM sessions');
    for (const session of sessions) await writeSession(db, session);
    state.token = token; if (start) state.coverageStart = start;
    state.imported = sessions.filter(imported).length;
    await writeHealthState(db, state);
  });
}
export function offset(iso: string, zone: string | null): number | null {
  if (!zone) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(iso));
  const name = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
  if (name === 'GMT') return 0;
  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  return match ? (match[1] === '-' ? -1 : 1) * (+match[2] * 3600 + +match[3] * 60) : null;
}
