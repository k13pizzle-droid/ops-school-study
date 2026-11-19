import { useSyncExternalStore } from 'react';

// Getting the app onto the Home Screen. Android Chrome offers a real install prompt
// (beforeinstallprompt), which we keep and fire from a button. iPhone has no prompt, so Home
// shows the Share → Add to Home Screen steps instead.
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export function startInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const ua = navigator.userAgent;
export const platform: 'ios' | 'android' | 'other' = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ? 'ios'
  : /Android/.test(ua)
    ? 'android'
    : 'other';

export const useInstallPrompt = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => deferred,
  );

export async function install() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice.catch(() => {});
  deferred = null;
  notify();
}
