import { useCallback, useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';
import { router } from 'expo-router';
import { Host, Switch } from '@expo/ui';
import { healthDetails, syncHealth } from '@/lib/health/sync';
import { healthBridge } from '@/lib/health/native';
import { useAppStore } from '@/lib/store';
import { GlassPanel, NativeScreen, SectionHeader, TwilightButton, useTwilightTheme } from '@/ui/surface';

export default function HealthConnectRoute() {
  const { theme } = useTwilightTheme();
  const enabled = useAppStore(s => s.sleepSettings.healthSyncEnabled);
  const demo = useAppStore(s => s.demoRestore.isDemoActive);
  const [details, setDetails] = useState<Awaited<ReturnType<typeof healthDetails>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setDetails(await healthDetails()); }, []);
  useEffect(() => { void load().catch(e => setError(String(e))); const sub = AppState.addEventListener('change', state => { if (state === 'active') void load().catch(e => setError(String(e))); }); return () => sub.remove(); }, [load]);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await action(); await load(); await useAppStore.getState().refresh(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const mode = demo ? 'Paused during demo' : !enabled ? 'Sync is off' : details?.read && details.write ? 'Import and export enabled' : details?.read ? 'Import only' : details?.write ? 'Export only' : 'Sleep permissions needed';
  return <NativeScreen>
    <SectionHeader title="Health Connect" subtitle="Your sleep, together on Android." />
    <GlassPanel style={{ gap: 16 }}>
      <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: '700' }}>{mode}</Text>
      <Text style={{ color: theme.textSecondary }}>Twilight imports the recent 29 days of sleep from other apps and exports finished sessions you create or edit. Sync runs while Twilight is open. Earlier imported history stays on this device.</Text>
      <Host matchContents={{ vertical: true }}><Switch label="Sync sleep" value={enabled} disabled={busy || demo || details?.availability !== 'available'} onValueChange={value => void perform(async () => { if (value) await healthBridge?.requestAccess(); await useAppStore.getState().updateSleepSettings({ healthSyncEnabled: value }); await syncHealth(); })} /></Host>
      <Text style={{ color: theme.textSecondary }}>{details?.availability === 'updateRequired' ? 'Install or update Health Connect to continue.' : details?.availability === 'unavailable' ? 'Health Connect is unavailable on this device or development build.' : `Read: ${details?.read ? 'allowed' : 'not allowed'}. Write: ${details?.write ? 'allowed' : 'not allowed'}.`}</Text>
      <TwilightButton title="Manage access or install provider" subtle disabled={busy || !healthBridge} onPress={() => void perform(() => healthBridge!.openSettings())} />
      <TwilightButton title="Request sleep access" subtle disabled={busy || demo || details?.availability !== 'available'} onPress={() => void perform(() => healthBridge!.requestAccess())} />
    </GlassPanel>
    <GlassPanel style={{ gap: 12 }}>
      <Text style={{ color: theme.textSecondary }}>Last success: {details?.lastSuccess ? new Date(details.lastSuccess).toLocaleString() : 'Never'}</Text>
      <Text style={{ color: theme.textSecondary }}>Imported nights: {details?.imported ?? 0}. Completed remote operations: {details?.exported ?? 0}. Pending: {Object.keys(details?.outbox ?? {}).length}.</Text>
      {details?.error || error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error ?? details?.error}</Text> : null}
      <TwilightButton title={busy ? 'Syncing...' : 'Sync now / retry'} disabled={busy || demo || !enabled || details?.availability !== 'available'} onPress={() => void perform(syncHealth)} />
      <Text style={{ color: theme.textSecondary }}>Deleting a foreign import hides it in Twilight and keeps the original. Editing an import creates a Twilight-owned copy. Removing a Twilight record in Health Connect pauses its export until you edit it again.</Text>
    </GlassPanel>
    <TwilightButton title="Done" subtle onPress={() => router.back()} />
  </NativeScreen>;
}
