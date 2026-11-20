// Clicks through Study, Cards, Test, and Cram on the built app at iPhone size, light and dark.
// Run: npm run build && npm run e2e. Screenshots land in e2e-output/ (gitignored).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is preinstalled globally on the cloud box and on the Mac; it isn't a dependency.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const out = 'e2e-output';
mkdirSync(out, { recursive: true });
// Own process group, so finishing kills vite itself and not just npx (a leftover server would
// keep the port and quietly serve some other build to the next run).
const server = spawn('npx', ['vite', 'preview', '--port', '4319', '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {
    /* already gone */
  }
};
await new Promise((r) => setTimeout(r, 2500));
const url = 'http://localhost:4319/';
// Make sure the server answering is serving this checkout's dist/.
const want = readFileSync('dist/index.html', 'utf8').match(/\/assets\/index-[^"]+\.js/)?.[0];
const got = (await (await fetch(url)).text()).match(/\/assets\/index-[^"]+\.js/)?.[0];
if (!want || want !== got) {
  stop();
  console.error(`Port 4319 is serving a different build (${got ?? 'nothing'}, expected ${want}). Stop the other server, run npm run build, and retry.`);
  process.exit(1);
}
const problems = [];

const browser = await chromium.launch();
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme, hasTouch: true });
    page.on('pageerror', (e) => problems.push(`${scheme}: page error ${e.message}`));
    const shot = (n) => page.screenshot({ path: `${out}/${scheme}-${n}.png`, fullPage: false });
    const overflow = async (where) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      if (w > 390) problems.push(`${scheme} ${where}: page is ${w}px wide`);
    };
    await page.goto(url);
    await page.getByRole('button', { name: 'Study', exact: true }).waitFor();
    await shot('home'); await overflow('home');

    // Study: answer 10 questions (first option each time), then the round summary.
    await page.getByRole('button', { name: 'Study', exact: true }).click();
    for (let i = 0; i < 10; i++) {
      await page.locator('h2').waitFor();
      if (i === 0) await shot('study-q');
      await page.locator('button.read').first().click();
      if (i === 0) { await page.waitForTimeout(400); await shot('study-panel'); await overflow('study'); }
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    await page.getByText(/of 10\./).waitFor();
    await shot('study-round');
    await page.getByRole('button', { name: 'Done for now' }).click();
    await shot('home-after');

    // Cards: flip, swipe right, button left.
    await page.getByRole('button', { name: 'cards' }).click();
    await page.getByText('Tap to flip').click();
    await shot('cards-back'); await overflow('cards');
    const box = await page.locator('[role=button][tabindex="0"]').boundingBox();
    await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 100, { steps: 8 }); await page.mouse.up();
    await page.getByRole('button', { name: '← Again' }).click();
    await page.getByRole('button', { name: 'starred' }).click();
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Test: 50 → all ready questions, answer a few, jump with the grid, finish.
    await page.getByRole('button', { name: 'test' }).click();
    await page.getByRole('button', { name: '50', exact: true }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start practice test' }).click();
    await shot('test-q'); await overflow('test');
    await page.locator('button.read').nth(1).click();
    // Leaving mid-test keeps it: Test offers Resume.
    await page.getByRole('button', { name: 'Back to home' }).click();
    await page.getByRole('button', { name: 'test' }).click();
    await page.getByRole('button', { name: /Resume test \(1 of/ }).click();
    await page.getByRole('button', { name: 'Next ›' }).click();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await shot('test-grid');
    const n = await page.locator('.grid-cols-6 button').count();
    await page.locator('.grid-cols-6 button').nth(n - 1).click();
    // Unanswered questions: the first tap arms, the second finishes.
    await page.getByRole('button', { name: 'Finish' }).click();
    // A second tap within half a second is ignored (double-tap guard), so pause like a person.
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /blank\. Tap again/ }).click();
    await page.getByText('By topic, weakest first').waitFor();
    await shot('test-results'); await overflow('results');
    await page.getByRole('button', { name: /Study my misses/ }).click();
    await page.locator('h2').waitFor();
    await page.getByRole('button', { name: 'Back to home' }).click();
    // Exam rehearsal: starts at once with a 60:00 countdown.
    await page.getByRole('button', { name: 'test' }).click();
    await page.getByRole('button', { name: /Exam rehearsal/ }).click();
    await page.getByText(/^(60:00|59:5\d)$/).waitFor();
    await page.getByRole('button', { name: 'Back to home' }).click();
    await page.getByRole('button', { name: 'test' }).click();
    await page.getByRole('button', { name: /Resume test/ }).click();
    await page.locator('h2').waitFor();
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Play: a full lesson (answer until it ends either way), then a lightning round with the clock sped up.
    await page.getByRole('button', { name: 'play' }).click();
    await shot('play-menu'); await overflow('play');
    await page.getByRole('button', { name: /^Lesson/ }).click();
    for (let i = 0; i < 40; i++) {
      if (await page.getByRole('button', { name: 'Play again' }).isVisible()) break;
      await page.locator('button.read').first().click();
      if (i === 0) { await page.waitForTimeout(400); await shot('lesson-panel'); await overflow('lesson'); }
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    await shot('lesson-end');
    await page.getByRole('button', { name: 'Done' }).click();
    await page.clock.install();
    await page.getByRole('button', { name: /^Lightning/ }).click();
    await page.locator('button.read').first().click();
    await page.clock.runFor(61_000);
    await page.getByText(/right in 60 seconds/).waitFor();
    await shot('lightning-end');
    await page.getByRole('button', { name: 'Done' }).click();
    await shot('play-menu-after');
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Cram and To finish.
    await page.getByRole('button', { name: 'cram' }).click();
    await page.getByRole('button', { name: /CTR: file within/ }).click();
    await shot('cram'); await overflow('cram');
    await page.getByRole('button', { name: 'Back to home' }).click();
    await page.getByRole('button', { name: /To finish/ }).click();
    await shot('finish');
    await page.close();
  }

  // Relaunch: closing the app (a new page in the same browser profile) reopens at the same spot.
  {
    const fail = (m) => problems.push(`relaunch: ${m}`);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await ctx.addInitScript(() => localStorage.setItem('ops-school-install-hint-dismissed', '1'));
    let page = await ctx.newPage();
    page.on('pageerror', (e) => fail(`page error ${e.message}`));
    const reopen = async () => {
      await page.close();
      page = await ctx.newPage();
      page.on('pageerror', (e) => fail(`page error ${e.message}`));
      await page.goto(url);
      await page.waitForTimeout(800);
    };
    await page.goto(url);
    // Study: answer 3, close mid-session (the 3rd answer still showing its panel).
    await page.getByRole('button', { name: 'Study', exact: true }).click();
    const stems = [];
    for (let i = 0; i < 3; i++) {
      await page.locator('h2').waitFor();
      stems.push(await page.locator('h2').innerText());
      await page.locator('button.read').first().click();
      if (i < 2) await page.getByRole('button', { name: 'Continue' }).click();
    }
    await reopen();
    if (!(await page.locator('.topbar').innerText()).includes('Study')) fail('did not reopen in Study');
    const meta = await page.getByText(/^\d+ \/ 10/).first().innerText().catch(() => '');
    if (!meta.startsWith('4 / 10')) fail(`study reopened at "${meta}", expected question 4 of the round`);
    // The back swipe still returns Home.
    await page.goBack();
    await page.getByRole('button', { name: 'Study', exact: true }).waitFor({ timeout: 5000 }).catch(() => fail('back swipe after relaunch did not return Home'));
    // Cards: 4 through the deck, then relaunch.
    await page.getByRole('button', { name: 'cards' }).click();
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Got it →' }).click();
    await reopen();
    const gotText = await page.getByText(/\d+ of \d+ got/).innerText().catch(() => '');
    if (!gotText.startsWith('4 of')) fail(`cards reopened at "${gotText}", expected 4 got`);
    await page.getByRole('button', { name: 'Back to home' }).click();
    // Play lesson: 2 answers, relaunch mid-lesson.
    await page.getByRole('button', { name: 'play' }).click();
    await page.getByRole('button', { name: /^Lesson/ }).click();
    let hearts0 = '';
    for (let i = 0; i < 2; i++) { await page.locator('h2').waitFor(); await page.locator('button.read').first().click(); await page.getByRole('button', { name: 'Continue' }).click(); }
    hearts0 = await page.locator('[aria-label$="hearts"]').getAttribute('aria-label');
    const bar0 = await page.locator('[role=progressbar]').getAttribute('aria-valuenow');
    await reopen();
    if (!(await page.locator('[role=progressbar]').count())) fail('did not reopen in the lesson');
    else {
      const hearts1 = await page.locator('[aria-label$="hearts"]').getAttribute('aria-label');
      const bar1 = await page.locator('[role=progressbar]').getAttribute('aria-valuenow');
      if (hearts1 !== hearts0 || bar1 !== bar0) fail(`lesson reopened with ${hearts1}/${bar1}, expected ${hearts0}/${bar0}`);
    }
    // Leaving the lesson, then relaunching, lands on the Play menu (no stale lesson).
    await page.getByRole('button', { name: 'Quit lesson' }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Quit lesson' }).click();
    await reopen();
    if (!(await page.getByRole('button', { name: /^Lesson/ }).count())) fail('after quitting a lesson, relaunch did not land on the Play menu');
    // Going Home and relaunching lands on Home.
    await page.getByRole('button', { name: 'Back to home' }).click();
    await reopen();
    if (!(await page.getByRole('button', { name: 'Study', exact: true }).count())) fail('relaunch from Home did not land on Home');
    await ctx.close();
    console.log('relaunch check: study, cards, lesson resume; home and play menu land correctly');
  }

  // Exam review only: with the switch on, every feature must show review questions and nothing else.
  {
    const dir = new URL('../content/', import.meta.url);
    const all = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'topics.json').flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
    const review = all.filter((q) => q.source.origin === 'review' && (q.status === 'ready' || q.status === 'verify'));
    const reviewFacts = all.filter((q) => q.source.origin === 'review' && q.keyFact).length;
    const slideIds = all.filter((q) => q.source.origin !== 'review' && q.status === 'ready').map((q) => q.id);
    const fail = (m) => problems.push(`review-only: ${m}`);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    // A test saved before the switch was turned on: 3 slide questions and 2 review questions.
    const savedIds = [...slideIds.slice(0, 3), ...review.slice(0, 2).map((q) => q.id)];
    const sh = savedIds.map((id) => { const q = all.find((x) => x.id === id); return q.type === 'tf' ? { options: ['True', 'False'], answer: q.answer ? 0 : 1, lettered: false } : { options: q.options, answer: q.answer, lettered: false }; });
    await ctx.addInitScript(([ids, shown]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('ops-school-install-hint-dismissed', '1');
      localStorage.setItem('ops-school-test-run', JSON.stringify({ ids, shown, picks: ids.map(() => null), idx: 0, started: Date.now(), timer: false }));
    }, [savedIds, sh]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fail(`page error ${e.message}`));
    await page.goto(url);
    await page.getByRole('switch', { name: /Exam review only/ }).click();
    await page.getByRole('button', { name: 'Study', exact: true }).waitFor();
    const badge = () => page.locator('span', { hasText: /^!\s*Exam review$/ }).count();
    const mustBadge = async (where) => { if (!(await badge())) fail(`${where}: "${(await page.locator('h2, .read').first().innerText()).slice(0, 60)}" has no review badge`); };

    // Home: ring and topic counts.
    if (!(await page.getByText(`of ${review.length} mastered`).count())) fail('home ring total is not the review count');
    const counts = await page.locator('ul li span.tabular-nums').allInnerTexts();
    const sum = counts.reduce((s, t) => s + (Number(t.split('/')[1]) || 0), 0);
    if (sum !== review.length) fail(`home topic counts add to ${sum}, expected ${review.length}`);

    // Study: 20 questions, two rounds.
    await page.getByRole('button', { name: 'Study', exact: true }).click();
    for (let i = 0; i < 20; i++) {
      if (await page.getByRole('button', { name: 'Keep going' }).count()) await page.getByRole('button', { name: 'Keep going' }).click();
      await page.locator('h2').waitFor();
      await mustBadge('study');
      await page.locator('button.read').first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Topic study from the list.
    await page.getByRole('button', { name: 'BSA' }).first().click();
    for (let i = 0; i < 5; i++) { await page.locator('h2').waitFor(); await mustBadge('topic study'); await page.locator('button.read').first().click(); await page.getByRole('button', { name: 'Continue' }).click(); }
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Cards: 15 cards, and the deck size.
    await page.getByRole('button', { name: 'cards' }).click();
    const left = await page.getByText(/\d+ left/).innerText();
    if (!left.includes(`${review.length} left`)) fail(`cards deck is "${left}", expected ${review.length}`);
    for (let i = 0; i < 15; i++) { await mustBadge('cards'); await page.getByRole('button', { name: 'Got it →' }).click(); }
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Test: the saved test resumes without its slide questions.
    await page.getByRole('button', { name: 'test' }).click();
    const resume = await page.getByRole('button', { name: /Resume test/ }).innerText();
    if (!resume.includes('of 2 answered')) fail(`resume shows "${resume}", expected 2 questions`);
    // Rehearsal: every question, checked through the grid.
    // Arming practice then tapping rehearsal must not start a practice test (each has its own confirm).
    await page.getByRole('button', { name: 'Start a new practice test' }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /Exam rehearsal/ }).click();
    if (await page.locator('.test-grid, h2').count()) fail('arming practice then tapping rehearsal started a test');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /Tap again to discard/ }).first().click();
    const title = await page.locator('.topbar').innerText();
    if (!title.includes(`of ${review.length}`)) fail(`rehearsal is "${title.replace(/\s+/g, ' ')}", expected ${review.length}`);
    for (let i = 0; i < review.length; i++) {
      await page.locator('h2').waitFor();
      await mustBadge(`rehearsal q${i + 1}`);
      if (i < review.length - 1) await page.getByRole('button', { name: 'Next ›' }).click();
    }
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Play: a full lesson and part of a lightning round.
    await page.getByRole('button', { name: 'play' }).click();
    await page.getByRole('button', { name: /^Lesson/ }).click();
    for (let i = 0; i < 40; i++) {
      if (await page.getByRole('button', { name: 'Play again' }).isVisible()) break;
      await page.locator('h2').waitFor();
      await mustBadge('lesson');
      await page.locator('button.read').first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: /^Lightning/ }).click();
    for (let i = 0; i < 8; i++) { await page.locator('h2').waitFor(); await mustBadge('lightning'); await page.locator('button.read').first().click(); await page.waitForTimeout(1000); }
    await page.getByRole('button', { name: 'Quit' }).click();
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Cram: exactly the review key facts.
    await page.getByRole('button', { name: 'cram' }).click();
    const facts = await page.locator('section li button').count();
    if (facts !== reviewFacts) fail(`cram shows ${facts} facts, expected ${reviewFacts}`);
    await page.getByRole('button', { name: 'Back to home' }).click();

    // Switching off restores the full bank.
    await page.getByRole('switch', { name: /Exam review only/ }).click();
    await page.getByRole('button', { name: 'Study', exact: true }).waitFor();
    if (await page.getByText(`of ${review.length} mastered`).count()) fail('switching off did not restore the full bank');
    await ctx.close();
    console.log(`review-only check: ${review.length} review questions, ${reviewFacts} key facts`);
  }
} finally {
  await browser.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('e2e OK: Study, Cards, Test, Play, Cram, To finish in light and dark at 390x844');
