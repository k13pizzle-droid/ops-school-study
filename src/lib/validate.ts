import { PINNED } from './options';
import type { Question, Topic } from './types';

const STATUSES = ['ready', 'needs-answer', 'needs-options', 'verify'];
const ORIGINS = ['review', 'slides', 'authored'];
const KEYS = new Set(['id', 'topic', 'type', 'stem', 'options', 'shuffle', 'answer', 'why', 'source', 'optionsFrom', 'status', 'flashcard', 'keyFact']);
const SOURCE_KEYS = new Set(['origin', 'ref']);
// Options that point at other options by letter ("A & D", "Both B and C") need shuffle: false.
const LETTER_REF = /\b[A-G]\s*(&|and|or)\s*[A-G]\b/;
const ABOVE = /the above/i;

export type ValidationResult = {
  errors: string[];
  byTopic: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
};

const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

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
    const stems = new Set<string>();
    for (const raw of data as Question[]) {
      total++;
      const q = raw ?? ({} as Question);
      const where = `${file}.json ${q.id ?? `(question ${total})`}`;
      const err = (m: string) => errors.push(`${where}: ${m}`);

      for (const k of Object.keys(q)) if (!KEYS.has(k)) err(`unknown field "${k}" (typo?)`);
      if (q.source && typeof q.source === 'object') for (const k of Object.keys(q.source)) if (!SOURCE_KEYS.has(k)) err(`unknown field "source.${k}"`);

      if (typeof q.id !== 'string' || !q.id) err('missing id');
      else if (seen.has(q.id)) err('duplicate id');
      else seen.add(q.id);

      if (!slugs.has(q.topic)) err(`unknown topic "${q.topic}"`);
      else if (q.topic !== file) err(`topic "${q.topic}" doesn't match file ${file}.json`);
      if (q.type !== 'mc' && q.type !== 'tf') err(`type must be "mc" or "tf"`);
      if (!str(q.stem)) err('missing stem');
      else {
        const norm = q.stem.trim().toLowerCase();
        if (stems.has(norm)) err('same stem as another question in this file');
        stems.add(norm);
      }
      if (!STATUSES.includes(q.status)) err(`bad status "${q.status}"`);
      if (!q.source || !ORIGINS.includes(q.source.origin)) err('source.origin must be review, slides, or authored');
      if (q.source?.ref !== undefined && !str(q.source.ref)) err('source.ref must be a non-empty string');
      if (q.optionsFrom !== 'exam' && q.optionsFrom !== 'authored') err('optionsFrom must be exam or authored');
      if (q.optionsFrom === 'exam' && q.source?.origin !== 'review') err('optionsFrom "exam" only goes with origin "review"');
      if (q.why !== undefined && !str(q.why)) err('why must be a non-empty string');
      if (q.keyFact !== undefined) {
        if (!str(q.keyFact)) err('keyFact must be a non-empty string');
        else if (q.keyFact.indexOf(': ') < 1) err('keyFact must read "Label: fact" (the part after ": " hides in Cram)');
      }
      if (q.flashcard !== undefined && (!q.flashcard || !str(q.flashcard.front) || !str(q.flashcard.back)))
        err('flashcard needs non-empty front and back');
      if (q.shuffle !== undefined && typeof q.shuffle !== 'boolean') err('shuffle must be true or false, not a string');

      const playable = q.status === 'ready' || q.status === 'verify';
      if (q.type === 'tf') {
        if (q.options !== undefined) err('tf question must not have options');
        if (q.answer !== undefined && typeof q.answer !== 'boolean') err('tf answer must be true or false');
        if (playable && typeof q.answer !== 'boolean') err(`${q.status} question is missing its answer`);
        if (q.answer === false && !q.why && !q.flashcard) err('a False statement needs a why or a flashcard saying what is true');
      }
      if (q.type === 'mc') {
        const opts = q.options;
        if (opts !== undefined) {
          if (!Array.isArray(opts) || opts.some((o) => !str(o))) err('options must be non-empty strings');
          else {
            if (opts.length < 2 || opts.length > 7) err(`mc needs 2 to 7 options, has ${opts.length}`);
            if (new Set(opts).size !== opts.length) err('duplicate option text');
            if (q.shuffle !== false && opts.some((o) => LETTER_REF.test(o))) err('an option refers to other options by letter; set "shuffle": false');
            if (q.shuffle !== false && opts.some((o) => ABOVE.test(o) && !PINNED.test(o.trim())))
              err('an option mentions "the above" but isn\'t a standard "All/None of the above"; reword it or set "shuffle": false');
            if (opts.some((o) => /^\s*\(?[a-gA-G][.)]\s/.test(o))) err('option text starts with a letter label; the app adds letters itself');
          }
        }
        if (q.shuffle === false && !q.why && !q.flashcard) err('a shuffle:false question needs a why or a flashcard that spells the answer out');
        if (q.answer !== undefined) {
          if (typeof q.answer !== 'number' || !Number.isInteger(q.answer)) err('mc answer must be an option index (0 = first option)');
          else if (opts && (q.answer < 0 || q.answer >= opts.length)) err(`answer index ${q.answer} out of range (0-based: 0 to ${opts.length - 1})`);
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
