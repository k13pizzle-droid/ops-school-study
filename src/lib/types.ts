// The question bank schema. docs/ADDING-QUESTIONS.md explains every field for whoever adds content.
export type Status = 'ready' | 'needs-answer' | 'needs-options' | 'verify';
export type Origin = 'review' | 'slides' | 'authored';

/**
 * A slide screenshot on a question. `mark` draws a highlight box over the part that matters, in
 * percent of the image (0-100), so the image file itself is never edited.
 */
export type SlideImage = {
  src: string; // "slides/<file>.webp", a file in public/slides/
  alt: string; // what the slide shows, for screen readers and if the image fails to load
  at: 'stem' | 'answer'; // with the question, or in the answer panel / card back
  mark?: { x: number; y: number; w: number; h: number };
};

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
  images?: SlideImage[]; // at most 2
};

export type Topic = { slug: string; name: string };

export const isQuizzable = (q: Question) => q.status === 'ready' || q.status === 'verify';

/** The correct answer as text, for flashcards and the answer panel. */
export function answerText(q: Question): string | null {
  if (q.answer === undefined) return null;
  if (q.type === 'tf') return q.answer ? 'True' : 'False';
  return typeof q.answer === 'number' ? (q.options?.[q.answer] ?? null) : null;
}
