import { requireOptionalNativeModule } from 'expo';
import type { ExternalSleep } from './model';
export type HealthStatus = { availability: 'available' | 'unavailable' | 'updateRequired'; read: boolean; write: boolean; packageName: string };
export interface HealthBridge {
  getStatus(): Promise<HealthStatus>;
  requestAccess(): Promise<void>;
  openSettings(): Promise<void>;
  getToken(): Promise<string>;
  read(start: string, end: string, page: string | null): Promise<{ records: ExternalSleep[]; page: string | null }>;
  changes(token: string): Promise<{ records: ExternalSleep[]; deleted: string[]; token: string; hasMore: boolean; expired: boolean }>;
  write(id: string, version: number, start: string, end: string, startOffset: number | null, endOffset: number | null): Promise<string>;
  delete(id: string): Promise<void>;
}
const native = requireOptionalNativeModule<HealthBridge>('TwilightHealthConnect');
export const healthBridge = native;
export const getHealthStatus = async (): Promise<HealthStatus> => native ? native.getStatus() : { availability: 'unavailable', read: false, write: false, packageName: '' };
