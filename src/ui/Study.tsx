import { useEffect, useMemo, useState } from 'react';
import { byId, questions, topicName } from '../lib/bank';
import { showOptions } from '../lib/options';
import { requeue, studyOrder } from '../lib/study';
import { answerText, isQuizzable } from '../lib/types';
import { actions, session, useStore } from '../lib/store';
import { BELOW_TOP_BAR, Btn, QuestionMeta, SourceLine, Star, TopBar } from './common';
import { OptionList } from './OptionList';
import { Slides } from './Slide';

const ROUND = 10;

type SavedStudy = { topic: string | null; queue: string[]; pos: number; round: { answered: number; right: number }; pending: string[]; between: boolean; total: { answered: number; right: number } };

export function Study({ topic, focus, resume, onBack }: { topic?: string | undefined; focus?: string[] | undefined; resume?: boolean; onBack: () => void }) {
  const { progress, stars } = useStore();
  const pool = useMemo(() => questions.filter((q) => isQuizzable(q) && (!topic || q.topic === topic)), [topic]);
  // After a relaunch, pick up the same session if it still fits the bank.
  const [saved] = useState(() => {
    if (!resume) return null;
    const s = session.load<SavedStudy>('study');
    if (!s || s.topic !== (topic ?? null) || !Array.isArray(s.queue) || !s.queue.length || s.queue.some((id) => !byId.has(id))) return null;
    return s;
  });
  const [queue, setQueue] = useState(() => saved?.queue ?? studyOrder(pool, progress, Math.random, focus));
  const [pos, setPos] = useState(() => Math.min(saved?.pos ?? 0, queue.length));
  const [chosen, setChosen] = useState<number | null>(null);
  const [round, setRound] = useState(() => saved?.round ?? { answered: 0, right: 0 });
  // Misses not yet answered right on their way back: the "N coming back" count.
  const [pending, setPending] = useState<Set<string>>(() => new Set(saved?.pending ?? []));
  const [between, setBetween] = useState(() => saved?.between ?? false);
  const [total, setTotal] = useState(() => saved?.total ?? { answered: 0, right: 0 });
  // Saved after every change. An answered-but-not-continued question counts as done (its answer
  // is already recorded), so a relaunch lands on the next one.
  useEffect(() => {
    session.save('study', { topic: topic ?? null, queue, pos: chosen !== null ? pos + 1 : pos, round, pending: [...pending], between: between || (chosen !== null && round.answered >= 10), total } satisfies SavedStudy);
  }, [topic, queue, pos, chosen, round, pending, between, total]);

  const q = byId.get(queue[pos] ?? '');
  // Fresh shuffle for each position, so a question that comes back isn't in the same order.
  const shown = useMemo(() => (q ? showOptions(q, Math.random) : null), [q, pos]);
  const title = topic ? topicName(topic) : 'Study';

  if (!pool.length)
    return (
      <Screen title={title} onBack={onBack}>
        <p className="read mt-10 text-center text-[19px] text-[var(--muted)]">No questions yet in this topic.</p>
      </Screen>
    );

  const restart = () => {
    setQueue(studyOrder(pool, progress, Math.random));
    setPos(0);
    setRound({ answered: 0, right: 0 });
    setPending(new Set());
    setTotal({ answered: 0, right: 0 });
    setBetween(false);
  };

  if (between || !q || !shown) {
    const done = !q;
    const r = done && !between ? total : round;
    return (
      <Screen title={title} onBack={onBack}>
        <div className="mt-16 flex flex-col items-center gap-6 px-6 text-center">
          <p className="display text-[30px]">
            {r.right} of {r.answered}.
          </p>
          {!done && pending.size > 0 && <p className="text-[17px] text-[var(--muted)]">{pending.size} coming back.</p>}
          {done && <p className="text-[17px] text-[var(--muted)]">That's every question{topic ? ' in this topic' : ''}.</p>}
          <Btn primary className="w-full max-w-xs" onClick={done ? restart : () => (setBetween(false), setRound({ answered: 0, right: 0 }))}>
            {done ? 'Go again' : 'Keep going'}
          </Btn>
          <Btn className="w-full max-w-xs" onClick={onBack}>
            Done for now
          </Btn>
        </div>
      </Screen>
    );
  }

  const reveal = chosen !== null;
  const correct = reveal && chosen === shown.answer;

  const pick = (i: number) => {
    if (reveal) return;
    setChosen(i);
    const ok = i === shown.answer;
    actions.answer(q.id, ok);
    if (!ok) setQueue((qq) => requeue(qq, pos));
    setPending((s) => {
      const n = new Set(s);
      if (ok) n.delete(q.id);
      else n.add(q.id);
      return n;
    });
    setRound((r) => ({ answered: r.answered + 1, right: r.right + (ok ? 1 : 0) }));
    setTotal((t) => ({ answered: t.answered + 1, right: t.right + (ok ? 1 : 0) }));
  };
  const next = () => {
    setChosen(null);
    setPos((p) => p + 1);
    if (round.answered >= ROUND) setBetween(true);
  };

  return (
    <Screen title={title} onBack={onBack} right={<Star on={!!stars[q.id]} onClick={() => actions.toggleStar(q.id)} />}>
      <div className={`px-4 pb-48 pt-4 ${reveal ? 'reveal-pad' : ''}`}>
        <QuestionMeta q={q} lead={`${Math.min(round.answered + (reveal ? 0 : 1), ROUND)} / ${ROUND}`} />
        <h2 className="read mb-5 text-[22px] font-semibold leading-snug">{q.stem}</h2>
        <Slides q={q} at="stem" />
        <OptionList shown={shown} chosen={chosen} reveal={reveal} onPick={pick} />
      </div>
      {reveal && (
        <div role="button" tabIndex={0} onClick={next} className="fixed inset-x-0 bottom-0 z-20 flex items-end bg-transparent text-left" style={{ top: BELOW_TOP_BAR }} aria-label="Continue">
          <div className="reveal-panel slide-up safe-bottom w-full rounded-t-2xl border-t-4 bg-[var(--surface)] px-5 pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.18)]" style={{ borderColor: correct ? 'var(--right)' : 'var(--wrong)' }}>
            <div className="text-[17px] font-bold" style={{ color: correct ? 'var(--right)' : 'var(--wrong)' }}>
              {correct ? 'Correct' : 'Not quite'}
            </div>
            {!correct && <div className="read mt-1 text-[19px]">Answer: {answerText(q)}</div>}
            {q.why && <div className="read mt-2 text-[18px] leading-snug">{q.why}</div>}
            <Slides q={q} at="answer" />
            <div className="mt-3">
              <SourceLine q={q} />
            </div>
            <div className="mt-3 pb-1 text-center text-[13px] text-[var(--muted)]">Tap anywhere to continue</div>
          </div>
        </div>
      )}
    </Screen>
  );
}

function Screen({ title, onBack, right, children }: { title: string; onBack: () => void; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="page mx-auto min-h-dvh max-w-xl">
      <TopBar title={title} onBack={onBack} right={right} />
      {children}
    </div>
  );
}
