import { useEffect, useMemo, useRef, useState } from 'react';
import { byId, questions } from '../lib/bank';
import { showOptions } from '../lib/options';
import { shuffled } from '../lib/random';
import { studyOrder } from '../lib/study';
import { actions, liveStreak, useStore } from '../lib/store';
import { answerText, isQuizzable } from '../lib/types';
import { Btn, QuestionMeta, TopBar } from './common';
import { OptionList } from './OptionList';
import { useTwoTap } from './useTwoTap';
import { Slides } from './Slide';

// Play: the game side. Lessons (10 questions, 3 hearts, XP and combos) and a 60-second Lightning
// round. Lesson answers count toward Study progress; Lightning's fast guesses don't.
const LESSON = 10;
const HEARTS = 3;
const LIGHTNING_SECONDS = 60;

export function Play({ onBack }: { onBack: () => void }) {
  const { game } = useStore();
  const [mode, setMode] = useState<'menu' | 'lesson' | 'lightning'>('menu');
  const [round, setRound] = useState(0);
  if (mode === 'lesson') return <Lesson key={round} onExit={() => setMode('menu')} onAgain={() => setRound((r) => r + 1)} />;
  if (mode === 'lightning') return <Lightning key={round} onExit={() => setMode('menu')} onAgain={() => setRound((r) => r + 1)} />;
  const streak = liveStreak(game);
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <TopBar title="Play" onBack={onBack} />
      <div className="safe-bottom px-4 pt-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat big={`🔥 ${streak}`} small={streak === 1 ? 'day streak' : 'day streak'} />
          <Stat big={`${game.xp}`} small="total XP" />
          <Stat big={`⚡ ${game.bestLightning}`} small="best lightning" />
        </div>
        <button onClick={() => setMode('lesson')} className="mt-6 w-full rounded-2xl bg-[var(--accent)] px-5 py-4 text-left text-[var(--on-accent)]">
          <div className="display text-[24px]">Lesson</div>
          <div className="text-[14px] opacity-90">10 questions, 3 hearts. Combos earn bonus XP. Your weak spots come first.</div>
        </button>
        <button onClick={() => setMode('lightning')} className="mt-3 w-full rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-left">
          <div className="display text-[24px]">Lightning round</div>
          <div className="text-[14px] text-[var(--muted)]">60 seconds. As many as you can. Beat your best.</div>
        </button>
        <p className="mt-6 text-center text-[13px] text-[var(--muted)]">Finish a lesson or a lightning round each day to keep the streak going.</p>
      </div>
    </div>
  );
}

const Stat = ({ big, small }: { big: string; small: string }) => (
  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] py-3">
    <div className="text-[22px] font-bold tabular-nums">{big}</div>
    <div className="text-[12px] text-[var(--muted)]">{small}</div>
  </div>
);

function Lesson({ onExit, onAgain }: { onExit: () => void; onAgain: () => void }) {
  const { progress } = useStore();
  const [queue, setQueue] = useState(() =>
    studyOrder(questions.filter(isQuizzable), progress, Math.random).slice(0, LESSON),
  );
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [hearts, setHearts] = useState(HEARTS);
  const [right, setRight] = useState(0);
  const [tries, setTries] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [banked, setBanked] = useState(false);
  const [quitArmed, quit] = useTwoTap(onExit);

  const goal = Math.min(LESSON, queue.length);
  const q = byId.get(queue[pos] ?? '');
  const shown = useMemo(() => (q ? showOptions(q, Math.random) : null), [q, pos]);
  const done = right >= goal;
  const out = hearts === 0 && chosen === null;
  const perfect = done && hearts === HEARTS;

  useEffect(() => {
    if (done && !banked) {
      setBanked(true);
      actions.earn(xp + (perfect ? 20 : 0));
    }
  }, [done, banked, xp, perfect]);

  if (done)
    return (
      <EndCard
        title={perfect ? 'Perfect lesson!' : 'Lesson complete!'}
        lines={[`+${xp + (perfect ? 20 : 0)} XP${perfect ? ' (20 for no hearts lost)' : ''}`, `${Math.round((100 * right) / tries)}% accuracy`, `Best combo: ${bestCombo}`]}
        confetti
        onAgain={onAgain}
        onExit={onExit}
      />
    );
  if (out)
    return <EndCard title="Out of hearts" lines={[`${right} of ${goal} done.`, 'The ones you missed come first next time.']} onAgain={onAgain} onExit={onExit} />;
  if (!q || !shown) return <EndCard title="No questions ready yet" lines={[]} onExit={onExit} />;

  const reveal = chosen !== null;
  const correct = reveal && chosen === shown.answer;
  const pick = (i: number) => {
    if (reveal) return;
    setChosen(i);
    setTries((t) => t + 1);
    const ok = i === shown.answer;
    actions.answer(q.id, ok);
    if (ok) {
      const c = combo + 1;
      setCombo(c);
      setBestCombo((b) => Math.max(b, c));
      setRight((r) => r + 1);
      setXp((x) => x + 10 + (c >= 3 ? 5 : 0));
    } else {
      setCombo(0);
      setHearts((h) => h - 1);
      setQueue((qq) => [...qq, q.id]); // missed ones come back at the end, like a redo
    }
  };
  const next = () => {
    setChosen(null);
    setPos((p) => p + 1);
  };

  return (
    <div className="page mx-auto flex min-h-dvh max-w-xl flex-col">
      <div className="safe-top flex items-center gap-3 bg-[var(--color-navy)] px-3 pb-2 text-[var(--color-lavender)]">
        <button onClick={quit} className={`min-h-11 min-w-11 ${quitArmed ? 'text-[13px] font-semibold' : 'text-[22px]'}`} aria-label="Quit lesson">
          {quitArmed ? 'Quit?' : '✕'}
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={right} aria-valuemax={goal}>
          <div className="h-full rounded-full bg-[var(--right)] transition-[width] duration-300" style={{ width: `${(100 * right) / goal}%` }} />
        </div>
        <div className="min-w-14 text-right text-[17px] font-bold text-[#fca5a5]" aria-label={`${hearts} hearts`}>
          {'♥'.repeat(hearts)}
          <span className="opacity-25">{'♥'.repeat(HEARTS - hearts)}</span>
        </div>
      </div>
      <div className={`px-4 pb-48 pt-3 ${reveal ? 'reveal-pad' : ''}`}>
        <div className="mb-1 h-6 text-[15px] font-bold text-[var(--tag)]">{combo >= 3 ? `🔥 ${combo} in a row` : ''}</div>
        <QuestionMeta q={q} />
        <h2 className="read mb-5 text-[22px] font-semibold leading-snug">{q.stem}</h2>
        <Slides q={q} at="stem" />
        <OptionList shown={shown} chosen={chosen} reveal={reveal} onPick={pick} />
      </div>
      {reveal && (
        <div role="button" tabIndex={0} onClick={next} className="fixed inset-0 z-20 flex items-end text-left" aria-label="Continue">
          <div
            className="reveal-panel slide-up safe-bottom w-full px-5 pt-4"
            style={{ background: correct ? 'var(--right-bg)' : 'var(--wrong-bg)', color: correct ? 'var(--right)' : 'var(--wrong)' }}
          >
            <div className="text-[20px] font-bold">{correct ? pickCheer(combo) : 'Not quite'}</div>
            {correct ? (
              <div className="text-[15px] font-semibold">+{10 + (combo >= 3 ? 5 : 0)} XP</div>
            ) : (
              <div className="read text-[18px]">Answer: {answerText(q)}</div>
            )}
            {q.why && <div className="read mt-1 text-[17px] leading-snug">{q.why}</div>}
            <Slides q={q} at="answer" />
            <div className="mt-3 min-h-12 rounded-xl bg-[var(--accent)] py-3 text-center text-[16px] font-bold text-[var(--on-accent)]">Continue</div>
          </div>
        </div>
      )}
    </div>
  );
}

const CHEERS = ['Nice!', 'Correct!', 'You got it!', 'Great!', 'Exactly!'];
const pickCheer = (combo: number) => (combo >= 5 ? 'On fire!' : CHEERS[combo % CHEERS.length]!);

function Lightning({ onExit, onAgain }: { onExit: () => void; onAgain: () => void }) {
  const { game } = useStore();
  const [order] = useState(() => shuffled(questions.filter(isQuizzable).map((q) => q.id), Math.random));
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<null | { i: number; ok: boolean }>(null);
  const [left, setLeft] = useState(LIGHTNING_SECONDS);
  const startBest = useRef(game.bestLightning);
  const finished = left <= 0;

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [finished]);
  useEffect(() => {
    if (finished) {
      actions.lightning(score);
      actions.earn(score * 5); // a finished round counts toward the day streak even at 0
    }
    // Runs once, when the clock hits zero.
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = byId.get(order[pos % order.length] ?? '');
  const shown = useMemo(() => (q ? showOptions(q, Math.random) : null), [q, pos]);

  if (finished)
    return (
      <EndCard
        title={score > startBest.current ? 'New best!' : "Time's up"}
        lines={[`${score} right in ${LIGHTNING_SECONDS} seconds`, `+${score * 5} XP`, `Best: ${Math.max(score, startBest.current)}`]}
        confetti={score > startBest.current}
        onAgain={onAgain}
        onExit={onExit}
      />
    );
  if (!q || !shown) return <EndCard title="No questions ready yet" lines={[]} onExit={onExit} />;

  const pick = (i: number) => {
    if (flash) return;
    const ok = i === shown.answer;
    if (ok) setScore((s) => s + 1);
    setFlash({ i, ok });
    setTimeout(() => (setFlash(null), setPos((p) => p + 1)), ok ? 350 : 900);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <div className="safe-top flex items-center justify-between bg-[var(--color-navy)] px-4 pb-2 text-[var(--color-lavender)]">
        <button onClick={onExit} className="min-h-11 min-w-11 text-left text-[22px]" aria-label="Quit">
          ✕
        </button>
        <div className={`text-[28px] font-bold tabular-nums ${left <= 10 ? 'text-[#fca5a5]' : ''}`}>0:{String(left).padStart(2, '0')}</div>
        <div className="min-w-11 text-right text-[22px] font-bold tabular-nums">⚡{score}</div>
      </div>
      <div className="px-4 pt-3">
        <QuestionMeta q={q} />
        <h2 className="read mb-5 text-[22px] font-semibold leading-snug">{q.stem}</h2>
        <OptionList shown={shown} chosen={flash?.i ?? null} reveal={!!flash} onPick={pick} />
      </div>
    </div>
  );
}

function EndCard({ title, lines, confetti, onAgain, onExit }: { title: string; lines: string[]; confetti?: boolean; onAgain?: () => void; onExit: () => void }) {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
      {confetti && <Confetti />}
      <p className="display text-[34px] leading-tight">{title}</p>
      {lines.map((l) => (
        <p key={l} className="text-[18px] text-[var(--muted)]">
          {l}
        </p>
      ))}
      <div className="mt-4 flex w-full max-w-xs flex-col gap-3">
        {onAgain && (
          <Btn primary onClick={onAgain}>
            Play again
          </Btn>
        )}
        <Btn onClick={onExit}>Done</Btn>
      </div>
    </div>
  );
}

function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.6, hue: [145, 45, 240, 350][i % 4]!, size: 6 + Math.random() * 6 })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti absolute top-0 rounded-sm"
          style={{ left: `${b.left}%`, width: b.size, height: b.size * 1.6, background: `hsl(${b.hue} 80% 60%)`, animationDelay: `${b.delay}s` }}
        />
      ))}
    </div>
  );
}
