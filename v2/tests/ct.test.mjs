/* Adversarial tests - Explorable 8: life-expectancy-adjusted imaging risk.
   Anchor: Brenner, Shuryak & Einstein, Radiology 261(1):193-198 (2011). The
   panel shows only the published scenarios (nothing interpolated), so the test
   is a data-integrity lock against the exact published values (PROVENANCE.md). */
import { test, assert, approx } from './harness.mjs';
import { LE_SCENARIOS, LE_R65 } from '../assets/js/models.js';

const byKey = Object.fromEntries(LE_SCENARIOS.map((s) => [s.key, s]));

test('[CT] published risk-reduction scenarios match the paper exactly', () => {
  approx(byKey.colon0.reduction, 0.08, 1e-12, 'colon stage 0/I, age 70');
  approx(byKey.colon4.reduction, 0.92, 1e-12, 'colon stage IV, age 70');
  approx(byKey.cabg55.reduction, 0.57, 1e-12, 'post-bypass CCTA, age 55');
  approx(byKey.cabg75.reduction, 0.12, 1e-12, 'post-bypass CCTA, age 75');
});

test('[CT] every reduction is a valid fraction and ages are as published', () => {
  for (const s of LE_SCENARIOS) {
    assert(s.reduction >= 0 && s.reduction <= 1, `${s.key} reduction out of [0,1]: ${s.reduction}`);
    assert(s.age >= 55 && s.age <= 75, `${s.key} age unexpected: ${s.age}`);
  }
});

/* The one interval-bearing point estimate: R = 0.58 (95% CI 0.52-0.64). */
test('[CT] the 65-year-old point estimate carries a consistent 95% CI', () => {
  approx(LE_R65.R, 0.58, 1e-12, 'R65');
  approx(LE_R65.lo, 0.52, 1e-12, 'R65 lo');
  approx(LE_R65.hi, 0.64, 1e-12, 'R65 hi');
  assert(LE_R65.lo < LE_R65.R && LE_R65.R < LE_R65.hi, 'point estimate not inside its CI');
});
