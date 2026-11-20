import type { Question } from './types';
import { shuffled, type Rng } from './random';

const weight = (q: Question) => (q.source.origin === 'review' ? 2 : 1);

/**
 * A mock exam of up to `n` questions. Each topic gets a share in proportion to its weight
 * (review questions count double), and within a topic review questions are twice as likely to be
 * drawn. If the bank has fewer than `n` questions, every one is used.
 */
export function sampleExam(qs: Question[], n: number, rng: Rng): Question[] {
  if (n >= qs.length) return shuffled(qs, rng);
  const byTopic = new Map<string, Question[]>();
  for (const q of qs) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);
  const total = qs.reduce((s, q) => s + weight(q), 0);

  // Largest-remainder quotas, capped at what each topic has.
  const quotas = [...byTopic].map(([topic, list]) => {
    const exact = (n * list.reduce((s, q) => s + weight(q), 0)) / total;
    return { topic, list, take: Math.min(Math.floor(exact), list.length), rem: exact - Math.floor(exact) };
  });
  let left = n - quotas.reduce((s, x) => s + x.take, 0);
  while (left > 0) {
    const open = quotas.filter((x) => x.take < x.list.length).sort((a, b) => b.rem - a.rem);
    if (!open.length) break;
    for (const x of open) {
      if (left === 0) break;
      x.take++;
      x.rem = -1;
      left--;
    }
    for (const x of quotas) if (x.rem === -1) x.rem = 0;
  }

  const picked: Question[] = [];
  for (const { list, take } of quotas) {
    // Weighted draw without replacement: sort by u^(1/w) (Efraimidis–Spirakis).
    const keyed = list.map((q) => ({ q, k: Math.pow(rng(), 1 / weight(q)) })).sort((a, b) => b.k - a.k);
    picked.push(...keyed.slice(0, take).map((x) => x.q));
  }
  return shuffled(picked, rng);
}

/**
 * The exam rehearsal: every instructor review question (the best predictor of the real exam),
 * then slide and authored questions to fill the rest, spread by topic as in sampleExam. If there
 * are more review questions than n, a weighted sample of them is used instead.
 */
export function sampleRehearsal(qs: Question[], n: number, rng: Rng): Question[] {
  const review = qs.filter((q) => q.source.origin === 'review');
  if (review.length >= n) return sampleExam(review, n, rng);
  const rest = qs.filter((q) => q.source.origin !== 'review');
  return shuffled([...review, ...sampleExam(rest, n - review.length, rng)], rng);
}
