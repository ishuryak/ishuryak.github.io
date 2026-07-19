/* Adversarial tests - Explorable 5: radiation carcinogenesis / second cancers.
   Anchor: Shuryak, Hahnfeldt, Hlatky, Sachs & Brenner, Radiat Environ Biophys
   48(3) Parts I & II (2009). PROVENANCE.md: 2 Gy-fx lung ERR peaks ~36 Gy. */
import { test, assert, approx, finite, linspace } from './harness.mjs';
import { ERR, fractionated, SITES } from '../assets/js/models.js';

const siteKeys = Object.keys(SITES);

test('[cancer] zero dose gives zero excess risk', () => {
  for (const s of siteKeys) approx(ERR(0, s), 0, 1e-12, `ERR(0,${s})`);
});

/* THE published internal check (models.js line ~402): with K = 1 the whole
   fractionated formalism must reduce EXACTLY to the closed-form acute Sf / ISf. */
test('[cancer] single fraction reduces exactly to the acute expressions', () => {
  for (const key of siteKeys) {
    const s = SITES[key];
    for (const D of linspace(0.5, s.dmax, 12)) {
      const { Sf, ISf } = fractionated(D, s, 1);
      const surv = Math.exp(-s.alpha * D - s.beta * D * D);
      const SfAcute = 1 - Math.pow(1 - surv, s.Z);
      const ISfAcute = D * surv;
      approx(Sf, SfAcute, 1e-9, `${key} Sf D=${D}`);
      approx(ISf, ISfAcute, 1e-9, `${key} ISf D=${D}`);
    }
  }
});

/* The signature non-monotonicity: with 2 Gy fractions the lung ERR rises then
   turns over inside the therapeutic range (cell killing outruns initiation). */
test('[cancer] fractionated lung ERR peaks in the therapeutic range', () => {
  const D = linspace(2, 60, 120);
  const err = D.map((d) => ERR(d, 'lung', { K: Math.max(1, Math.round(d / 2)) }));
  err.forEach((v, i) => finite(v, `lung ERR D=${D[i]}`));
  let pi = 0; err.forEach((v, i) => { if (v > err[pi]) pi = i; });
  assert(pi > 0 && pi < D.length - 1, `no interior peak (argmax at edge index ${pi})`);
  assert(D[pi] > 25 && D[pi] < 50, `peak at ${D[pi].toFixed(0)} Gy, expected ~36 (PROVENANCE 20-60)`);
  // Genuinely turns over: the tail must fall below the peak.
  assert(err[err.length - 1] < err[pi], 'ERR does not decline after the peak');
});

/* Fractionation is what pushes the risk peak out to therapeutic doses: sparing
   between fractions keeps clonogens alive to be initiated, so the fractionated
   peak must sit at a HIGHER dose than the single-acute peak (a single large dose
   sterilizes the tissue earlier, collapsing its ERR toward -1). */
test('[cancer] fractionation shifts the risk peak to a higher dose than acute', () => {
  const D = linspace(1, 60, 120);
  const argmax = (ys) => { let p = 0; ys.forEach((v, i) => { if (v > ys[p]) p = i; }); return D[p]; };
  const acutePeak = argmax(D.map((d) => ERR(d, 'lung', { K: 1 })));
  const fracPeak = argmax(D.map((d) => ERR(d, 'lung', { K: Math.max(1, Math.round(d / 2)) })));
  assert(fracPeak > acutePeak + 2,
    `fractionated peak ${fracPeak.toFixed(0)} Gy not clearly above acute peak ${acutePeak.toFixed(0)} Gy`);
});

/* Full stress sweep: every site, dose, and fraction count must stay finite even
   with the large clonogen counts Z (breast Z ~ 10^6.65). */
test('[cancer] no NaN/overflow across sites, doses, and fraction counts', () => {
  for (const s of siteKeys) for (const D of linspace(0.5, 60, 40)) {
    for (const K of [1, 5, 15, 30]) finite(ERR(D, s, { K }), `${s} D=${D} K=${K}`);
  }
});

/* Low-dose risk is positive (radiation induces cancer before killing dominates). */
test('[cancer] excess risk is positive at low dose', () => {
  for (const s of siteKeys) assert(ERR(2, s, { K: 1 }) > 0, `${s} ERR(2Gy) not > 0`);
});
