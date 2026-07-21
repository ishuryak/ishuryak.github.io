/* Adversarial test runner for the explorable model suite.
   Run from v2/: `node tests/run.mjs` (or `npm test`). Exits non-zero on any
   failure so it can gate a commit. Every *.test.mjs file is discovered and
   imported automatically, so adding a test module cannot leave it unexecuted. */
import { readdir } from 'node:fs/promises';
import { runAll } from './harness.mjs';

const files = (await readdir(new URL('.', import.meta.url)))
  .filter((file) => file.endsWith('.test.mjs'))
  .sort();
for (const file of files) await import(`./${file}`);

await runAll();
