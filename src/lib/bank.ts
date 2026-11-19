import topicsJson from '../../content/topics.json';
import type { Question, Topic } from './types';

// Every content/*.json except topics.json is a topic file. Bundled at build time, so a new deploy
// carries the new bank and the service worker picks it up.
const files = import.meta.glob<Question[]>(['../../content/*.json', '!../../content/topics.json'], {
  eager: true,
  import: 'default',
});

export const topics: Topic[] = topicsJson as Topic[];
export const questions: Question[] = topics.flatMap((t) => files[`../../content/${t.slug}.json`] ?? []);
export const byId = new Map(questions.map((q) => [q.id, q]));
export const topicName = (slug: string) => topics.find((t) => t.slug === slug)?.name ?? slug;

declare const __BANK_VERSION__: string;
declare const __BUILD_TIME__: string;
export const bankVersion = __BANK_VERSION__;
export const buildTime = __BUILD_TIME__;
