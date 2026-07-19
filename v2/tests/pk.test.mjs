/* Adversarial tests - Explorable 6: radiopharmaceutical retention.
   Anchor: Shuryak & Dadachova J Nucl Med 56(10):1622-1628 (2015). Every curve
   and integral is recomputed from Table 2 parameters; the paper's tabulated
   integral column is deliberately NOT reproduced (PROVENANCE.md), so the tests
   pin physical invariants rather than a Table-3 number. */
import { test, assert, approx, finite, monotone, linspace } from './harness.mjs';
import { PK, PK_MODELS, pkRetention, pkIntegral, pkModelAveragedRatio, TAU0 } from '../assets/js/models.js';

const tissues = Object.keys(PK);
const models = Object.keys(PK_MODELS);

/* Retention is normalized to 1 at t=0 for every tissue and every model. */
test('[PK] retention starts at 1', () => {
  for (const ti of tissues) for (const m of models)
    approx(pkRetention(0, ti, m), 1, 1e-12, `${ti}/${m} R(0)`);
});

/* Retention is a fraction in [0,1] and never increases (uptake + decay only). */
test('[PK] retention is a bounded, non-increasing fraction', () => {
  const t = linspace(0, 6000, 60);
  for (const ti of tissues) for (const m of models) {
    const R = t.map((x) => pkRetention(x, ti, m));
    monotone(R, 'dec', `${ti}/${m}`);
    for (const r of R) assert(r >= -1e-12 && r <= 1 + 1e-12, `${ti}/${m} R out of [0,1]: ${r}`);
  }
});

/* Physical decay half-life: the decay factor alone halves at TAU0 minutes.
   Read it off the mono-exponential-plus-constant model is awkward, so use the
   pure decay embedded in a model whose intrinsic retention is ~flat early. */
test('[PK] physical decay removes everything by 30 half-lives', () => {
  for (const ti of tissues) for (const m of models)
    assert(pkRetention(30 * TAU0, ti, m) < 1e-6, `${ti}/${m} not decayed at 30 half-lives`);
});

/* Integrals (proportional to absorbed dose) must be finite and strictly
   positive, including the bone-marrow bi-exponential with an infinite time
   constant (tau4 = Infinity), the adversarial edge that a naive exp(-t/tau)
   would turn into NaN. */
test('[PK] time integrals are finite and positive for every tissue and model', () => {
  for (const ti of tissues) for (const m of models) {
    const I = pkIntegral(ti, m);
    finite(I, `${ti}/${m} integral`);
    assert(I > 0, `${ti}/${m} integral not positive: ${I}`);
  }
  // Explicit marrow/BE infinite-tau guard.
  assert(PK.marrow.BE.tau4 === Infinity, 'test premise: marrow BE tau4 is Infinity');
  finite(pkRetention(500, 'marrow', 'BE'), 'marrow BE retention with infinite tau');
});

/* The model-averaged integral ratio must be a finite positive number (its
   Akaike weights are a convex combination; no Table-3 value is asserted). */
test('[PK] model-averaged integral ratio is finite and positive', () => {
  for (const ti of tissues) {
    const r = pkModelAveragedRatio(ti);
    finite(r, `${ti} MNTI ratio`);
    assert(r > 0, `${ti} MNTI ratio not positive: ${r}`);
  }
});

test('[PK] no NaN across the retention time grid', () => {
  for (const t of linspace(0, 30000, 80)) for (const ti of tissues) for (const m of models)
    finite(pkRetention(t, ti, m), `${ti}/${m} @t=${t}`);
});
