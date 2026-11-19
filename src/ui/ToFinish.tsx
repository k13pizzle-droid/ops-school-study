import { questions, topics } from '../lib/bank';
import { TopBar } from './common';

const LABEL = { 'needs-answer': 'needs answer', 'needs-options': 'needs options', verify: 'verify', ready: '' } as const;

/** The gaps: questions waiting on an answer, options, or a check against the slides. */
export function ToFinish({ onBack }: { onBack: () => void }) {
  const open = questions.filter((q) => q.status !== 'ready');
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <TopBar title="To finish" onBack={onBack} />
      <div className="safe-bottom px-4 pt-2">
        {!open.length && <p className="mt-10 text-center text-[var(--muted)]">Nothing left to finish.</p>}
        {topics.map((t) => {
          const list = open.filter((q) => q.topic === t.slug);
          if (!list.length) return null;
          return (
            <section key={t.slug} className="mb-4">
              <h2 className="display mb-2 mt-4 text-[19px]">{t.name}</h2>
              {list.map((q) => (
                <div key={q.id} className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                  <div className="text-[12px] font-semibold uppercase text-[var(--tag)]">
                    {LABEL[q.status]} · {q.id}
                  </div>
                  <div className="read text-[17px] leading-snug">{q.stem}</div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
