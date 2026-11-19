import type { Question, Topic } from './types';

const STATUSES = ['ready', 'needs-answer', 'needs-options', 'verify'];
const ORIGINS = ['review', 'slides', 'authored'];

export type ValidationResult = {
  errors: string[];
  byTopic: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
};

/**
 * Checks the whole bank. `files` maps a topic file's slug (its file name without .json) to its
 * parsed contents. Pure, so the build script and the unit tests share it.
 */
export function validateBank(topicsRaw: unknown, files: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const byTopic: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const seen = new Set<string>();
  let total = 0;

  if (!Array.isArray(topicsRaw)) return { errors: ['topics.json must be an array'], byTopic, byStatus, total };
  const topics = topicsRaw as Topic[];
  const slugs = new Set<string>();
  for (const t of topics) {
    if (!t || typeof t.slug !== 'string' || typeof t.name !== 'string') errors.push(`topics.json: bad entry ${JSON.stringify(t)}`);
    else if (slugs.has(t.slug)) errors.push(`topics.json: duplicate slug "${t.slug}"`);
    else {
      slugs.add(t.slug);
      byTopic[t.slug] = 0;
    }
  }

  for (const [file, data] of Object.entries(files)) {
    if (!slugs.has(file)) errors.push(`content/${file}.json: no topic "${file}" in topics.json`);
    if (!Array.isArray(data)) {
      errors.push(`content/${file}.json: must be an array of questions`);
      continue;
    }
    for (const raw of data as Question[]) {
      total++;
      const q = raw ?? ({} as Question);
      const where = `${file}.json ${q.id ?? `(question ${total})`}`;
      const err = (m: string) => errors.push(`${where}: ${m}`);

      if (typeof q.id !== 'string' || !q.id) err('missing id');
      else if (seen.has(q.id)) err('duplicate id');
      else seen.add(q.id);

      if (!slugs.has(q.topic)) err(`unknown topic "${q.topic}"`);
      else if (q.topic !== file) err(`topic "${q.topic}" doesn't match file ${file}.json`);
      if (q.type !== 'mc' && q.type !== 'tf') err(`type must be "mc" or "tf"`);
      if (typeof q.stem !== 'string' || !q.stem.trim()) err('missing stem');
      if (!STATUSES.includes(q.status)) err(`bad status "${q.status}"`);
      if (!q.source || !ORIGINS.includes(q.source.origin)) err('source.origin must be review, slides, or authored');
      if (q.optionsFrom !== 'exam' && q.optionsFrom !== 'authored') err('optionsFrom must be exam or authored');
      if (q.flashcard && (typeof q.flashcard.front !== 'string' || typeof q.flashcard.back !== 'string'))
        err('flashcard needs front and back strings');

      const playable = q.status === 'ready' || q.status === 'verify';
      if (q.type === 'tf') {
        if (q.options !== undefined) err('tf question must not have options');
        if (q.answer !== undefined && typeof q.answer !== 'boolean') err('tf answer must be true or false');
        if (playable && typeof q.answer !== 'boolean') err(`${q.status} question is missing its answer`);
      }
      if (q.type === 'mc') {
        const opts = q.options;
        if (opts !== undefined) {
          if (!Array.isArray(opts) || opts.some((o) => typeof o !== 'string' || !o.trim())) err('options must be non-empty strings');
          else if (opts.length < 2 || opts.length > 7) err(`mc needs 2 to 7 options, has ${opts.length}`);
          else if (new Set(opts).size !== opts.length) err('duplicate option text');
        }
        if (q.answer !== undefined) {
          if (typeof q.answer !== 'number' || !Number.isInteger(q.answer)) err('mc answer must be an option index');
          else if (opts && (q.answer < 0 || q.answer >= opts.length)) err(`answer index ${q.answer} out of range`);
        }
        if (playable && !opts) err(`${q.status} question is missing its options`);
        if (playable && q.answer === undefined) err(`${q.status} question is missing its answer`);
      }
      if (q.topic) byTopic[q.topic] = (byTopic[q.topic] ?? 0) + 1;
      if (q.status) byStatus[q.status] = (byStatus[q.status] ?? 0) + 1;
    }
  }
  for (const s of slugs) if (!(s in files)) errors.push(`topics.json lists "${s}" but content/${s}.json is missing`);
  return { errors, byTopic, byStatus, total };
}
