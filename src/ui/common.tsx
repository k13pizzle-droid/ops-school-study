import type { ReactNode } from 'react';
import { topicName } from '../lib/bank';
import type { Question } from '../lib/types';

export function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="safe-top sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-2 pb-2">
      <button onClick={onBack} className="min-h-11 min-w-11 rounded-lg px-2 text-left text-[15px] font-medium text-[var(--muted)]" aria-label="Back to home">
        ‹ Home
      </button>
      <div className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{title}</div>
      <div className="flex min-w-11 justify-end">{right}</div>
    </div>
  );
}

export function SourceLine({ q }: { q: Question }) {
  const origin = q.source.origin === 'review' ? 'Review sheet' : q.source.origin === 'slides' ? 'Slides' : 'Practice';
  return (
    <div className="text-[13px] text-[var(--muted)]">
      {origin} · {topicName(q.topic)}
      {q.source.ref ? ` · ${q.source.ref}` : ''}
    </div>
  );
}

export const Unconfirmed = () => (
  <span className="rounded bg-[var(--tag-bg)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--tag)]">unconfirmed</span>
);

export function Star({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={on ? 'Unstar' : 'Star'} aria-pressed={on} className="min-h-11 min-w-11 text-2xl leading-none">
      <span className={on ? 'text-[var(--tag)]' : 'text-[var(--muted)] opacity-60'}>{on ? '★' : '☆'}</span>
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

export const letter = (i: number) => String.fromCharCode(97 + i);
