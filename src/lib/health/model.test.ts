import { emptyHealthState, reconcile, enqueue, acknowledge, type ExternalSleep } from './model';
import type { SleepSession } from '../types';
const record = (id: string, start = '2026-11-01T00:00:00Z', end = '2026-11-01T08:00:00Z'): ExternalSleep => ({ id, startTime: start, endTime: end, source: 'watch', clientId: null, startOffset: -14400, endOffset: -18000, stages: [] });
const local: SleepSession = { id: 'local', tag: 'Manual', startTime: record('').startTime, endTime: record('').endTime, startTimeZoneIdentifier: null, endTimeZoneIdentifier: null, needsHealthKitSync: true, healthKitSyncVersion: 2 };
test('asleep preferred over in-bed, awake excluded and endpoint offsets retained', () => {
  const state = emptyHealthState(); state.records.a = { ...record('a'), stages: [{ startTime: '2026-11-01T01:00:00Z', endTime: '2026-11-01T07:00:00Z', stage: 4 }, { startTime: '2026-11-01T00:00:00Z', endTime: '2026-11-01T08:00:00Z', stage: 1 }] };
  const [night] = reconcile(state, [], 'self');
  expect(night.startTime).toBe('2026-11-01T01:00:00Z'); expect(night.healthProvenance?.endOffset).toBe(-18000);
});
test('source separated, local overlap wins, tombstones prevent reimport, own package ignored', () => {
  const state = emptyHealthState(); state.records.a = record('a');
  expect(reconcile(state, [local], 'self')).toEqual([local]);
  state.tombstones.push('a'); expect(reconcile(state, [], 'self')).toEqual([]);
  state.tombstones = []; state.records.a.source = 'self'; expect(reconcile(state, [], 'self')).toEqual([]);
});
test('splits gaps over three hours and never keys by calendar', () => {
  const state = emptyHealthState(); state.records.a = record('a'); state.records.b = record('b', '2026-11-01T12:00:00Z', '2026-11-01T18:00:00Z');
  expect(reconcile(state, [], 'self').map(s => s.id)).toEqual(['hc:a','hc:b']);
});
test('foreign change keeps stable mapping by record membership, explicit deletion removes import', () => {
  const state = emptyHealthState(); state.records.a = record('a'); const sessions = reconcile(state, [], 'self');
  state.records.a.startTime = '2026-11-01T01:00:00Z'; expect(reconcile(state, sessions, 'self')[0].id).toBe(sessions[0].id);
  delete state.records.a; expect(reconcile(state, sessions, 'self')).toEqual([]);
});
test('remote success before ack is retryable and old async ack preserves later edit', () => {
  const state = emptyHealthState(); enqueue(state,local,'upsert'); const first = state.outbox.local;
  const restarted = JSON.parse(JSON.stringify(state)); expect(restarted.outbox.local).toEqual(first);
  enqueue(state, { ...local, tag: 'Edited' }, 'upsert'); acknowledge(state, first, 'remote');
  expect(state.outbox.local.version).toBeGreaterThan(first.version); expect(state.owned.local).toBe('remote');
});
