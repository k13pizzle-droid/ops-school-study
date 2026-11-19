// npm run check:content — validates every file in content/ and prints counts. Part of npm run build.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateBank } from '../src/lib/validate';

const dir = join(import.meta.dirname, '..', 'content');
const parse = (f: string) => {
  try {
    return JSON.parse(readFileSync(join(dir, f), 'utf8'));
  } catch (e) {
    console.error(`content/${f}: not valid JSON (${(e as Error).message})`);
    process.exit(1);
  }
};
const topics = parse('topics.json');
const files: Record<string, unknown> = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'topics.json')) files[f.slice(0, -5)] = parse(f);

const r = validateBank(topics, files);
console.log(`\nQuestion bank: ${r.total} questions\n`);
for (const t of topics as { slug: string; name: string }[]) console.log(`  ${String(r.byTopic[t.slug] ?? 0).padStart(4)}  ${t.name}`);
console.log('');
for (const [s, n] of Object.entries(r.byStatus).sort()) console.log(`  ${String(n).padStart(4)}  ${s}`);
if (r.errors.length) {
  console.error(`\n${r.errors.length} problem(s):`);
  for (const e of r.errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\nContent OK.\n');
