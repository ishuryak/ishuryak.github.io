/* Adversarial tests - Explorable 3a: from the average effect to the individual
   effect (illustrative synthetic DGP). No published anchor by design; the tests
   pin the DGP's mathematical invariants and the targeting logic. */
import { test, assert, approx, finite, linspace } from './harness.mjs';
import { cateCohort, cateReadouts } from '../assets/js/widgets.js';

const N = 1000, SEED = 20250712;
const cohort = cateCohort(N, SEED);
const variance = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length;
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length; };

/* Same seed must give a byte-identical cohort (the picture is stable). */
test('[CATE] cohort is deterministic in the seed', () => {
  const c2 = cateCohort(N, SEED);
  for (let i = 0; i < N; i++) {
    assert(cohort.marker[i] === c2.marker[i], `marker[${i}] differs`);
    assert(cohort.noise[i] === c2.noise[i], `noise[${i}] differs`);
  }
  const c3 = cateCohort(N, SEED + 1);
  assert(c3.marker[0] !== cohort.marker[0], 'different seed gave identical draw');
});

/* Marker and noise are standardized to sample mean 0, so the sample ATE equals
   mu EXACTLY (not just in expectation) for every setting. */
test('[CATE] sample ATE equals mu exactly', () => {
  for (const mu of [-0.04, 0, 0.06, 0.2]) for (const tau of [0, 0.09, 0.16])
    for (const rho of [0, 0.5, 1]) {
      approx(cateReadouts(cohort, mu, tau, rho).ate, mu, 1e-12, `mu=${mu} tau=${tau} rho=${rho}`);
    }
});

/* Variance decomposition: total effect variance = tau^2, predictable fraction = rho.
   The predictable share var(pred)/tau^2 is EXACT (marker is standardized to unit
   sample variance). The TOTAL variance carries a genuine O(1/sqrt(N)) term from
   the sample cross-covariance of the independently drawn marker and noise, so it
   equals tau^2 only up to a finite-sample tolerance -- tightened here to catch a
   sqrt(rho)-vs-rho scaling bug (which would move it by ~20%) while allowing the
   real ~1% sampling drift at N=1000. */
test('[CATE] variance is tau^2 and the predictable fraction is rho', () => {
  const mu = 0.06, tau = 0.12;
  for (const rho of [0, 0.25, 0.6, 1]) {
    const { ite, pred } = cateReadouts(cohort, mu, tau, rho);
    approx(variance(pred) / (tau * tau), rho, 1e-9, `predictable fraction rho=${rho}`);
    approx(variance(ite), tau * tau, 0.03 * tau * tau, `total var rho=${rho}`);
  }
});

/* tau = 0: the distribution collapses to a spike at mu; there is nobody to target. */
test('[CATE] zero spread collapses to a spike with zero targeting gain', () => {
  const { ite, gain, targeted, ate } = cateReadouts(cohort, 0.06, 0, 0.6);
  for (const v of ite) approx(v, 0.06, 1e-12, 'ite at tau=0');
  approx(gain, 0, 1e-12, 'gain at tau=0');
  approx(targeted, ate, 1e-12, 'targeted == ate at tau=0');
});

/* rho = 0: variation exists but is unpredictable; ranking by prediction recovers
   essentially nothing (the whole point about actionability). */
test('[CATE] unpredictable variation cannot be targeted', () => {
  const { gain, pred } = cateReadouts(cohort, 0.06, 0.16, 0);
  approx(variance(pred), 0, 1e-12, 'pred has no spread at rho=0');
  assert(Math.abs(gain) < 0.01, `targeting gain ${gain} should be ~0 at rho=0`);
});

/* rho = 1: prediction is the true effect; targeting the top half is oracle-optimal. */
test('[CATE] fully predictable variation yields the maximal targeting gain', () => {
  const mu = 0.06, tau = 0.12;
  const g0 = cateReadouts(cohort, mu, tau, 0).gain;
  const gHalf = cateReadouts(cohort, mu, tau, 0.5).gain;
  const g1 = cateReadouts(cohort, mu, tau, 1).gain;
  assert(g1 > gHalf && gHalf > g0,
    `gain not increasing in predictability: rho0=${g0.toFixed(4)} .5=${gHalf.toFixed(4)} 1=${g1.toFixed(4)}`);
  // At rho=1, pred == ite, so the treated half is exactly the true top half.
  const { ite, pred, targeted } = cateReadouts(cohort, mu, tau, 1);
  for (let i = 0; i < N; i++) approx(pred[i], ite[i], 1e-12, `pred==ite @${i}`);
  const trueTop = [...ite].sort((a, b) => b - a).slice(0, Math.round(N / 2));
  approx(targeted, trueTop.reduce((s, x) => s + x, 0) / trueTop.length, 1e-9, 'oracle top-half mean');
});

/* Targeting on a real predictor (0<rho<1) helps but cannot beat the oracle. */
test('[CATE] targeted effect sits between the average and the oracle ceiling', () => {
  const mu = 0.06, tau = 0.12, rho = 0.6;
  const { ate, targeted } = cateReadouts(cohort, mu, tau, rho);
  const ceiling = cateReadouts(cohort, mu, tau, 1).targeted;
  assert(targeted >= ate - 1e-9, `targeted ${targeted} below ATE ${ate}`);
  assert(targeted <= ceiling + 1e-9, `targeted ${targeted} above oracle ceiling ${ceiling}`);
});

/* Who-benefits accounting must be a valid partition. */
test('[CATE] benefit and harm fractions never exceed the cohort', () => {
  for (const mu of linspace(-0.04, 0.2, 7)) for (const tau of linspace(0, 0.16, 5))
    for (const rho of linspace(0, 1, 5)) {
      const { pBenefit, pHarm } = cateReadouts(cohort, mu, tau, rho);
      assert(pBenefit >= 0 && pHarm >= 0 && pBenefit + pHarm <= 1 + 1e-9,
        `partition broken mu=${mu} tau=${tau} rho=${rho}: ${pBenefit}+${pHarm}`);
    }
});

/* Full-domain NaN sweep of every reported quantity. */
test('[CATE] no NaN across the full (mu, tau, rho) grid', () => {
  for (const mu of linspace(-0.04, 0.2, 14)) for (const tau of linspace(0, 0.16, 9))
    for (const rho of linspace(0, 1, 11)) {
      const r = cateReadouts(cohort, mu, tau, rho);
      for (const key of ['ate', 'targeted', 'gain', 'pBenefit', 'pHarm'])
        finite(r[key], `${key} mu=${mu} tau=${tau} rho=${rho}`);
    }
});
