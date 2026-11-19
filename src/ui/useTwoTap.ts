import { useEffect, useRef, useState } from 'react';

/**
 * In-app confirm: the first tap arms the button for a few seconds, the second does the thing.
 * Used instead of window.confirm(), which isn't reliable in an iPhone Home Screen app. A second
 * tap within half a second is ignored, so a double-tap can't confirm by accident.
 */
export function useTwoTap(action: () => void, ms = 4000): [armed: boolean, tap: () => void] {
  const [armed, setArmed] = useState(false);
  const armedAt = useRef(0);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ms);
    return () => clearTimeout(t);
  }, [armed, ms]);
  return [
    armed,
    () => {
      if (!armed) {
        armedAt.current = Date.now();
        setArmed(true);
      } else if (Date.now() - armedAt.current >= 500) {
        setArmed(false);
        action();
      }
    },
  ];
}
