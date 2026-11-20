import { useEffect, useMemo, useRef, useState } from 'react';
import { byId, questions } from '../lib/bank';
import { isMissed } from '../lib/progress';
import { shuffled } from '../lib/random';
import { actions, session, useStore } from '../lib/store';
import { answerText, type Question } from '../lib/types';
import { Btn, ExamReview, SourceLine, Star, TopBar, Unconfirmed } from './common';

type Filter = 'all' | 'missed' | 'starred';
const front = (q: Question) => q.flashcard?.front ?? q.stem;
// A card back should teach something: "All of the above" lists what "all" is, and a bare
// "False" or "A & D" gets the explanation underneath.
const back = (q: Question) => {
  if (q.flashcard) return q.flashcard.back;
  const a = answerText(q);
  if (a && /^all of the above/i.test(a)) return `All of the above: ${q.options!.filter((o) => o !== a).join('; ')}`;
  return a;
};
const backNote = (q: Question) => (!q.flashcard && (q.type === 'tf' || q.shuffle === false) ? (q.why ?? q.keyFact) : undefined);

/** Flashcards. Any question with an answer, even ones not ready for the quiz yet. */
type SavedCards = { filter: Filter; order: string[]; i: number; got: number };

export function Cards({ resume, onBack }: { resume?: boolean; onBack: () => void }) {
  const { progress, stars } = useStore();
  // After a relaunch, pick the deck back up where it was.
  const [saved] = useState(() => {
    if (!resume) return null;
    const s = session.load<SavedCards>('cards');
    return s && Array.isArray(s.order) && s.order.every((id) => byId.has(id)) ? s : null;
  });
  const [filter, setFilter] = useState<Filter>(saved?.filter ?? 'all');
  const deck = useMemo(
    () =>
      questions.filter(
        (q) => back(q) && (filter === 'all' || (filter === 'missed' ? isMissed(progress[q.id]) : stars[q.id])),
      ),
    // Rebuild only when the filter changes, not on every star tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter],
  );
  const [order, setOrder] = useState<string[]>(() => saved?.order ?? shuffled(deck.map((q) => q.id), Math.random));
  const [deckKey, setDeckKey] = useState(filter);
  const [i, setI] = useState(saved?.i ?? 0);
  const [flipped, setFlipped] = useState(false);
  const [got, setGot] = useState(saved?.got ?? 0);
  useEffect(() => session.save('cards', { filter, order, i, got } satisfies SavedCards), [filter, order, i, got]);
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);

  if (deckKey !== filter) {
    setDeckKey(filter);
    setOrder(shuffled(deck.map((q) => q.id), Math.random));
    setI(0);
    setGot(0);
    setFlipped(false);
  }

  const q = byId.get(order[i] ?? '');
  const go = (ok: boolean) => {
    if (!q) return;
    if (ok) setGot((g) => g + 1);
    else setOrder((o) => [...o, q.id]); // "again" goes to the back of the deck
    setI((n) => n + 1);
    setFlipped(false);
    setDx(0);
  };
  const restart = () => {
    setOrder(shuffled(deck.map((x) => x.id), Math.random));
    setI(0);
    setGot(0);
    setFlipped(false);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <TopBar title="Cards" onBack={onBack} right={q && <Star on={!!stars[q.id]} onClick={() => actions.toggleStar(q.id)} />} />
      <div className="flex gap-2 px-4 pt-3">
        {(['all', 'missed', 'starred'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-full px-4 text-[14px] font-semibold capitalize ${filter === f ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'border border-[var(--line)] bg-[var(--surface)]'}`}
          >
            {f}
          </button>
        ))}
      </div>
      {!deck.length ? (
        <p className="read mt-16 px-6 text-center text-[19px] text-[var(--muted)]">
          {filter === 'missed' ? 'Nothing missed yet.' : filter === 'starred' ? 'No starred questions yet. Tap ☆ on any question.' : 'No cards yet.'}
        </p>
      ) : !q ? (
        <div className="mt-16 flex flex-col items-center gap-5 px-6 text-center">
          <p className="display text-[28px]">Deck done.</p>
          <p className="text-[var(--muted)]">{deck.length} cards</p>
          <Btn primary className="w-full max-w-xs" onClick={restart}>
            Go again
          </Btn>
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 text-[13px] text-[var(--muted)]">
            {got} of {deck.length} got · {order.length - i} left
          </div>
          {/* Wider side margins keep a swipe clear of the iPhone's edge back-gesture. */}
          <div className="flex flex-1 flex-col px-7 py-3">
            <div
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                start.current = e.clientX;
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
              onPointerUp={(e) => {
                // Measure from the event itself: the dx state can lag a fast flick by a frame.
                const d = start.current === null ? 0 : e.clientX - start.current;
                start.current = null;
                if (d > 80) go(true);
                else if (d < -80) go(false);
                else {
                  if (Math.abs(d) < 10) setFlipped((f) => !f);
                  setDx(0);
                }
              }}
              onPointerCancel={() => ((start.current = null), setDx(0))}
              className="flex min-h-[46dvh] flex-1 touch-pan-y select-none flex-col justify-center rounded-2xl border-2 bg-[var(--surface)] p-6 text-center"
              style={{
                transform: `translateX(${dx}px) rotate(${dx / 30}deg)`,
                borderColor: dx > 40 ? 'var(--right)' : dx < -40 ? 'var(--wrong)' : 'var(--line)',
                transition: start.current === null ? 'transform 150ms' : 'none',
              }}
            >
              <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {q.source.origin === 'review' && (
                  <div className="mb-2">
                    <ExamReview />
                  </div>
                )}
                {flipped ? 'Answer' : 'Question'} {q.status === 'verify' && <Unconfirmed />}
              </div>
              <div className={`read leading-snug ${flipped ? 'text-[24px] font-semibold' : 'text-[22px]'}`}>{flipped ? back(q) : front(q)}</div>
              {flipped && backNote(q) && <div className="read mt-3 text-[18px] leading-snug">{backNote(q)}</div>}
              {flipped && (
                <div className="mt-4">
                  <SourceLine q={q} />
                </div>
              )}
              {!flipped && <div className="mt-6 text-[13px] text-[var(--muted)]">Tap to flip</div>}
            </div>
          </div>
          <div className="safe-bottom sticky bottom-0 grid grid-cols-2 gap-3 bg-[var(--bg)] px-4 pt-2">
            <button onClick={() => go(false)} className="min-h-14 rounded-xl border-2 border-[var(--wrong)] text-[17px] font-semibold text-[var(--wrong)]">
              ← Again
            </button>
            <button onClick={() => go(true)} className="min-h-14 rounded-xl border-2 border-[var(--right)] text-[17px] font-semibold text-[var(--right)]">
              Got it →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
