import { useSyncExternalStore } from 'react';
import { recordAnswer, type Progress } from './progress';

// Everything saved on the phone. Small enough that one localStorage key per kind is fine.
export type TestResult = { at: number; score: number; total: number; byTopic: Record<string, [number, number]>; missed: string[]; exam?: boolean };
export type Game = { xp: number; streak: number; lastDay: string; bestLightning: number };
type State = { progress: Progress; stars: Record<string, true>; tests: TestResult[]; game: Game };
const NEW_GAME: Game = { xp: 0, streak: 0, lastDay: '', bestLightning: 0 };
export const today = (d = new Date()) => d.toLocaleDateString('en-CA');

const KEY = 'ops-school-v1';

function load(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<State>;
    // Ids missing from this bank are kept, not pruned: a bad push that drops a file for one deploy
    // must not wipe progress for good. Screens only ever read ids that exist.
    return { progress: raw.progress ?? {}, stars: raw.stars ?? {}, tests: raw.tests ?? [], game: { ...NEW_GAME, ...raw.game } };
  } catch {
    return { progress: {}, stars: {}, tests: [], game: NEW_GAME };
  }
}

let state = load();
const subs = new Set<() => void>();
function set(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep going in memory */
  }
  subs.forEach((f) => f());
}

export const useStore = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  );

export const actions = {
  answer: (id: string, correct: boolean) => set({ ...state, progress: recordAnswer(state.progress, id, correct) }),
  answerMany: (results: [string, boolean][]) => {
    let p = state.progress;
    for (const [id, ok] of results) p = recordAnswer(p, id, ok);
    set({ ...state, progress: p });
  },
  toggleStar: (id: string) => {
    const stars = { ...state.stars };
    if (stars[id]) delete stars[id];
    else stars[id] = true;
    set({ ...state, stars });
  },
  saveTest: (r: TestResult) => set({ ...state, tests: [r, ...state.tests].slice(0, 5) }),
  reset: () => set({ progress: {}, stars: {}, tests: [], game: NEW_GAME }),
  /** Add XP and count today toward the day streak. */
  earn: (xp: number) => set({ ...state, game: { ...state.game, xp: state.game.xp + xp, ...dayStreak(state.game) } }),
  lightning: (score: number) => set({ ...state, game: { ...state.game, bestLightning: Math.max(state.game.bestLightning, score) } }),
};

/** Days in a row with at least one finished lesson or lightning round. */
export function dayStreak(g: Game, now = new Date()): Pick<Game, 'streak' | 'lastDay'> {
  const t = today(now);
  if (g.lastDay === t) return { streak: g.streak, lastDay: t };
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return { streak: g.lastDay === today(y) ? g.streak + 1 : 1, lastDay: t };
}
/** The streak as it stands today: it reads 0 once a whole day has been missed. */
export const liveStreak = (g: Game, now = new Date()) => {
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return g.lastDay === today(now) || g.lastDay === today(y) ? g.streak : 0;
};

// A mock test in progress, saved on every answer so a back swipe, an update, or iOS closing the
// app in the background doesn't lose it.
export type SavedRun = { ids: string[]; shown: { options: string[]; answer: number; lettered: boolean }[]; picks: (number | null)[]; idx: number; started: number; timer: boolean; exam?: boolean };
const RUN_KEY = 'ops-school-test-run';
export const savedRun = {
  load(): SavedRun | null {
    try {
      return JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as SavedRun | null;
    } catch {
      return null;
    }
  },
  save(r: SavedRun) {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(r));
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(RUN_KEY);
    } catch {
      /* ignore */
    }
  },
};
