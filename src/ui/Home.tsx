import { bankVersion, buildTime, questions, topics } from '../lib/bank';
import { isMastered } from '../lib/progress';
import { actions, useStore } from '../lib/store';
import { isQuizzable } from '../lib/types';
import { useState } from 'react';
import { checkNow, reloadFresh, useUpdate } from './updates';
import { useTwoTap } from './useTwoTap';
import { InstallHint } from './InstallHint';

export type Go = (s: { name: 'study'; topic?: string } | { name: 'cards' | 'test' | 'cram' | 'play' | 'finish' }) => void;

export function Home({ go }: { go: Go }) {
  const { progress } = useStore();
  const quiz = questions.filter(isQuizzable);
  const mastered = quiz.filter((q) => isMastered(progress[q.id])).length;
  const toFinish = questions.filter((q) => q.status !== 'ready').length;
  const update = useUpdate();
  const [check, setCheck] = useState<'' | 'checking' | 'updating' | 'current' | 'offline'>('');
  const [resetArmed, reset] = useTwoTap(actions.reset);

  return (
    <div className="home mx-auto min-h-dvh max-w-xl">
      <header className="home-header safe-top flex items-center gap-3 bg-[var(--color-navy)] px-5 pb-4 text-[var(--color-lavender)]">
        <img src="/brand/lasso-kj-dog-light.png" alt="" className="home-logo w-12" />
        <h1 className="home-title display text-[26px] leading-tight">Ops School</h1>
      </header>

      {/* Only on Home, in normal flow, so it never sits on top of a control mid-question. */}
      {update && (
        <button onClick={update} className="w-full bg-[var(--tag-bg)] px-4 py-3 text-center text-[15px] font-semibold text-[var(--tag)]">
          New questions available, tap to update
        </button>
      )}
      <InstallHint />
      {/* Landscape: .home-body becomes two columns, actions left and topics right (index.css). */}
      <div className="home-body px-4 pt-5">
        <div className="home-actions">
        <div className="flex items-center gap-5">
          <Ring done={mastered} total={quiz.length} />
          <div className="text-[15px] leading-snug text-[var(--muted)]">
            <div className="text-[17px] font-semibold text-[var(--ink)]">
              {mastered} of {quiz.length} mastered
            </div>
            Right twice in a row counts as mastered.
          </div>
        </div>

        <button onClick={() => go({ name: 'study' })} className="display mt-5 min-h-16 w-full rounded-2xl bg-[var(--accent)] text-[24px] text-[var(--on-accent)]">
          Study
        </button>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {(['play', 'cards', 'test', 'cram'] as const).map((n) => (
            <button key={n} onClick={() => go({ name: n })} className="min-h-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[15px] font-semibold capitalize">
              {n}
            </button>
          ))}
        </div>

        </div>
        <div className="home-topics">
        <h2 className="mb-1 mt-7 text-[13px] font-semibold uppercase tracking-wide text-[var(--muted)]">Topics</h2>
        <ul>
          {topics.map((t) => {
            const qs = quiz.filter((q) => q.topic === t.slug);
            const m = qs.filter((q) => isMastered(progress[q.id])).length;
            return (
              <li key={t.slug}>
                <button
                  disabled={!qs.length}
                  onClick={() => go({ name: 'study', topic: t.slug })}
                  className="flex min-h-14 w-full flex-col justify-center border-b border-[var(--line)] py-2 text-left disabled:opacity-60"
                >
                  <div className="flex w-full items-baseline justify-between gap-3">
                    <span className="text-[16px] font-medium leading-snug">{t.name}</span>
                    <span className="shrink-0 text-[13px] tabular-nums text-[var(--muted)]">{qs.length ? `${m}/${qs.length}` : 'No questions yet'}</span>
                  </div>
                  {qs.length > 0 && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-[var(--soft)]">
                      <div className="h-full bg-[var(--right)]" style={{ width: `${(100 * m) / qs.length}%` }} />
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="safe-bottom mt-6 flex flex-col items-center gap-2 pb-4 text-center text-[13px] text-[var(--muted)]">
          <div>
            Bank {bankVersion} · {questions.length} questions · {buildTime}
          </div>
          <div className="flex gap-4">
            <button onClick={() => go({ name: 'finish' })} className="min-h-11 px-2 underline">
              To finish ({toFinish})
            </button>
            <button onClick={reset} className={`min-h-11 px-2 underline ${resetArmed ? 'font-semibold text-[var(--wrong)]' : ''}`}>
              {resetArmed ? 'Tap again to erase all progress' : 'Reset progress'}
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4">
            <button
              onClick={async () => {
                setCheck('checking');
                setCheck(await checkNow());
              }}
              className="min-h-11 px-2 underline"
            >
              {check === 'checking'
                ? 'Checking…'
                : check === 'updating'
                  ? 'Updating…'
                  : check === 'current'
                    ? `Up to date (Bank ${bankVersion})`
                    : check === 'offline'
                      ? "Offline, can't check"
                      : 'Check for updates'}
            </button>
            {check === 'current' && (
              <button onClick={() => void reloadFresh()} className="min-h-11 px-2 underline">
                Still old? Reload fresh
              </button>
            )}
          </div>
          <a href="https://www.linkedin.com/in/kevinleephillips13" target="_blank" rel="noopener noreferrer" className="min-h-11 px-2 pt-2 text-[12px] underline opacity-80">
            Created by Lasso &amp; KJ, LLC
          </a>
        </footer>
        </div>
      </div>
    </div>
  );
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const f = total ? done / total : 0;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${done} of ${total} mastered`} className="shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--soft)" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--right)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 44 44)" />
      <text x="44" y="50" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--ink)">
        {Math.round(f * 100)}%
      </text>
    </svg>
  );
}
