# Adding questions

Written for whoever adds the next batch, including a later Claude session working from the
scanned slide decks. Adding questions means editing JSON in `content/` and pushing. No UI code
changes, ever. `npm run check:content` tells you if anything is wrong.

## Where things live

- `content/topics.json` is the ordered topic list: `{ "slug": "bsa", "name": "BSA" }`. Order here
  is the order on the home screen.
- `content/<slug>.json` is one array of questions per topic. Every topic has a file, even an empty
  one (`[]`). The file name must match the slug, and every question's `topic` must match its file.
- `source/` (gitignored) is where scanned PDFs and study guides go. **Never commit anything from
  it.** The slides belong to the school.

## The schema

```ts
type Question = {
  id: string;              // "<topic slug>-<3 digits>", e.g. "bsa-008"
  topic: string;           // topic slug, same as the file name
  type: "mc" | "tf";
  stem: string;            // the question
  options?: string[];      // mc only. 2 to 7 allowed; write 4 when authoring.
  shuffle?: boolean;       // default true. false when options refer to each other ("A & D")
  answer?: number | boolean; // mc: index into options. tf: true/false. Leave out only for needs-answer.
  why?: string;            // one or two plain sentences shown after answering
  source: {
    origin: "review" | "slides" | "authored";
    ref?: string;          // e.g. "BSA deck, slide 14"
  };
  optionsFrom: "exam" | "authored";
  status: "ready" | "needs-answer" | "needs-options" | "verify";
  flashcard?: { front: string; back: string };
  keyFact?: string;        // "Label: fact", e.g. "CTR: file within 15 calendar days"
};
```

## Ids

- Format `<slug>-NNN`, numbered from 001 in the order added. Next id = highest in the file + 1.
- **An id is permanent.** Progress on every phone is keyed to it. Never renumber, never reuse a
  deleted id, never change what question an id points to. Fixing a typo or adding a `why` or `ref`
  is fine. If a question is wrong enough to need a different answer, keep the id and fix it.
- Deleting a question is allowed; its progress is dropped silently.

## Fields, in plain terms

- **origin**: `review` means the instructors' review questions (the best predictor of the exam,
  so Study shows them first and Test weights them double). `slides` means written from a slide
  deck. `authored` means written by us from a study guide.
- **optionsFrom**: `exam` when the wrong answers are the real ones from the review sheet, word for
  word. `authored` when we wrote them.
- **shuffle**: options shuffle on every showing. "All of the above" and "None of the above" stay
  last automatically. Set `false` only when options reference each other by letter; they then show
  in stored order as a., b., c.
- **why**: plain, one or two sentences. Only what the source says. **Don't invent facts, numbers,
  or dates.** If you can't explain it from the source, leave it out.
- **flashcard**: the original question and answer wording, verbatim, when the quiz version was
  rewritten (a yes/no question turned into true/false, a list question turned into "Which of
  these…"). Cards mode uses it. Without it, Cards shows the stem and the correct option.
- **keyFact**: a short line for the Cram page. Write it as `Label: fact`. The part after the first
  `: ` is what hides when the reader taps it, so put the number, date, threshold, formula, or
  definition there. Add one for every question whose answer is one of those.
- **ref**: the slide reference once known, e.g. `"BSA deck, slide 14"`. Shown under the answer.

## Status

| status | meaning | where it shows |
|---|---|---|
| `ready` | complete and trusted | Study, Test, Cards |
| `verify` | complete, but the answer needs checking against the slides | Study and Test with an "unconfirmed" tag, Cards, To finish |
| `needs-answer` | no answer yet | To finish only |
| `needs-options` | has an answer but no mc options yet | Cards (if it has a flashcard back), To finish |

## The rule about answers

The instructors' answer is the key, even where general banking practice says something different.
Don't "correct" one. If an answer looks wrong or state-specific, keep it as given, set
`status: "verify"`, and say why in the commit message so it can be checked against the slides.

## Turning source material into questions

- True/false statement: `type: "tf"`.
- Yes/no question: rewrite as a true/false statement with the same meaning; keep the original in
  `flashcard`.
- Short factual answer (number, year, name, phrase): multiple choice with three wrong options of
  the same kind, close enough to make someone think. A $5,000 threshold gets $2,000, $10,000, and
  $25,000, not $1. `optionsFrom: "authored"`.
- "What are some examples of…": recast as "Which of these is…" or "Which of these is NOT…" using
  the listed items. Keep the original in `flashcard`.
- New questions in the style of the review questions: same wording style, same topics, different
  facts, taken from the slides. `origin: "slides"`, with a `ref`.
- Don't pad the bank from general banking knowledge. Every fact should trace to the slides, a
  study guide, or the review sheet.

## Checking and shipping

```bash
npm run check:content   # validates and prints counts per topic and status
npm run build           # runs the same check, then builds
npm test
```

Push to `main` (or merge a PR into it). Cloudflare rebuilds, and each phone shows "New questions
available, tap to update" within a couple of minutes of opening the app. The footer shows the
bank version (a hash of `content/`) and the count, so you can confirm the phone has the new bank.
