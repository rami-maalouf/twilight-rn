import demoBackup from '../../assets/demo-backup.json';
import { localTransaction, getKeyValue, setKeyValue, writeSession } from './db';
import { snapshot, restoreSnapshot, writeSettings } from './archive';
import { validateArchive } from './health/archive-validation';
import { withHealthIdle } from './health/sync';

export async function importDemoData() {
  const payload = validateArchive(demoBackup);
  await withHealthIdle(() => localTransaction(async db => {
    if (await getKeyValue(db, 'demo_restore_state', 'isDemoActive', false)) return;
    await setKeyValue(db, 'demo_restore_state', 'exactSnapshot', JSON.stringify(await snapshot(db)));
    await db.runAsync('DELETE FROM sessions');
    for (const session of payload.sessions) await writeSession(db, session);
    await writeSettings(db, payload);
    await setKeyValue(db, 'demo_restore_state', 'isDemoActive', 'true');
  }));
}
export async function exitDemoData() {
  await withHealthIdle(() => localTransaction(async db => {
    if (!await getKeyValue(db, 'demo_restore_state', 'isDemoActive', false)) return;
    const data = await getKeyValue<Awaited<ReturnType<typeof snapshot>> | null>(db, 'demo_restore_state', 'exactSnapshot', null);
    if (!data) throw new Error('Demo restoration snapshot is missing. Personal data was not replaced.');
    await restoreSnapshot(db, data);
    await db.runAsync('DELETE FROM demo_restore_state');
  }));
}
