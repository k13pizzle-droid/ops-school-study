import type { Question } from './types';
import { isMastered, isMissed, type Progress } from './progress';
import { shuffled, type Rng } from './random';

const reviewFirst = (a: Question, b: Question) =>
  (a.source.origin === 'review' ? 0 : 1) - (b.source.origin === 'review' ? 0 : 1);

/**
 * Order for a Study session: `focus` ids first (misses from a mock exam), then questions missed
 * last time, then never-seen ones, then seen but not mastered, then mastered (least recently seen
 * first in both). Within each group
 * the instructors' review questions come ahead of everything else.
 */
export function studyOrder(qs: Question[], p: Progress, rng: Rng, focus: string[] = []): string[] {
  const focusSet = new Set(focus);
  const mix = shuffled(qs, rng);
  const tier = (q: Question) =>
    focusSet.has(q.id) ? 0 : isMissed(p[q.id]) ? 1 : !p[q.id] ? 2 : isMastered(p[q.id]) ? 4 : 3;
  return mix
    .sort((a, b) => tier(a) - tier(b) || reviewFirst(a, b) || (tier(a) >= 3 ? p[a.id]!.at - p[b.id]!.at : 0))
    .map((q) => q.id);
}

/** After a miss at position `at`, the same question comes back `gap` questions later. */
export function requeue(queue: string[], at: number, gap = 3): string[] {
  const id = queue[at]!;
  const next = [...queue];
  next.splice(Math.min(at + 1 + gap, next.length), 0, id);
  return next;
}
