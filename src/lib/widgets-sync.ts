import { buildWidgetSnapshot, type SleepWidgetProps } from './widgets-state';
import type { HydratedAppState } from './types';

// every publication reads persisted state; subscriptions are invalidation signals only.
export function createWidgetSync(
  load: () => Promise<HydratedAppState>,
  publish: (props: SleepWidgetProps) => void,
) {
  let revision = 0;
  let running = false;
  let disposed = false;
  async function flush() {
    if (running || disposed) return;
    running = true;
    let observed: number;
    do {
      observed = revision;
      try {
        const state = await load();
        if (!disposed && observed === revision && state.ready) publish(buildWidgetSnapshot(state));
      } catch {
        // widgets are optional; a failed read or publication must not block tracking.
      }
    } while (!disposed && observed !== revision);
    running = false;
  }
  return {
    request() {
      revision += 1;
      void flush();
    },
    dispose() {
      disposed = true;
    },
  };
}
