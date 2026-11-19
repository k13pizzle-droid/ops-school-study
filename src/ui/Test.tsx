import { useEffect, useState } from 'react';
import { questions, topicName } from '../lib/bank';
import { sampleExam } from '../lib/exam';
import { showOptions, type Shown } from '../lib/options';
import { actions, useStore, type TestResult } from '../lib/store';
import { isQuizzable, type Question } from '../lib/types';
import { Btn, SourceLine, TopBar, Unconfirmed } from './common';
import { OptionList } from './OptionList';

type Run = { qs: Question[]; shown: Shown[]; picks: (number | null)[]; started: number; timer: boolean };

/** Mock exam: no feedback until the end, any answer can be changed before finishing. */
export function Test({ onBack, onStudyMisses }: { onBack: () => void; onStudyMisses: (ids: string[]) => void }) {
  const { tests } = useStore();
  const pool = questions.filter(isQuizzable);
  const [size, setSize] = useState(100);
  const [timer, setTimer] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [idx, setIdx] = useState(0);
  const [grid, setGrid] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [review, setReview] = useState(false);

  if (result && run)
    return review ? (
      <Review run={run} onDone={() => setReview(false)} />
    ) : (
      <Results r={result} onBack={onBack} onReview={() => setReview(true)} onStudyMisses={() => onStudyMisses(result.missed)} />
    );

  if (!run)
    return (
      <div className="mx-auto min-h-dvh max-w-xl">
        <TopBar title="Mock test" onBack={onBack} />
        <div className="safe-bottom flex flex-col gap-5 px-4 pt-5">
          <div>
            <div className="mb-2 text-[14px] font-semibold text-[var(--muted)]">How many questions</div>
            <div className="grid grid-cols-3 gap-2">
              {[50, 100, 150].map((n) => (
                <button
                  key={n}
                  onClick={() => setSize(n)}
                  className={`min-h-12 rounded-xl text-[17px] font-semibold ${size === n ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'border border-[var(--line)] bg-[var(--surface)]'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            {pool.length < size && (
              <p className="mt-2 text-[13px] text-[var(--muted)]">Only {pool.length} questions are ready right now, so the test uses all of them.</p>
            )}
          </div>
          <label className="flex min-h-12 items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4">
            <span className="text-[16px] font-semibold">Show a timer</span>
            <input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} className="h-6 w-6 accent-[var(--accent)]" />
          </label>
          <Btn
            primary
            onClick={() => {
              const qs = sampleExam(pool, size, Math.random);
              setRun({ qs, shown: qs.map((q) => showOptions(q, Math.random)), picks: qs.map(() => null), started: Date.now(), timer });
              setIdx(0);
            }}
          >
            Start test
          </Btn>
          {tests.length > 0 && (
            <div>
              <div className="mb-2 text-[14px] font-semibold text-[var(--muted)]">Last results</div>
              {tests.map((t) => (
                <div key={t.at} className="flex justify-between border-b border-[var(--line)] py-2 text-[15px]">
                  <span>{new Date(t.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="font-semibold">
                    {t.score}/{t.total} · {Math.round((100 * t.score) / t.total)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );

  const q = run.qs[idx]!;
  const answered = run.picks.filter((p) => p !== null).length;
  const finish = () => {
    const left = run.qs.length - answered;
    if (left && !confirm(`${left} unanswered. Finish anyway?`)) return;
    const byTopic: Record<string, [number, number]> = {};
    const missed: string[] = [];
    const results: [string, boolean][] = [];
    run.qs.forEach((qq, i) => {
      const ok = run.picks[i] === run.shown[i]!.answer;
      const t = (byTopic[qq.topic] ??= [0, 0]);
      t[1]++;
      if (ok) t[0]++;
      else missed.push(qq.id);
      if (run.picks[i] !== null) results.push([qq.id, ok]);
    });
    const r: TestResult = { at: Date.now(), score: run.qs.length - missed.length, total: run.qs.length, byTopic, missed };
    actions.answerMany(results);
    actions.saveTest(r);
    setResult(r);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <TopBar
        title={`${idx + 1} of ${run.qs.length}`}
        onBack={() => confirm('Leave the test? Answers so far are lost.') && onBack()}
        right={run.timer ? <Clock from={run.started} /> : undefined}
      />
      {grid ? (
        <div className="flex-1 px-4 pt-3">
          <div className="mb-2 text-[13px] text-[var(--muted)]">
            {answered} of {run.qs.length} answered. Tap a number to jump.
          </div>
          <div className="grid grid-cols-6 gap-2">
            {run.qs.map((_, i) => (
              <button
                key={i}
                onClick={() => (setIdx(i), setGrid(false))}
                className={`min-h-11 rounded-lg text-[15px] font-semibold ${run.picks[i] !== null ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'border border-[var(--line)] bg-[var(--surface)]'} ${i === idx ? 'ring-2 ring-[var(--tag)]' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 px-4 pb-6 pt-4">
          <div className="mb-3 flex gap-2 text-[13px] text-[var(--muted)]">
            {q.type === 'tf' && <span>True or false</span>}
            {q.status === 'verify' && <Unconfirmed />}
          </div>
          <h2 className="read mb-5 text-[22px] font-semibold leading-snug">{q.stem}</h2>
          <OptionList
            shown={run.shown[idx]!}
            chosen={run.picks[idx]!}
            reveal={false}
            onPick={(i) => setRun({ ...run, picks: run.picks.map((p, j) => (j === idx ? i : p)) })}
          />
        </div>
      )}
      <div className="safe-bottom sticky bottom-0 grid grid-cols-3 gap-2 border-t border-[var(--line)] bg-[var(--bg)] px-4 pt-3">
        <Btn onClick={() => setIdx((i) => Math.max(0, i - 1))}>‹ Back</Btn>
        <Btn onClick={() => setGrid((g) => !g)}>{grid ? 'Question' : 'All'}</Btn>
        {idx < run.qs.length - 1 ? (
          <Btn primary onClick={() => (setIdx((i) => i + 1), setGrid(false))}>
            Next ›
          </Btn>
        ) : (
          <Btn primary onClick={finish}>
            Finish
          </Btn>
        )}
      </div>
    </div>
  );
}

function Clock({ from }: { from: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor((now - from) / 1000);
  return <span className="pr-2 text-[15px] tabular-nums text-[var(--muted)]">{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</span>;
}

function Results({ r, onBack, onReview, onStudyMisses }: { r: TestResult; onBack: () => void; onReview: () => void; onStudyMisses: () => void }) {
  const rows = Object.entries(r.byTopic).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]);
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <TopBar title="Results" onBack={onBack} />
      <div className="safe-bottom px-4 pt-6">
        <div className="text-center">
          <div className="display text-[44px]">{Math.round((100 * r.score) / r.total)}%</div>
          <div className="text-[16px] text-[var(--muted)]">
            {r.score} of {r.total} right
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {r.missed.length > 0 && (
            <Btn primary onClick={onStudyMisses}>
              Study my misses ({r.missed.length})
            </Btn>
          )}
          <Btn onClick={onReview}>Review answers</Btn>
        </div>
        <div className="mb-2 mt-6 text-[14px] font-semibold text-[var(--muted)]">By topic, weakest first</div>
        {rows.map(([t, [ok, n]]) => (
          <div key={t} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2 text-[15px]">
            <span className="min-w-0 flex-1">{topicName(t)}</span>
            <span className="font-semibold tabular-nums">
              {ok}/{n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Review({ run, onDone }: { run: Run; onDone: () => void }) {
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <TopBar title="Review" onBack={onDone} />
      <div className="safe-bottom flex flex-col gap-6 px-4 pt-4">
        {run.qs.map((q, i) => (
          <div key={q.id}>
            <div className="mb-1 text-[13px] text-[var(--muted)]">
              {i + 1}. {run.picks[i] === run.shown[i]!.answer ? 'Right' : run.picks[i] === null ? 'Skipped' : 'Wrong'}
            </div>
            <h3 className="read mb-3 text-[19px] font-semibold leading-snug">{q.stem}</h3>
            <OptionList shown={run.shown[i]!} chosen={run.picks[i]!} reveal onPick={() => {}} />
            {q.why && <p className="read mt-2 text-[17px]">{q.why}</p>}
            <div className="mt-1">
              <SourceLine q={q} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
