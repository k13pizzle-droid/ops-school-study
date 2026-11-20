import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sampleExam, sampleRehearsal } from '../src/lib/exam';
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
  it('catches the mistakes a big batch makes', () => {
    const bad = (qs: unknown[]) => validateBank(topics, { t: qs }).errors.join('\n');
    expect(bad([q('a', { options: ['P', 'Q', 'R', 'A & B'] })])).toMatch(/shuffle": false/);
    expect(bad([q('a', { options: ['P', 'Q', 'R', 'Both A and C'] })])).toMatch(/shuffle": false/);
    expect(bad([q('a', { shuffle: 'false' as unknown as boolean })])).toMatch(/shuffle must be true or false/);
    expect(bad([q('a', { options: ['P', 'Q', 'R', 'Most of the above'] })])).toMatch(/the above/);
    expect(bad([q('a', { keyFact: 15 as unknown as string })])).toMatch(/keyFact/);
    expect(bad([q('a', { keyFact: 'no colon here' })])).toMatch(/Label: fact/);
    expect(bad([{ ...q('a'), keyfact: 'X: y' }])).toMatch(/unknown field "keyfact"/);
    expect(bad([q('a', { options: ['a. P', 'b. Q', 'c. R', 'd. S'] })])).toMatch(/letter label/);
    expect(bad([q('a', { type: 'tf', options: undefined, answer: false })])).toMatch(/False statement needs/);
    expect(bad([q('a', { optionsFrom: 'exam', source: { origin: 'slides' } })])).toMatch(/only goes with origin "review"/);
    expect(bad([q('a'), q('b')])).toBe(''); // different stems pass
    expect(bad([q('a'), { ...q('b'), stem: 'Q a' }])).toMatch(/same stem/);
    // The standard pinned forms are fine.
    expect(bad([q('a', { options: ['P', 'Q', 'R', 'All of these'], answer: 3 })])).toBe('');
    expect(bad([q('a', { options: ['P', 'Q', 'A & B'], shuffle: false, why: 'P and Q.' })])).toBe('');
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
  it('pins "All of these" and "Neither of the above" too', () => {
    for (let s = 1; s < 50; s++) {
      expect(showOptions(q('a', { options: ['W', 'X', 'Y', 'All of these'], answer: 3 }), seeded(s)).options.at(-1)).toBe('All of these');
      expect(showOptions(q('a', { options: ['W', 'X', 'Neither of the above'], answer: 0 }), seeded(s)).options.at(-1)).toBe('Neither of the above');
    }
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
  it('puts mastered questions after ones not yet mastered', () => {
    const p2 = recordAnswer(recordAnswer(p, 'seen-old', true, now + 20), 'seen-old', true, now + 30); // streak 3, but recent
    const mastered = recordAnswer(p, 'seen-new', true, now + 40); // streak 2
    expect(studyOrder([q('seen-old'), q('seen-new'), q('fresh-ish')], recordAnswer(mastered, 'fresh-ish', true, now + 50), seeded(2)).slice(0, 1)).toEqual(['seen-old']);
    expect(studyOrder([q('seen-old'), q('x')], recordAnswer(p2, 'x', true, now + 99), seeded(3))).toEqual(['x', 'seen-old']);
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

import { dayStreak, liveStreak } from '../src/lib/store';
describe('day streak', () => {
  const d = (s: string) => new Date(`${s}T12:00:00`);
  const g = (lastDay: string, streak: number) => ({ xp: 0, bestLightning: 0, lastDay, streak });
  it('counts consecutive days and restarts after a gap', () => {
    expect(dayStreak(g('', 0), d('2026-11-19'))).toEqual({ streak: 1, lastDay: '2026-11-19' });
    expect(dayStreak(g('2026-11-19', 1), d('2026-11-20'))).toEqual({ streak: 2, lastDay: '2026-11-20' });
    expect(dayStreak(g('2026-11-20', 2), d('2026-11-20'))).toEqual({ streak: 2, lastDay: '2026-11-20' });
    expect(dayStreak(g('2026-11-17', 5), d('2026-11-20'))).toEqual({ streak: 1, lastDay: '2026-11-20' });
    expect(liveStreak(g('2026-11-17', 5), d('2026-11-20'))).toBe(0);
    expect(liveStreak(g('2026-11-19', 5), d('2026-11-20'))).toBe(5);
  });
});

describe('slide images', () => {
  const bad = (im: unknown) => validateBank(topics, { t: [{ ...q('a'), images: [im] }] }).errors.join('\n');
  it('accepts a well-formed image and rejects broken ones', () => {
    expect(bad({ src: 'slides/bsa-14.webp', alt: 'Slide 14', at: 'answer', mark: { x: 5, y: 40, w: 60, h: 12 } })).toBe('');
    expect(bad({ src: 'bsa-14.webp', alt: 'x', at: 'answer' })).toMatch(/slides\/name/);
    expect(bad({ src: 'slides/a.webp', at: 'answer' })).toMatch(/alt text/);
    expect(bad({ src: 'slides/a.webp', alt: 'x', at: 'why' })).toMatch(/"at"/);
    expect(bad({ src: 'slides/a.webp', alt: 'x', at: 'stem', mark: { x: 80, y: 0, w: 40, h: 10 } })).toMatch(/inside the image/);
  });
});

describe('exam rehearsal', () => {
  const bank = [
    ...Array.from({ length: 30 }, (_, i) => q(`r${i}`, { topic: i < 15 ? 'a' : 'b' })),
    ...Array.from({ length: 200 }, (_, i) => q(`s${i}`, { topic: ['a', 'b', 'c'][i % 3]!, source: { origin: 'slides' } })),
  ];
  it('includes every review question and fills the rest from the others', () => {
    for (let s = 1; s < 20; s++) {
      const got = sampleRehearsal(bank, 89, seeded(s));
      expect(got).toHaveLength(89);
      expect(new Set(got.map((x) => x.id)).size).toBe(89);
      expect(got.filter((x) => x.source.origin === 'review')).toHaveLength(30);
    }
  });
  it('samples review questions when there are more than n', () => {
    const got = sampleRehearsal(bank.slice(0, 30), 10, seeded(1));
    expect(got).toHaveLength(10);
  });
});
