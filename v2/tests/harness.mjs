/* Tiny dependency-free test harness for the explorable model suite.
   Tests register on import; run.mjs imports every *.test.mjs then calls runAll().
   No framework, no build step, matching the rest of the site. */

const queue = [];

/** Register a test. `name` starts with a "[Area]" tag for grouped reporting. */
export function test(name, fn) { queue.push({ name, fn }); }

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

export function finite(x, msg) {
  if (!Number.isFinite(x)) throw new Error(`${msg || 'value'} is not finite: ${x}`);
}

/** |a - b| <= tol, and both finite. */
export function approx(a, b, tol, msg) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tol) {
    throw new Error(`${msg || 'approx'}: got ${a}, expected ${b} (|Δ| ${Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b).toExponential(3) : 'NaN'} > tol ${tol})`);
  }
}

/** Strictly increasing / decreasing along an array of samples. */
export function monotone(ys, dir, msg) {
  for (let i = 1; i < ys.length; i++) {
    finite(ys[i], `${msg} sample ${i}`);
    if (dir === 'inc' && !(ys[i] >= ys[i - 1] - 1e-12))
      throw new Error(`${msg}: not non-decreasing at i=${i} (${ys[i - 1]} -> ${ys[i]})`);
    if (dir === 'dec' && !(ys[i] <= ys[i - 1] + 1e-12))
      throw new Error(`${msg}: not non-increasing at i=${i} (${ys[i - 1]} -> ${ys[i]})`);
  }
}

export const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

export async function runAll() {
  const groups = new Map();
  let pass = 0; const fails = [];
  for (const { name, fn } of queue) {
    const g = (name.match(/^\[([^\]]+)\]/) || [, 'misc'])[1];
    if (!groups.has(g)) groups.set(g, { pass: 0, fail: 0 });
    try { await fn(); pass++; groups.get(g).pass++; }
    catch (e) { fails.push(`${name}\n      ${e.message}`); groups.get(g).fail++; }
  }
  const total = queue.length;
  console.log('Adversarial explorable test suite');
  console.log('='.repeat(52));
  for (const [g, r] of groups)
    console.log(`  ${r.fail ? '✗' : '✓'} ${g.padEnd(22)} ${r.pass}/${r.pass + r.fail}`);
  console.log('='.repeat(52));
  if (fails.length) {
    console.log(`\n${fails.length} FAILURE(S):`);
    fails.forEach((f) => console.log('  ✗ ' + f));
    console.log(`\n${pass}/${total} passed.`);
    process.exit(1);
  }
  console.log(`\nALL GREEN - ${pass}/${total} passed.`);
}
