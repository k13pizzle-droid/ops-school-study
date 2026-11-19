import { useEffect, useState } from 'react';

/**
 * In-app confirm: the first tap arms the button for a few seconds, the second does the thing.
 * Used instead of window.confirm(), which isn't reliable in an iPhone Home Screen app.
 */
export function useTwoTap(action: () => void, ms = 4000): [armed: boolean, tap: () => void] {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ms);
    return () => clearTimeout(t);
  }, [armed, ms]);
  return [
    armed,
    () => {
      if (armed) {
        setArmed(false);
        action();
      } else setArmed(true);
    },
  ];
}
