/* Adversarial tests - Explorable 2: targeted + non-targeted effects, high-LET.
   Anchor: Shuryak, Sachs & Brenner, Sci Rep 11:23467 (2021). PROVENANCE.md
   pins IEA 4.74, SEA 12.34, Si-alone 9.66 at the Mars mixture dose. */
import { test, assert, approx, finite, monotone, linspace } from './harness.mjs';
import {
  IONS, muRad, dMuRad, invMuRad, RER, RBE,
  SEA, IEA, IEACurve, MARS_TOTAL,
} from '../assets/js/models.js';

const ionKeys = Object.keys(IONS);

test('[high-LET] zero dose gives zero excess for every ion', () => {
  for (const k of ionKeys) approx(muRad(0, k), 0, 1e-12, `muRad(0,${k})`);
});

test('[high-LET] muRad is strictly increasing and its derivative is positive', () => {
  const D = linspace(0, 1.4, 60);
  for (const k of ionKeys) {
    monotone(D.map((d) => muRad(d, k)), 'inc', `muRad ${k}`);
    for (const d of D) assert(dMuRad(d, k) > 0, `dMuRad(${d},${k}) not > 0`);
  }
});

test('[high-LET] gamma is its own reference: RER=RBE=1', () => {
  for (const d of [0.01, 0.05, 0.5, 1.4]) {
    approx(RER(d, 'gamma'), 1, 1e-12, `RER gamma @${d}`);
    approx(RBE(d, 'gamma'), 1, 1e-12, `RBE gamma @${d}`);
  }
});

/* invMuRad must invert muRad even when the requested yield forces the initial
   bracket to grow (the classic silent-saturation bug this guards). */
test('[high-LET] invMuRad round-trips, including large yields past the bracket', () => {
  for (const k of ionKeys) {
    for (const I of [0.1, 1, 5, 20, 100, 400]) {
      const d = invMuRad(I, k);
      finite(d, `invMuRad(${I},${k})`);
      approx(muRad(d, k), I, 1e-4 * Math.max(1, I), `round-trip ${k} I=${I}`);
    }
  }
});

/* The paper's asymptotic result: RBE and RER converge as dose -> 0. */
test('[high-LET] RBE and RER converge at vanishing dose', () => {
  for (const k of ionKeys.filter((k) => k !== 'gamma')) {
    const dLo = 1e-5;
    assert(Math.abs(RBE(dLo, k) - RER(dLo, k)) < 0.02,
      `${k}: RBE=${RBE(dLo, k).toFixed(3)} RER=${RER(dLo, k).toFixed(3)} not converging at low dose`);
  }
});

/* Published mixture anchors. */
test('[high-LET] IEA / SEA / Si-alone reproduce the published mixture values', () => {
  approx(IEA(MARS_TOTAL), 4.74, 0.05, 'IEA at Mars dose');
  approx(SEA(MARS_TOTAL), 12.34, 0.05, 'SEA at Mars dose');
  approx(muRad(MARS_TOTAL, 'Si'), 9.66, 0.05, 'Si alone at Mars dose');
});

/* The published absurdity: simple additivity predicts a mixture worse than its
   single most damaging ingredient, and far above the mechanistic IEA. */
test('[high-LET] SEA exceeds the worst single component and exceeds IEA', () => {
  const sea = SEA(MARS_TOTAL), si = muRad(MARS_TOTAL, 'Si'), iea = IEA(MARS_TOTAL);
  assert(sea > si, `SEA ${sea.toFixed(2)} should exceed Si-alone ${si.toFixed(2)}`);
  assert(sea > iea, `SEA ${sea.toFixed(2)} should exceed IEA ${iea.toFixed(2)}`);
  assert(iea < si, `IEA ${iea.toFixed(2)} should fall below the worst component ${si.toFixed(2)}`);
  approx(sea / iea, 2.6, 0.15, 'published SEA/IEA ratio ~2.6');
});

/* The IEA ODE must be converged: halving the step cannot move the answer. */
test('[high-LET] IEA is step-size independent (ODE converged)', () => {
  approx(IEA(MARS_TOTAL, 120), IEA(MARS_TOTAL, 480), 0.02, 'IEA 120 vs 480 steps');
});

/* IEACurve (integrated once across a grid) must agree with the from-zero IEA at
   the endpoint and be monotone increasing. */
test('[high-LET] IEACurve endpoint equals IEA and the curve is monotone', () => {
  const grid = linspace(0.02, MARS_TOTAL, 25);
  const curve = IEACurve(grid);
  monotone(curve, 'inc', 'IEACurve');
  approx(curve[curve.length - 1], IEA(grid[grid.length - 1]), 0.02, 'IEACurve endpoint');
});

test('[high-LET] no NaN in RER/RBE/muRad across the dose grid', () => {
  for (const d of linspace(1e-4, 1.4, 80)) for (const k of ionKeys) {
    finite(muRad(d, k), `muRad ${k}`);
    finite(RER(d, k), `RER ${k}`);
    finite(RBE(d, k), `RBE ${k}`);
  }
});
