# Ops School Study

A private study app for a banking Operations School final exam. Quizlet-style, built for a phone
held in one hand. Static PWA (Vite, React, TypeScript, Tailwind, `vite-plugin-pwa`), deployed to
Cloudflare. No server and no accounts. Progress is saved in each phone's own browser, so anyone
using the same link has their own separate progress.

The repo is private and stays that way: the slide material belongs to the school.

## Modes

- **Study**: one question at a time, instant right/wrong, explanation panel. Misses come back a few
  questions later. Rounds of 10. Order: missed last time, never seen, then the rest, with the
  instructors' review questions first.
- **Cards**: flashcards. Tap to flip, swipe or tap Got it / Again. Filter All, Missed, Starred.
- **Test**: mock exam of 50, 100, or 150, spread across topics by size, review questions weighted
  double. No feedback until the end. Score by topic, "Study my misses", last five results kept.
- **Cram**: every key fact by topic on one page. Tap to hide or show the answer.
- **To finish** (footer): questions still needing an answer, options, or a check.

## Run it

```bash
nvm use            # Node 22
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: validator, shuffling, exam sampling, study order
npm run build      # content check + typecheck + build into dist/
npm run e2e        # after build: clicks through every mode at 390x844, light and dark (needs Playwright)
```

## Deploy

`wrangler.jsonc` serves `./dist` as static assets. In the Cloudflare dashboard: Workers & Pages,
Create, Import a repository, pick `ops-school-study`, build command `npm run build`, deploy
command `npx wrangler deploy`. Every push to `main` redeploys. The app checks for a new version
when it opens, when it comes back to the foreground, and every two minutes, then shows "New
questions available, tap to update".

## Add questions

Edit `content/<topic>.json` and push. The full guide is [docs/ADDING-QUESTIONS.md](docs/ADDING-QUESTIONS.md).
Scanned PDFs go in `source/`, which is gitignored and never committed.
