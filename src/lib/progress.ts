// Per-question history kept on the phone. Keyed by question id, so it survives bank updates.
export type Record_ = { seen: number; right: number; streak: number; last: 'right' | 'wrong'; at: number };
export type Progress = Record<string, Record_>;

export const isMastered = (r: Record_ | undefined) => !!r && r.streak >= 2;
export const isMissed = (r: Record_ | undefined) => !!r && r.last === 'wrong';

export function recordAnswer(p: Progress, id: string, correct: boolean, now = Date.now()): Progress {
  const prev = p[id];
  const next: Record_ = {
    seen: (prev?.seen ?? 0) + 1,
    right: (prev?.right ?? 0) + (correct ? 1 : 0),
    streak: correct ? (prev?.streak ?? 0) + 1 : 0,
    last: correct ? 'right' : 'wrong',
    at: now,
  };
  return { ...p, [id]: next };
}

/** Drop history for ids no longer in the bank. */
export function prune<T>(map: Record<string, T>, ids: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(map).filter(([id]) => ids.has(id)));
}
