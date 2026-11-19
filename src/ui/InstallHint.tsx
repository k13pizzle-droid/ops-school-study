import { useState } from 'react';
import { install, isStandalone, platform, useInstallPrompt } from './install';

const KEY = 'ops-school-install-hint-dismissed';

/** On Home, only in the browser (not once installed): how to put the app on this phone. */
export function InstallHint() {
  const prompt = useInstallPrompt();
  const [hidden, setHidden] = useState(() => {
    try {
      return isStandalone() || localStorage.getItem(KEY) === '1';
    } catch {
      return isStandalone();
    }
  });
  if (hidden || (platform === 'other' && !prompt)) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="install-hint mx-4 mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[15px] leading-snug">
      <div className="font-semibold">Put it on your Home Screen</div>
      {platform === 'ios' ? (
        <p className="mt-1 text-[var(--muted)]">
          In Safari, tap <b>Share</b> (the square with the arrow), then <b>Add to Home Screen</b>. Open it from the new icon. Progress in Safari and on the Home Screen is kept separately, so start from the icon.
        </p>
      ) : prompt ? (
        <p className="mt-1 text-[var(--muted)]">It works offline once installed.</p>
      ) : (
        <p className="mt-1 text-[var(--muted)]">
          In Chrome, tap the <b>⋮</b> menu, then <b>Install app</b> or <b>Add to Home screen</b>.
        </p>
      )}
      <div className="mt-2 flex gap-2">
        {prompt && (
          <button onClick={() => void install()} className="min-h-11 rounded-lg bg-[var(--accent)] px-4 font-semibold text-[var(--on-accent)]">
            Install app
          </button>
        )}
        <button onClick={dismiss} className="min-h-11 px-3 text-[var(--muted)] underline">
          Not now
        </button>
      </div>
    </div>
  );
}
