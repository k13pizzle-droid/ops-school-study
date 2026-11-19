// npm run check:content — validates every file in content/ and prints counts. Part of npm run build.
//
// It also compares against origin/main when git is available:
// - fails if an id that is on origin/main is gone (progress is keyed to ids; pass --allow-delete
//   for a deliberate deletion),
// - prints every new id with the answer it is keyed to, so the author reads the batch's keys once
//   before pushing (the usual mistake is a 1-based answer).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateBank } from '../src/lib/validate';
import { answerText, type Question } from '../src/lib/types';

const root = join(import.meta.dirname, '..');
const dir = join(root, 'content');
const parse = (f: string) => {
  try {
    return JSON.parse(readFileSync(join(dir, f), 'utf8'));
  } catch (e) {
    console.error(`content/${f}: not valid JSON (${(e as Error).message})`);
    process.exit(1);
  }
};
const topics = parse('topics.json');
const names = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const files: Record<string, unknown> = {};
for (const f of names.filter((f) => f !== 'topics.json')) files[f.slice(0, -5)] = parse(f);

const r = validateBank(topics, files);
const hash = createHash('sha1');
for (const f of names) hash.update(f).update(readFileSync(join(dir, f)));

console.log(`\nQuestion bank: ${r.total} questions · bank ${hash.digest('hex').slice(0, 7)} (the app footer should show this after deploy)\n`);
for (const t of topics as { slug: string; name: string }[]) console.log(`  ${String(r.byTopic[t.slug] ?? 0).padStart(4)}  ${t.name}`);
console.log('');
for (const [s, n] of Object.entries(r.byStatus).sort()) console.log(`  ${String(n).padStart(4)}  ${s}`);

// Compare with what's deployed.
const all = Object.values(files).flat() as Question[];
const ids = new Set(all.map((q) => q.id));
let before: Set<string> | null = null;
// Skipped on Cloudflare's build servers (CI is set there): the check is for the author, before pushing.
if (!process.env.CI && !process.env.WORKERS_CI) try {
  execFileSync('git', ['rev-parse', '--verify', '-q', 'origin/main'], { cwd: root, stdio: 'ignore' });
  before = new Set<string>();
  for (const f of names.filter((f) => f !== 'topics.json')) {
    try {
      const old = JSON.parse(execFileSync('git', ['show', `origin/main:content/${f}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as Question[];
      for (const q of old) before.add(q.id);
    } catch {
      /* new file */
    }
  }
  const tracked = execFileSync('git', ['ls-tree', '--name-only', 'origin/main', 'content/'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of tracked.map((p) => p.replace('content/', '')).filter((f) => f !== 'topics.json' && !names.includes(f))) {
    for (const q of JSON.parse(execFileSync('git', ['show', `origin/main:content/${f}`], { cwd: root, encoding: 'utf8' })) as Question[]) before.add(q.id);
  }
} catch {
  /* no git or no origin/main (e.g. a Cloudflare build checkout): skip the comparison */
}
if (before) {
  const gone = [...before].filter((id) => !ids.has(id));
  if (gone.length && !process.argv.includes('--allow-delete'))
    r.errors.push(`ids on origin/main are missing here: ${gone.join(', ')}. Progress is keyed to ids, so don't renumber or drop them. If the deletion is deliberate, run with --allow-delete.`);
  const added = all.filter((q) => !before!.has(q.id));
  if (added.length) {
    console.log(`\n${added.length} new since origin/main. Read each keyed answer:\n`);
    for (const q of added) console.log(`  ${q.id} [${q.status}] ${q.stem}\n      → ${answerText(q) ?? '(no answer)'}`);
  }
}

if (r.errors.length) {
  console.error(`\n${r.errors.length} problem(s):`);
  for (const e of r.errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\nContent OK.\n');
