/* Adversarial tests - Explorable 3: CAST trajectory simulations.
   These tests validate the bundled artifact and the meanings exposed by the UI.
   They do not treat one simulated dataset as evidence of frequentist coverage. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test, assert, approx, finite, monotone } from './harness.mjs';

const dataUrl = new URL('../assets/data/cast_scenarios.json', import.meta.url);
const raw = await readFile(dataUrl, 'utf8');
const data = JSON.parse(raw);
const entries = Object.entries(data.scenarios);
const METHODS = ['naive', 'cox', 'rsf', 'tlearner', 'csf', 'cast'];

const estimate = (s, method) => ({
  naive: s.naive,
  cox: s.cox.ate,
  rsf: s.rsf,
  tlearner: s.tlearner,
  csf: s.csf.ate,
  cast: s.cast.fit,
})[method];

const everyFinite = (xs, label) => xs.forEach((x, i) => finite(x, `${label}[${i}]`));
const rmse = (ys, truth) => Math.sqrt(ys.reduce((sum, y, i) => sum + (y - truth[i]) ** 2, 0) / ys.length);

test('[CAST] bundled snapshot has the pinned content hash', () => {
  const hash = createHash('sha256').update(raw).digest('hex');
  assert(hash === '21ad1acfcaa9dbc46c62924602d882c6a7e94fb9a66dc51373796817fffb18c6',
    `CAST JSON hash changed: ${hash}; regenerate provenance and review labels`);
});

test('[CAST] full 2 x 4 x 3 scenario grid is present and metadata agrees with each key', () => {
  const expected = [];
  for (const shape of data.shapes) for (const conf of data.conf_grid) for (const unmeas of data.unmeas_grid)
    expected.push(`${shape}_conf${conf.toFixed(2)}_unmeas${unmeas.toFixed(2)}`);
  assert(expected.length === 24, `expected grid itself has ${expected.length} cells`);
  assert(entries.length === expected.length, `got ${entries.length} scenarios, expected ${expected.length}`);
  for (const key of expected) {
    const s = data.scenarios[key];
    assert(s, `missing scenario ${key}`);
    assert(key.startsWith(`${s.meta.shape}_conf${s.meta.conf_strength.toFixed(2)}`), `${key}: shape/conf metadata mismatch`);
    assert(key.endsWith(`unmeas${s.meta.unmeas_strength.toFixed(2)}`), `${key}: latent-confounding metadata mismatch`);
  }
});

test('[CAST] every trajectory is finite and aligned to the five horizons', () => {
  const nH = data.horizons.length;
  assert(nH === 5, `expected 5 horizons, got ${nH}`);
  monotone(data.horizons, 'inc', 'follow-up horizons');
  for (const [key, s] of entries) {
    for (const method of METHODS) {
      const ys = estimate(s, method);
      assert(Array.isArray(ys) && ys.length === nH, `${key}: ${method} trajectory length`);
      everyFinite(ys, `${key}.${method}`);
    }
    assert(s.truth.length === nH, `${key}: truth trajectory length`);
    everyFinite(s.truth, `${key}.truth`);
  }
});

test('[CAST] exported RMSE values reproduce from the rounded trajectories', () => {
  for (const [key, s] of entries) for (const method of METHODS) {
    const calculated = rmse(estimate(s, method), s.truth);
    approx(calculated, s.rmse[method], 8e-4, `${key}.${method} RMSE`);
  }
});

test('[CAST] CSF and CAST intervals are ordered pointwise and contain their fitted values', () => {
  for (const [key, s] of entries) for (const [method, obj, fit] of [
    ['csf', s.csf, s.csf.ate], ['cast', s.cast, s.cast.fit],
  ]) for (let i = 0; i < data.horizons.length; i++) {
    finite(obj.lo[i], `${key}.${method}.lo[${i}]`);
    finite(obj.hi[i], `${key}.${method}.hi[${i}]`);
    assert(obj.lo[i] <= fit[i] && fit[i] <= obj.hi[i],
      `${key}.${method}[${i}] fit ${fit[i]} outside [${obj.lo[i]}, ${obj.hi[i]}]`);
  }
});

test('[CAST] overlap and latent-factor sensitivity diagnostics are internally consistent', () => {
  for (const [key, s] of entries) {
    const o = s.overlap;
    assert(0 <= o.min && o.min <= o.max && o.max <= 1, `${key}: invalid propensity range`);
    assert(0 <= o.pct_extreme && o.pct_extreme <= 1, `${key}: invalid extreme fraction`);
    assert(0 <= o.pct_clipped && o.pct_clipped <= 1, `${key}: invalid clipped fraction`);
    const r = s.robustness;
    for (let i = 0; i < data.horizons.length; i++) {
      approx(r.shift[i], r.ate_omitU[i] - r.ate_withU[i], 2e-4, `${key}: CSF shift[${i}]`);
      assert(r.evalue[i] >= 1, `${key}: E-value below 1 at horizon ${i}`);
    }
  }
});

test('[CAST] AUTOC is stored as a signed null diagnostic with uncertainty', () => {
  let hasNegative = false;
  for (const [key, s] of entries) {
    finite(s.autoc.est, `${key}.autoc.est`);
    finite(s.autoc.se, `${key}.autoc.se`);
    assert(s.autoc.se >= 0, `${key}: negative AUTOC SE`);
    hasNegative ||= s.autoc.est < 0;
    const q = s.autoc.toc.q;
    const toc = s.autoc.toc.est;
    assert(q.length === toc.length && q.length > 1, `${key}: malformed TOC curve`);
    monotone(q, 'inc', `${key}: TOC quantiles`);
    everyFinite(toc, `${key}.autoc.toc`);
  }
  assert(hasNegative, 'AUTOC export appears forced non-negative; preserve signed null diagnostics');
});

