import type { Shown } from '../lib/options';
import { letter } from './common';

/** The answer buttons. `reveal` colors the right answer green and a wrong pick red. */
export function OptionList({ shown, chosen, reveal, onPick }: { shown: Shown; chosen: number | null; reveal: boolean; onPick: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {shown.options.map((o, i) => {
        const isRight = reveal && i === shown.answer;
        const isWrong = reveal && i === chosen && i !== shown.answer;
        const picked = !reveal && i === chosen;
        return (
          <button
            key={i}
            disabled={reveal}
            onClick={() => onPick(i)}
            className={`read flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-[19px] leading-snug ${
              isRight
                ? 'border-[var(--right)] bg-[var(--right-bg)] text-[var(--right)]'
                : isWrong
                  ? 'border-[var(--wrong)] bg-[var(--wrong-bg)] text-[var(--wrong)]'
                  : picked
                    ? 'border-[var(--accent)] bg-[var(--soft)]'
                    : 'border-[var(--line)] bg-[var(--surface)]'
            }`}
          >
            {shown.lettered && <span className="font-semibold">{letter(i)}.</span>}
            <span className="flex-1">{o}</span>
            {isRight && <span aria-label="correct">✓</span>}
            {isWrong && <span aria-label="wrong">✗</span>}
          </button>
        );
      })}
    </div>
  );
}
