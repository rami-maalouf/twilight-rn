import { useEffect } from 'react';
import { AppState, Appearance } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { getHydratedState } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { createWidgetSync } from '@/lib/widgets-sync';

export function WidgetLifecycle() {
  useEffect(() => {
    if (!requireOptionalNativeModule('ExpoWidgets')) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    // defer android compose registration so unsupported runtimes can still load the app.
    void Promise.all([import('./sleep-status.android'), import('./sleep-overview.android')]).then(([status, overview]) => {
      if (disposed) return;
      const sync = createWidgetSync(getHydratedState, (props) => {
        for (const widget of [status.default, overview.default]) {
          try {
            widget.updateSnapshot(props);
          } catch {
            // retry on the next mutation or foreground event without affecting sleep commands.
          }
        }
      });
      const request = () => {
        if (useAppStore.getState().ready) sync.request();
      };
      const unsubscribe = useAppStore.subscribe(request);
      const appState = AppState.addEventListener('change', (state) => {
        if (state === 'active') request();
      });
      const appearance = Appearance.addChangeListener(request);
      request();
      cleanup = () => {
        unsubscribe();
        appState.remove();
        appearance.remove();
        sync.dispose();
      };
    }).catch(() => undefined);
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  return null;
}
