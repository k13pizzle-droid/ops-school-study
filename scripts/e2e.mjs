// Clicks through Study, Cards, Test, and Cram on the built app at iPhone size, light and dark.
// Run: npm run build && npm run e2e. Screenshots land in e2e-output/ (gitignored).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
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
} finally {
  await browser.close();
  stop();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('e2e OK: Study, Cards, Test, Play, Cram, To finish in light and dark at 390x844');
