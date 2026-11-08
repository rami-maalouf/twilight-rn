import type { SleepSession } from '../types';

export type ExternalSleep = {
  id: string; source: string; clientId: string | null;
  startTime: string; endTime: string;
  startOffset: number | null; endOffset: number | null;
  stages: { startTime: string; endTime: string; stage: number }[];
};
export type Provenance = { platform: 'android' | 'apple'; source: string; recordIds: string[]; adopted?: boolean; startOffset?: number | null; endOffset?: number | null };
export type Pending = { id: string; version: number; operation: 'upsert' | 'delete'; session: SleepSession };
export type HealthState = {
  records: Record<string, ExternalSleep>; tombstones: string[]; outbox: Record<string, Pending>;
  versions: Record<string, number>; owned: Record<string, string>; suppressed: string[];
  token: string | null; coverageStart: string | null; lastSuccess: string | null;
  error: string | null; imported: number; exported: number;
};
export const emptyHealthState = (): HealthState => ({ records: {}, tombstones: [], outbox: {}, versions: {}, owned: {}, suppressed: [], token: null, coverageStart: null, lastSuccess: null, error: null, imported: 0, exported: 0 });
export const imported = (s: SleepSession) => Boolean(s.healthProvenance && !s.healthProvenance.adopted || s.isHealthKitImported);
export const valid = (s: SleepSession) => s.endTime != null && Date.parse(s.endTime) - Date.parse(s.startTime) >= 300000;
export function enqueue(state: HealthState, session: SleepSession, operation: Pending['operation']) {
  if (imported(session)) return;
  const version = Math.max(state.versions[session.id] ?? 0, session.healthKitSyncVersion ?? 0) + 1;
  state.versions[session.id] = version;
  if (operation === 'upsert' && !valid(session)) {
    if (!state.owned[session.id] && !state.outbox[session.id]) return;
    operation = 'delete';
  }
  state.suppressed = state.suppressed.filter(id => id !== session.id);
  state.outbox[session.id] = { id: session.id, version, operation, session };
}
export function acknowledge(state: HealthState, pending: Pending, remoteId?: string) {
  if (pending.operation === 'upsert' && remoteId) state.owned[pending.id] = remoteId;
  if (pending.operation === 'delete') delete state.owned[pending.id];
  if (state.outbox[pending.id]?.version === pending.version) delete state.outbox[pending.id];
}
export function reconcile(state: HealthState, sessions: SleepSession[], packageName: string) {
  const locals = sessions.filter(s => !s.healthProvenance || s.healthProvenance.platform !== 'android' || s.healthProvenance.adopted);
  const previous = sessions.filter(s => s.healthProvenance?.platform === 'android' && !s.healthProvenance.adopted);
  const bySource = new Map<string, ExternalSleep[]>();
  for (const record of Object.values(state.records)) {
    if (record.source === packageName || record.clientId?.startsWith('twilight:')) continue;
    bySource.set(record.source, [...(bySource.get(record.source) ?? []), record]);
  }
  const nights: { records: ExternalSleep[]; start: string; end: string }[] = [];
  for (const records of bySource.values()) {
    records.sort((a,b) => Date.parse(a.startTime) - Date.parse(b.startTime));
    let batch: ExternalSleep[] = []; let end = 0;
    const flush = () => {
      if (!batch.length) return;
      const stages = batch.flatMap(r => r.stages);
      const asleep = stages.filter(s => [2,4,5,6].includes(s.stage));
      const used = asleep.length ? asleep : stages.filter(s => s.stage === 1);
      const ranges = used.length ? used : stages.length ? [] : batch;
      if (ranges.length) {
        const start = ranges.reduce((a,b) => Date.parse(a.startTime) < Date.parse(b.startTime) ? a : b).startTime;
        const finish = ranges.reduce((a,b) => Date.parse(a.endTime) > Date.parse(b.endTime) ? a : b).endTime;
        if (Date.parse(finish) - Date.parse(start) >= 300000) nights.push({ records: batch, start, end: finish });
      }
    };
    for (const record of records) {
      if (batch.length && Date.parse(record.startTime) - end > 10800000) { flush(); batch = []; end = 0; }
      batch.push(record); end = Math.max(end, Date.parse(record.endTime));
    }
    flush();
  }
  const result = [...locals];
  for (const night of nights.sort((a,b) => Date.parse(a.start)-Date.parse(b.start))) {
    const ids = night.records.map(r => r.id).sort();
    if (ids.some(id => state.tombstones.includes(id))) continue;
    if (result.some(s => Date.parse(s.startTime) < Date.parse(night.end) && (!s.endTime || Date.parse(s.endTime) > Date.parse(night.start)))) continue;
    const old = previous.find(s => s.healthProvenance?.recordIds.some(id => ids.includes(id)));
    result.push({ id: old?.id ?? `hc:${ids[0]}`, tag: 'Health Connect', startTime: night.start, endTime: night.end,
      startTimeZoneIdentifier: null, endTimeZoneIdentifier: null, needsHealthKitSync: false, healthKitSyncVersion: 0,
      healthProvenance: { platform: 'android', source: night.records[0].source, recordIds: ids, startOffset: night.records[0].startOffset, endOffset: night.records.at(-1)!.endOffset } });
  }
  return result;
}
