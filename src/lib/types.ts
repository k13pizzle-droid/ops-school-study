// The question bank schema. docs/ADDING-QUESTIONS.md explains every field for whoever adds content.
export type Status = 'ready' | 'needs-answer' | 'needs-options' | 'verify';
export type Origin = 'review' | 'slides' | 'authored';

export type Question = {
  id: string; // stable forever, e.g. "bsa-003". Progress is keyed to it. Never renumber.
  topic: string;
  type: 'mc' | 'tf';
  stem: string;
  options?: string[]; // mc only, 2 to 7
  shuffle?: boolean; // default true; false when options refer to each other by letter
  answer?: number | boolean; // index into options for mc, true/false for tf. Absent only while needs-answer.
  why?: string;
  source: { origin: Origin; ref?: string };
  optionsFrom: 'exam' | 'authored';
  status: Status;
  flashcard?: { front: string; back: string };
  keyFact?: string;
};

export type Topic = { slug: string; name: string };

export const isQuizzable = (q: Question) => q.status === 'ready' || q.status === 'verify';

/** The correct answer as text, for flashcards and the answer panel. */
export function answerText(q: Question): string | null {
  if (q.answer === undefined) return null;
  if (q.type === 'tf') return q.answer ? 'True' : 'False';
  return typeof q.answer === 'number' ? (q.options?.[q.answer] ?? null) : null;
}
