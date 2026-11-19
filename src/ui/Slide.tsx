import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Question, SlideImage } from '../lib/types';

/** Slide screenshots for one spot on a question ('stem' or 'answer'). */
export function Slides({ q, at }: { q: Question; at: SlideImage['at'] }) {
  const list = (q.images ?? []).filter((im) => im.at === at);
  if (!list.length) return null;
  return (
    <div className="my-3 flex flex-col gap-2">
      {list.map((im) => (
        <Slide key={im.src} im={im} />
      ))}
    </div>
  );
}

/**
 * One slide. The highlight is drawn over the image: an amber box, with everything outside it
 * dimmed. Tap to see it full screen. Taps don't reach the "tap anywhere to continue" layer.
 */
function Slide({ im }: { im: SlideImage }) {
  const [big, setBig] = useState(false);
  const pic = (cls: string, imgCls = 'block w-full', imgStyle?: CSSProperties) => (
    <div className={`relative overflow-hidden rounded-lg border border-[var(--line)] bg-white ${cls}`}>
      <img src={`/${im.src}`} alt={im.alt} className={imgCls} style={imgStyle} loading="lazy" />
      {im.mark && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-md border-[3px] border-[#f59e0b]"
          style={{
            left: `${im.mark.x}%`,
            top: `${im.mark.y}%`,
            width: `${im.mark.w}%`,
            height: `${im.mark.h}%`,
            boxShadow: '0 0 0 9999px rgba(9, 12, 93, 0.35)',
          }}
        />
      )}
    </div>
  );
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setBig(true);
        }}
        className="block w-full text-left"
        aria-label={`Slide: ${im.alt}. Tap to enlarge.`}
      >
        {pic('')}
      </button>
      {big && createPortal(
        <div
          role="dialog"
          aria-label={im.alt}
          onClick={(e) => {
            e.stopPropagation();
            setBig(false);
          }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-3"
        >
          {pic('shrink-0', 'block h-auto w-auto', { maxWidth: 'calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right))', maxHeight: 'calc(100dvh - 64px)' })}
          <div className="mt-3 text-[14px] text-white/80">Tap to close</div>
        </div>,
        document.body,
      )}
    </>
  );
}
