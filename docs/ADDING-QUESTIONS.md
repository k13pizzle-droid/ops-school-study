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
  answer?: number | boolean; // mc: 0-BASED index into options. tf: true/false. Leave out only for needs-answer.
  why?: string;            // one or two plain sentences shown after answering
  source: {
    origin: "review" | "slides" | "authored";
    ref?: string;          // e.g. "BSA deck, slide 14"
  };
  optionsFrom: "exam" | "authored";
  status: "ready" | "needs-answer" | "needs-options" | "verify";
  flashcard?: { front: string; back: string };
  keyFact?: string;        // "Label: fact", e.g. "CTR: file within 15 calendar days"
  images?: SlideImage[];   // up to 2 slide screenshots; see "Slide images" below
};
```

## `answer` is 0-based

The first option is `0`. This is the easiest mistake to make and the validator can't catch it
unless the number runs off the end. If the correct option is the third one:

```json
"options": ["$2,000", "$10,000", "$5,000", "$25,000"],
"answer": 2
```

`npm run check:content` prints every new question with the text of the answer it's keyed to.
Read that list before you push.

## Ids

- Format `<slug>-NNN`, numbered from 001 in the order added. Next id = highest in the file + 1.
- **An id is permanent.** Progress on every phone is keyed to it. Never renumber, never reuse a
  deleted id, never change what question an id points to. Fixing a typo or adding a `why` or `ref`
  is fine. If a question is wrong enough to need a different answer, keep the id and fix it.
- Deleting a question is allowed but rare. `check:content` fails if an id on `origin/main` is
  missing; run `npm run check:content -- --allow-delete` (or `ALLOW_DELETE=1 npm run build`) to confirm a
  deliberate deletion. Cloudflare's build skips this check.
- Before writing, `git pull` and find the highest id in the file. Append to the file; never
  regenerate a whole file. Two sessions must not hand out the same ids.

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
- **ref**: the slide reference, always in the form `"<Deck name>, slide <n>"`. Required for
  `origin: "slides"`. Shown under the answer.
- **optionsFrom: "exam"** only goes with `origin: "review"`.
- Don't put letters in option text ("a. Deposits"); the app adds them. When options refer to each
  other ("A & D"), set `"shuffle": false` and add a `flashcard` whose back spells the answer out.
  The validator enforces this.
- Every true/false question whose answer is False needs a `why` or a `flashcard` that says what
  is actually true. The validator enforces this.
- `keyFact` must contain `": "`. The validator enforces this.
- `needs-options` questions keep their answer in `flashcard.back`, not in `answer`, until options
  are written.
- One fact, one question. Search the topic file for the same fact before adding. Duplicate stems
  in a file fail the check.
- No state name in anything shown on screen (`stem`, `options`, `why`, `keyFact`, `flashcard`,
  `ref`) unless the slide's own quoted wording needs it. A state-specific concern goes in the
  commit message with `status: "verify"`.
- Unknown fields fail the check, so a typo like `keyfact` or `explanation` is caught.

## Slide images

A question can show up to two slide screenshots, with the question (`"at": "stem"`) or in the
answer panel and test review (`"at": "answer"`). Use one where the slide itself teaches it
better than words: a diagram, a table, a form, a flowchart. A few per topic, not every question.

```json
"images": [
  {
    "src": "slides/bsa-14.webp",
    "alt": "BSA deck slide 14: table of CTR and SAR deadlines",
    "at": "answer",
    "mark": { "x": 5, "y": 40, "w": 60, "h": 12 }
  }
]
```

- Files go in `public/slides/`, named `<topic>-<slide number>.webp` (add `-a`, `-b` for crops of
  the same slide). Export about 1200px wide, webp, under 250 KB. `check:content` fails if the
  file is missing or too big.
- `mark` draws a highlight box over the part that answers the question, with everything else
  dimmed. Values are percent of the image: `x`/`y` from the top-left corner, `w`/`h` the size.
  Don't edit highlights into the image itself. Check the box lands where you meant: build, open
  the question, and look. It's easy to be a line off.
- `alt` says what the slide shows, so it still makes sense if the image doesn't load.
- A stem image must not give the answer away. Use a crop that shows the context, or put the
  image at `"answer"`.
- Slide images ship on the public site like the question text. Anyone with the link can see
  them.
- Cards mode doesn't show images.

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
- Mix true and false: roughly half of each across a batch.

## Writing challenging questions that stay fair

The bank should include some hard questions alongside the ones written in the style of the review
sheet. Still only true/false and multiple choice, four options when authoring. Keep hard ones to
about a quarter of each topic so the review questions still dominate.

Every question, easy or hard, rests on one sentence, number, or list on one slide, and `ref`
names that slide. If you can't point to the slide, don't write the question.

Hard means it needs the exact fact, not a trick. Good sources of difficulty:

- Near-miss numbers taken from the same deck: the CTR's 15 days against the SAR's deadline,
  $5,000 against $10,000.
- Two terms the deck defines side by side, such as revocable against irrevocable, or structuring
  against layering. Ask which one fits a description.
- A short scenario that applies one rule from one slide: "A customer makes three $4,000 cash
  deposits in one day to stay under the limit. This is…"
- "Which of these is NOT…" built from a list on a slide, with the odd one out taken from a
  different list in the same deck.
- True/false that changes exactly one element of a slide's statement: the number, the party, or
  "always" in place of "unless the document says otherwise".

Keeping it fair:

- Exactly one option is defensible from the slides. If general banking practice would make a
  distractor arguable, replace the distractor.
- Distractors are the same kind of thing and about the same length as the answer. The right
  answer is never the longest by a wide margin.
- No double negatives. No "always" or "never" unless the slide uses the word. Nothing that needs
  two slides combined, and no arithmetic the deck didn't show.
- "All of the above" is right no more than about half the times it appears. Avoid "None of the
  above".
- `why` quotes or closely paraphrases the slide. No outside facts, even correct ones.
- Where the slide and the review sheet disagree, the review sheet wins. Mark the question
  `verify` and say why in the commit.
- Label them `origin: "slides"`, `optionsFrom: "authored"`, with a `ref`.

## Checking and shipping

```bash
npm run check:content   # validates and prints counts per topic and status
npm run build           # runs the same check, then builds
npm test
```

Push one topic per batch, to `main` or through a PR merged into it. Cloudflare rebuilds, and each
phone shows "New questions available, tap to update" on Home within a couple of minutes of opening
the app. `check:content` prints the bank hash; confirm the Cloudflare build passed and that the
phone's footer shows that hash and the new count. A failed build is silent on the phone. The
footer also has "Check for updates" to check on demand.
