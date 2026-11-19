import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

// New questions ship as a new deploy. The service worker checks for one when the app opens,
// every time it comes back to the foreground, and every two minutes while open. When one is
// ready, Home shows the update bar; tapping it activates the new version and reloads.
let apply: (() => void) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let update: ((reload?: boolean) => Promise<void>) | undefined;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

// On a phone's very first visit the page isn't controlled yet, so the new worker activates
// straight away and nothing triggers a reload. Reload ourselves if the worker's own reload
// hasn't happened shortly after.
const applyNow = () => {
  void update?.(true);
  setTimeout(() => location.reload(), 1500);
};

export function startUpdates() {
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      apply = applyNow;
      notify();
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
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

/** The footer's "Check for updates": ask the server now and say what happened. */
export async function checkNow(): Promise<'updating' | 'current' | 'offline' | 'unavailable'> {
  if (!navigator.onLine) return 'offline';
  if (!registration) return 'unavailable';
  if (apply) {
    apply();
    return 'updating';
  }
  try {
    await registration?.update();
  } catch {
    return 'offline';
  }
  // A found update installs in the background; give it a moment to reach "waiting".
  for (let i = 0; i < 10 && registration?.installing; i++) await new Promise((r) => setTimeout(r, 300));
  if (apply || registration?.waiting) {
    applyNow();
    return 'updating';
  }
  return 'current';
}

/**
 * Last resort for a phone stuck on an old version: drop the service worker and its cached files,
 * then reload from the server. Progress lives in localStorage and is not touched.
 */
export async function reloadFresh(): Promise<boolean> {
  // Only drop the cached app if the server can be reached; offline, it would leave nothing to load.
  try {
    const res = await fetch('/', { cache: 'no-store' });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await caches?.keys()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } finally {
    location.reload();
  }
  return true;
}
