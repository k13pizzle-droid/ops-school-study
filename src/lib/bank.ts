import topicsJson from '../../content/topics.json';
import type { Question, Topic } from './types';

// Every content/*.json except topics.json is a topic file. Bundled at build time, so a new deploy
// carries the new bank and the service worker picks it up.
const files = import.meta.glob<Question[]>(['../../content/*.json', '!../../content/topics.json'], {
  eager: true,
  import: 'default',
});

export const topics: Topic[] = topicsJson as Topic[];
export const allQuestions: Question[] = topics.flatMap((t) => files[`../../content/${t.slug}.json`] ?? []);

// "Exam review only": when on, every mode works from the instructors' review questions alone.
// Read once at startup; toggling it reloads the app so every screen picks it up.
const REVIEW_ONLY_KEY = 'ops-school-review-only';
export const reviewOnly = (() => {
  try {
    return localStorage.getItem(REVIEW_ONLY_KEY) === '1';
  } catch {
    return false;
  }
})();
export function setReviewOnly(on: boolean) {
  try {
    if (on) localStorage.setItem(REVIEW_ONLY_KEY, '1');
    else localStorage.removeItem(REVIEW_ONLY_KEY);
  } catch {
    /* ignore */
  }
  location.reload();
}
export const questions: Question[] = reviewOnly ? allQuestions.filter((q) => q.source.origin === 'review') : allQuestions;
// Lookups follow the same filter, so nothing outside it can surface anywhere (a resumed test, a
// card, a lesson). Progress is stored by id separately and is kept either way.
export const byId = new Map(questions.map((q) => [q.id, q]));
export const topicName = (slug: string) => topics.find((t) => t.slug === slug)?.name ?? slug;

declare const __BANK_VERSION__: string;
declare const __BUILD_TIME__: string;
export const bankVersion = __BANK_VERSION__;
export const buildTime = __BUILD_TIME__;
