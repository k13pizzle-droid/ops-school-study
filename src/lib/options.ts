import type { Question } from './types';
import { shuffled, type Rng } from './random';

export type Shown = {
  /** Option text in display order. */
  options: string[];
  /** Index into `options` of the correct one. */
  answer: number;
  /** Show a, b, c… letters (the stored order is meaningful). */
  lettered: boolean;
};

export const PINNED = /^(all|none|both|neither)( of)? (the above|these)\.?$/i;

/** Options as they appear on screen. "All/None of the above" stay last; shuffle:false keeps the stored order. */
export function showOptions(q: Question, rng: Rng): Shown {
  if (q.type === 'tf') return { options: ['True', 'False'], answer: q.answer ? 0 : 1, lettered: false };
  const opts = q.options ?? [];
  const idx = opts.map((_, i) => i);
  if (q.shuffle === false) return { options: [...opts], answer: q.answer as number, lettered: true };
  const pinned = idx.filter((i) => PINNED.test(opts[i]!.trim()));
  const free = idx.filter((i) => !PINNED.test(opts[i]!.trim()));
  const order = [...shuffled(free, rng), ...pinned];
  return { options: order.map((i) => opts[i]!), answer: order.indexOf(q.answer as number), lettered: false };
}
