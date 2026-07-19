/* Adversarial test runner for the explorable model suite.
   Run from v2/: `node tests/run.mjs` (or `npm test`). Exits non-zero on any
   failure so it can gate a commit. Each *.test.mjs registers its tests on
   import; importing them here populates the shared queue. */
import './bed.test.mjs';
import './hilet.test.mjs';
import './cate.test.mjs';
import './lq.test.mjs';
import './cancer.test.mjs';
import './resist.test.mjs';
import './pk.test.mjs';
import './ct.test.mjs';
import { runAll } from './harness.mjs';

await runAll();
