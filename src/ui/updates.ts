import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

// New questions ship as a new deploy. The service worker checks for one when the app opens,
// every time it comes back to the foreground, and every two minutes while open. When one is
// waiting, the update bar appears; tapping it activates the new version and reloads.
let apply: (() => void) | null = null;
const subs = new Set<() => void>();

export function startUpdates() {
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      apply = () => void update(true);
      subs.forEach((f) => f());
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => navigator.onLine && reg.update().catch(() => {});
      setInterval(check, 120_000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    },
  });
}

export const useUpdate = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => apply,
  );
