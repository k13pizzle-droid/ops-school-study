import { useSyncExternalStore } from 'react';
import { byId } from './bank';
import { prune, recordAnswer, type Progress } from './progress';

// Everything saved on the phone. Small enough that one localStorage key per kind is fine.
export type TestResult = { at: number; score: number; total: number; byTopic: Record<string, [number, number]>; missed: string[] };
export type Game = { xp: number; streak: number; lastDay: string; bestLightning: number };
type State = { progress: Progress; stars: Record<string, true>; tests: TestResult[]; game: Game };
const NEW_GAME: Game = { xp: 0, streak: 0, lastDay: '', bestLightning: 0 };
export const today = (d = new Date()) => d.toLocaleDateString('en-CA');

const KEY = 'ops-school-v1';
const ids = new Set(byId.keys());

function load(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<State>;
    return { progress: prune(raw.progress ?? {}, ids), stars: prune(raw.stars ?? {}, ids), tests: raw.tests ?? [], game: { ...NEW_GAME, ...raw.game } };
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
