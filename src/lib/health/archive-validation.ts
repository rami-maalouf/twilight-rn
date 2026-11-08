import { z } from 'zod';
import { ARCHIVE_TYPE, CURRENT_ARCHIVE_SCHEMA_VERSION } from '../constants';
const date = z.string().datetime({ offset: true }).refine(v => Number.isFinite(Date.parse(v)), 'Invalid date');
const zone = z.string().refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }, 'Invalid timezone');
const provenance = z.object({ platform: z.enum(['android', 'apple']), source: z.string().min(1), recordIds: z.array(z.string().min(1)), adopted: z.boolean().optional(), startOffset: z.number().int().min(-64800).max(64800).nullable().optional(), endOffset: z.number().int().min(-64800).max(64800).nullable().optional() });
const session = z.object({
  id: z.string().min(1), tag: z.string(), startTime: date, endTime: date.nullable(),
  startTimeZoneIdentifier: zone.nullable().optional().default(null), endTimeZoneIdentifier: zone.nullable().optional().default(null),
  needsHealthKitSync: z.boolean().optional().default(true), healthKitSyncVersion: z.number().int().nonnegative().optional().default(2),
  healthProvenance: provenance.optional(), isHealthKitImported: z.boolean().optional(), healthKitExternalNightKey: z.string().nullable().optional(), healthKitSourceBundleIdentifier: z.string().nullable().optional(),
}).refine(s => !s.endTime || Date.parse(s.endTime) > Date.parse(s.startTime), 'Session end must follow start');
const schema = z.object({
  metadata: z.object({ archiveType: z.literal(ARCHIVE_TYPE), schemaVersion: z.number().int().min(1).max(CURRENT_ARCHIVE_SCHEMA_VERSION), exportedAt: date, timeZoneIdentifier: zone, appVersion: z.string().nullable().optional().default(null) }),
  sleepSettings: z.object({ isOnboarded: z.boolean(), optimalSleepMinutes: z.number().int().min(0).max(1439), optimalWakeMinutes: z.number().int().min(0).max(1439), windDownReminderEnabled: z.boolean(), healthSyncEnabled: z.boolean() }),
  appearance: z.object({ themeMode: z.enum(['System', 'Sunset', 'Night Sky']), colorPalette: z.enum(['Twilight', 'Amethyst']) }), sessions: z.array(session),
}).superRefine((value, ctx) => {
  if (new Set(value.sessions.map(s => s.id)).size !== value.sessions.length) ctx.addIssue({ code: 'custom', message: 'Duplicate session IDs' });
  if (value.sessions.filter(s => !s.endTime).length > 1) ctx.addIssue({ code: 'custom', message: 'Only one active session is allowed' });
});
export function validateArchive(value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid Twilight backup: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return parsed.data;
}
