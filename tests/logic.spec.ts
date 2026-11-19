import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sampleExam } from '../src/lib/exam';
import { showOptions } from '../src/lib/options';
import { recordAnswer, isMastered, prune, type Progress } from '../src/lib/progress';
import { seeded } from '../src/lib/random';
import { requeue, studyOrder } from '../src/lib/study';
import type { Question } from '../src/lib/types';
import { validateBank } from '../src/lib/validate';

const q = (id: string, over: { [K in keyof Question]?: Question[K] | undefined } = {}): Question => ({
  id,
  topic: 't',
  type: 'mc',
  stem: `Q ${id}`,
  options: ['A', 'B', 'C', 'D'],
  answer: 0,
  source: { origin: 'review' },
  optionsFrom: 'authored',
  status: 'ready',
  ...over,
}) as Question;
const topics = [{ slug: 't', name: 'T' }];

describe('content validator', () => {
  it('passes the real bank', () => {
    const dir = new URL('../content/', import.meta.url);
    const files: Record<string, unknown> = {};
    for (const f of readdirSync(dir)) if (f !== 'topics.json') files[f.slice(0, -5)] = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    const r = validateBank(JSON.parse(readFileSync(new URL('topics.json', dir), 'utf8')), files);
    expect(r.errors).toEqual([]);
    expect(r.total).toBeGreaterThan(0);
  });
  it('catches each rule', () => {
    const bad = (qs: unknown[]) => validateBank(topics, { t: qs }).errors.join('\n');
    expect(bad([q('a'), q('a')])).toMatch(/duplicate id/);
    expect(bad([q('a', { answer: 4 })])).toMatch(/out of range/);
    expect(bad([q('a', { answer: undefined })])).toMatch(/missing its answer/);
    expect(bad([q('a', { options: undefined })])).toMatch(/missing its options/);
    expect(bad([q('a', { topic: 'nope' })])).toMatch(/unknown topic/);
    expect(bad([q('a', { type: 'tf', answer: true })])).toMatch(/tf question must not have options/);
    expect(bad([q('a', { status: 'needs-answer', answer: undefined, options: undefined })])).toBe('');
    expect(validateBank(topics, { t: [], x: [] }).errors.join()).toMatch(/no topic "x"/);
  });
});

describe('option shuffling', () => {
  it('keeps the answer pointing at the right text and pins All of the above last', () => {
    const item = q('a', { options: ['W', 'X', 'Y', 'Z', 'All of the above'], answer: 4 });
    const other = q('b', { options: ['W', 'X', 'None of the above', 'Z'], answer: 1 });
    for (let s = 1; s < 200; s++) {
      const a = showOptions(item, seeded(s));
      expect(a.options.at(-1)).toBe('All of the above');
      expect(a.options[a.answer]).toBe('All of the above');
      const b = showOptions(other, seeded(s));
      expect(b.options.at(-1)).toBe('None of the above');
      expect(b.options[b.answer]).toBe('X');
      expect([...b.options].sort()).toEqual(['None of the above', 'W', 'X', 'Z']);
    }
  });
  it('leaves shuffle:false in stored order with letters', () => {
    const s = showOptions(q('a', { options: ['P', 'Q', 'A & B'], answer: 2, shuffle: false }), seeded(3));
    expect(s).toEqual({ options: ['P', 'Q', 'A & B'], answer: 2, lettered: true });
  });
  it('maps true/false', () => {
    expect(showOptions(q('a', { type: 'tf', answer: false, options: undefined }), seeded(1)).answer).toBe(1);
  });
});

describe('mock exam sampling', () => {
  const bank = [
    ...Array.from({ length: 60 }, (_, i) => q(`a${i}`, { topic: 'a', source: { origin: i < 20 ? 'review' : 'slides' } })),
    ...Array.from({ length: 30 }, (_, i) => q(`b${i}`, { topic: 'b' })),
    ...Array.from({ length: 10 }, (_, i) => q(`c${i}`, { topic: 'c', source: { origin: 'authored' } })),
  ];
  it('returns n unique questions split by weighted topic share', () => {
    const got = sampleExam(bank, 50, seeded(7));
    expect(got).toHaveLength(50);
    expect(new Set(got.map((x) => x.id)).size).toBe(50);
    // weights: a = 20*2 + 40 = 80, b = 60, c = 10 → 150 total
    const count = (t: string) => got.filter((x) => x.topic === t).length;
    expect(count('a')).toBe(27);
    expect(count('b')).toBe(20);
    expect(count('c')).toBe(3);
  });
  it('favors review questions inside a topic', () => {
    let review = 0;
    for (let s = 1; s <= 200; s++) review += sampleExam(bank, 50, seeded(s)).filter((x) => x.topic === 'a' && x.source.origin === 'review').length;
    // Unweighted would average 27 * 20/60 = 9 per exam; double weight should land well above.
    expect(review / 200).toBeGreaterThan(11);
  });
  it('uses the whole bank when it is smaller than n', () => {
    expect(sampleExam(bank, 150, seeded(1))).toHaveLength(100);
  });
});

describe('study order and the missed list', () => {
  const now = 1_000_000;
  const qs = [q('seen-old'), q('unseen-authored', { source: { origin: 'authored' } }), q('missed'), q('unseen-review'), q('seen-new'), q('focus')];
  let p: Progress = {};
  p = recordAnswer(p, 'seen-old', true, now);
  p = recordAnswer(p, 'seen-new', true, now + 10);
  p = recordAnswer(p, 'missed', false, now + 5);
  p = recordAnswer(p, 'focus', true, now);

  it('puts focus, then missed, then unseen (review first), then oldest seen', () => {
    expect(studyOrder(qs, p, seeded(1), ['focus'])).toEqual(['focus', 'missed', 'unseen-review', 'unseen-authored', 'seen-old', 'seen-new']);
  });
  it('a miss comes back three questions later, or at the end', () => {
    expect(requeue(['a', 'b', 'c', 'd', 'e', 'f'], 0)).toEqual(['a', 'b', 'c', 'd', 'a', 'e', 'f']);
    expect(requeue(['a', 'b'], 1)).toEqual(['a', 'b', 'b']);
  });
  it('tracks streaks, mastery, and the last result', () => {
    let r: Progress = {};
    r = recordAnswer(r, 'x', true);
    expect(isMastered(r.x)).toBe(false);
    r = recordAnswer(r, 'x', true);
    expect(isMastered(r.x)).toBe(true);
    r = recordAnswer(r, 'x', false);
    expect(r.x).toMatchObject({ seen: 3, right: 2, streak: 0, last: 'wrong' });
  });
  it('drops progress for ids that left the bank', () => {
    expect(prune({ a: 1, gone: 2 }, new Set(['a']))).toEqual({ a: 1 });
  });
});
