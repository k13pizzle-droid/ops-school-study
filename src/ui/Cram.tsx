import { useState } from 'react';
import { questions, topics } from '../lib/bank';
import { TopBar } from './common';

/** Every keyFact, by topic. "Label: fact" — tapping hides or shows the part after the colon. */
export function Cram({ onBack }: { onBack: () => void }) {
  const [hideAll, setHideAll] = useState(false);
  const [flip, setFlip] = useState<Record<string, boolean>>({});
  const groups = topics
    .map((t) => ({ t, facts: questions.filter((q) => q.topic === t.slug && q.keyFact) }))
    .filter((g) => g.facts.length);

  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <TopBar
        title="Cram"
        onBack={onBack}
        right={
          <button onClick={() => (setHideAll((h) => !h), setFlip({}))} className="min-h-11 px-2 text-[14px] font-semibold text-[var(--muted)]">
            {hideAll ? 'Show all' : 'Hide all'}
          </button>
        }
      />
      <div className="safe-bottom px-4 pt-2">
        <p className="mb-2 text-[13px] text-[var(--muted)]">Tap a fact to hide or show the answer.</p>
        {groups.map(({ t, facts }) => (
          <section key={t.slug} className="mb-5">
            <h2 className="display mb-2 mt-4 text-[20px]">{t.name}</h2>
            <ul className="flex flex-col gap-1.5">
              {facts.map((q) => {
                const fact = q.keyFact!;
                const cut = fact.indexOf(': ');
                const label = cut > 0 ? fact.slice(0, cut + 1) : '';
                const rest = cut > 0 ? fact.slice(cut + 2) : fact;
                const hidden = hideAll !== !!flip[q.id];
                return (
                  <li key={q.id}>
                    <button
                      onClick={() => setFlip((f) => ({ ...f, [q.id]: !f[q.id] }))}
                      className="read w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-left text-[18px] leading-snug"
                    >
                      {label && <span className="font-semibold">{label} </span>}
                      {hidden ? <span className="rounded bg-[var(--soft)] px-2 text-[var(--muted)]">tap to show</span> : <span>{rest}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
