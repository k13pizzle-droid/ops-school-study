import { useEffect, useState } from 'react';
import { byId, questions, topicName } from '../lib/bank';
import { sampleExam } from '../lib/exam';
import { showOptions, type Shown } from '../lib/options';
import { actions, savedRun, useStore, type TestResult } from '../lib/store';
import { isQuizzable, type Question } from '../lib/types';
import { Btn, QuestionMeta, SourceLine, TopBar } from './common';
import { OptionList } from './OptionList';
import { useTwoTap } from './useTwoTap';
import { Slides } from './Slide';

type Run = { qs: Question[]; shown: Shown[]; picks: (number | null)[]; started: number; timer: boolean };

/** A test saved mid-way, if every question in it is still in the bank. */
function loadSaved(): (Run & { idx: number }) | null {
  const s = savedRun.load();
  if (!s) return null;
  const qs = s.ids.map((id) => byId.get(id));
  if (qs.some((q) => !q) || s.shown.length !== qs.length) return null;
  return { qs: qs as Question[], shown: s.shown, picks: s.picks, started: s.started, timer: s.timer, idx: s.idx };
}

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
  const [saved, setSaved] = useState(loadSaved);

  // Save after every answer and every move, so leaving (back swipe, update, iOS closing the app)
  // never loses a test. Cleared when the test is finished.
  useEffect(() => {
    if (run && !result) savedRun.save({ ids: run.qs.map((q) => q.id), shown: run.shown, picks: run.picks, idx, started: run.started, timer: run.timer });
  }, [run, idx, result]);

  const answered = run ? run.picks.filter((p) => p !== null).length : 0;
  const finish = () => {
    if (!run) return;
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
    savedRun.clear();
    setResult(r);
  };
  const [finishArmed, tapFinish] = useTwoTap(finish);

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
          {saved && (
            <Btn
              primary
              onClick={() => {
                const { idx: i, ...r } = saved;
                setRun(r);
                setIdx(i);
              }}
            >
              Resume test ({saved.picks.filter((p) => p !== null).length} of {saved.qs.length} answered)
            </Btn>
          )}
          <Btn
            primary={!saved}
            onClick={() => {
              savedRun.clear();
              setSaved(null);
              const qs = sampleExam(pool, size, Math.random);
              setRun({ qs, shown: qs.map((q) => showOptions(q, Math.random)), picks: qs.map(() => null), started: Date.now(), timer });
              setIdx(0);
            }}
          >
            {saved ? 'Start a new test' : 'Start test'}
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
  const left = run.qs.length - answered;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <TopBar
        title={`${idx + 1} of ${run.qs.length}`}
        onBack={onBack /* the test is saved; Test offers Resume next time */}
        right={run.timer ? <Clock from={run.started} /> : undefined}
      />
      {grid ? (
        <div className="flex-1 px-4 pt-3">
          <div className="mb-2 text-[13px] text-[var(--muted)]">
            {answered} of {run.qs.length} answered. Tap a number to jump, or finish from the last question.
          </div>
          <div className="test-grid grid grid-cols-6 gap-2">
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
          <QuestionMeta q={q} />
          <h2 className="read mb-5 text-[22px] font-semibold leading-snug">{q.stem}</h2>
          <Slides q={q} at="stem" />
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
          <Btn primary onClick={left ? tapFinish : finish} className={finishArmed ? 'text-[14px] leading-tight' : ''}>
            {finishArmed ? `${left} blank. Tap again` : 'Finish'}
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
            <Slides q={q} at="answer" />
            <div className="mt-1">
              <SourceLine q={q} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
