import { useSyncExternalStore } from 'react';
import { byId } from './bank';
import { prune, recordAnswer, type Progress } from './progress';

// Everything saved on the phone. Small enough that one localStorage key per kind is fine.
export type TestResult = { at: number; score: number; total: number; byTopic: Record<string, [number, number]>; missed: string[] };
type State = { progress: Progress; stars: Record<string, true>; tests: TestResult[] };

const KEY = 'ops-school-v1';
const ids = new Set(byId.keys());

function load(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<State>;
    return { progress: prune(raw.progress ?? {}, ids), stars: prune(raw.stars ?? {}, ids), tests: raw.tests ?? [] };
  } catch {
    return { progress: {}, stars: {}, tests: [] };
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
  reset: () => set({ progress: {}, stars: {}, tests: [] }),
};
