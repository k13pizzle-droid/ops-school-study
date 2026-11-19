import type { ReactNode } from 'react';
import { topicName } from '../lib/bank';
import type { Question } from '../lib/types';

export function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    // Navy in both themes: the iPhone status bar draws white text over the top of the page.
    <div className="topbar safe-top sticky top-0 z-30 flex items-center gap-2 bg-[var(--color-navy)] px-2 pb-2 text-[var(--color-lavender)]">
      <button onClick={onBack} className="min-h-11 min-w-11 rounded-lg px-2 text-left text-[15px] font-medium opacity-90" aria-label="Back to home">
        ‹ Home
      </button>
      <div className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{title}</div>
      <div className="flex min-w-11 justify-end">{right}</div>
    </div>
  );
}

export function SourceLine({ q }: { q: Question }) {
  const origin = q.source.origin === 'review' ? 'From the exam review' : q.source.origin === 'slides' ? 'Slides' : 'Practice';
  return (
    <div className="text-[13px] text-[var(--muted)]">
      {origin} · {topicName(q.topic)}
      {q.source.ref ? ` · ${q.source.ref}` : ''}
    </div>
  );
}

/** Marks the instructors' review questions: the best predictor of what's on the exam. */
export const ExamReview = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[12px] font-semibold normal-case tracking-normal text-[var(--on-accent)]">
    <span className="display text-[14px] leading-none" aria-hidden>
      !
    </span>
    Exam review
  </span>
);

export const Unconfirmed = () => (
  <span className="rounded bg-[var(--tag-bg)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--tag)]">unconfirmed</span>
);

export function Star({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={on ? 'Unstar' : 'Star'} aria-pressed={on} className="min-h-11 min-w-11 text-2xl leading-none">
      <span className={on ? 'text-[#fcd34d]' : 'opacity-70'}>{on ? '★' : '☆'}</span>
    </button>
  );
}

export const Btn = ({ children, onClick, primary, className = '' }: { children: ReactNode; onClick: () => void; primary?: boolean; className?: string }) => (
  <button
    onClick={onClick}
    className={`min-h-12 rounded-xl px-4 text-[16px] font-semibold ${primary ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'border border-[var(--line)] bg-[var(--surface)]'} ${className}`}
  >
    {children}
  </button>
);

export const letter = (i: number) => String.fromCharCode(65 + i);

/** Height of TopBar, so overlays can start below it and leave the star tappable. */
export const BELOW_TOP_BAR = 'calc(max(env(safe-area-inset-top), 12px) + 52px)';

/** The small line above a question: topic, type, unconfirmed tag. */
export function QuestionMeta({ q, lead }: { q: Question; lead?: string }) {
  return (
    <div className="mb-3 text-[13px] text-[var(--muted)]">
      {/* On its own line, above the number and topic, so it reads first. */}
      {q.source.origin === 'review' && (
        <div className="mb-1.5">
          <ExamReview />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {lead && <span>{lead} ·</span>}
      <span>{topicName(q.topic)}</span>
      {q.type === 'tf' && <span>· True or false</span>}
      {q.status === 'verify' && <Unconfirmed />}
      </div>
    </div>
  );
}
