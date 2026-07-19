/* Adversarial tests - Explorable 4: overdispersed linear-quadratic survival and
   chromosome aberrations. Anchors: Shuryak & Cornforth Int J Radiat Biol 2021;
   Cornforth, Shuryak & Loucas Transl Cancer Res 2017 (PROVENANCE.md). */
import { test, assert, approx, finite, monotone, linspace } from './harness.mjs';
import {
  survivalNB, survivalPoisson, CELLS,
  ABERRATION, aberrationFree,
} from '../assets/js/models.js';

test('[LQ] zero dose gives full survival', () => {
  approx(survivalPoisson(0, 0.2, 0.03), 1, 1e-12, 'Poisson(0)');
  approx(survivalNB(0, 0.2, 0.03, 0.1), 1, 1e-12, 'NB(0)');
});

/* The headline published property: r -> 0 recovers the classical Poisson LQ. */
test('[LQ] overdispersion r -> 0 recovers the Poisson survival curve', () => {
  for (const D of linspace(0, 8, 30)) {
    approx(survivalNB(D, 0.16, 0.028, 1e-10), survivalPoisson(D, 0.16, 0.028), 1e-6, `D=${D}`);
  }
  // CHO AA8 is fitted with r = 0 exactly, so the two must agree to machine precision.
  const c = CELLS.CHOAA8.nb;
  for (const D of linspace(0, 8, 20))
    approx(survivalNB(D, c.a, c.b, c.r), survivalPoisson(D, c.a, c.b), 1e-12, `CHOAA8 D=${D}`);
});

/* Survival is a probability: monotone decreasing and bounded in (0,1]. */
test('[LQ] survival is a bounded, decreasing probability for every cell line', () => {
  for (const [name, c] of Object.entries(CELLS)) {
    const D = linspace(0, c.dmax, 40);
    const S = D.map((d) => survivalNB(d, c.nb.a, c.nb.b, c.nb.r));
    monotone(S, 'dec', `${name} S(D)`);
    for (const s of S) assert(s > 0 && s <= 1 + 1e-12, `${name} S out of (0,1]: ${s}`);
  }
});

/* Overdispersion lifts the high-dose tail above the Poisson prediction whenever
   r > 0 (heterogeneous radiosensitivity leaves resistant survivors). */
test('[LQ] r>0 gives a heavier survival tail than Poisson at high dose', () => {
  for (const [name, c] of Object.entries(CELLS)) {
    if (c.nb.r <= 0) continue;
    const D = c.dmax;
    const nb = survivalNB(D, c.nb.a, c.nb.b, c.nb.r);
    const po = survivalPoisson(D, c.nb.a, c.nb.b);
    assert(nb > po, `${name}: NB tail ${nb.toExponential(2)} not above Poisson ${po.toExponential(2)}`);
  }
});

test('[LQ] no NaN across the survival grid', () => {
  for (const c of Object.values(CELLS)) for (const D of linspace(0, c.dmax, 40)) {
    finite(survivalNB(D, c.nb.a, c.nb.b, c.nb.r), 'NB');
    finite(survivalPoisson(D, c.pois.a, c.pois.b), 'Poisson');
  }
});

/* Chromosome aberrations: iron (beta=0) is a pure exponential; the log-survival
   slope must be exactly constant. Gamma (beta>0) must curve. */
test('[aberrations] iron is log-linear, gamma is curved', () => {
  const slopeFe = (D) => -Math.log(aberrationFree(D, 'Fe')) / D;
  const s1 = slopeFe(1), s5 = slopeFe(5);
  approx(s1, ABERRATION.Fe.a, 1e-9, 'Fe low-dose slope = a');
  approx(s5, ABERRATION.Fe.a, 1e-9, 'Fe high-dose slope = a (no curvature)');

  const slopeG = (D) => -Math.log(aberrationFree(D, 'gamma')) / D;
  assert(slopeG(5) > slopeG(1) + 1e-6, 'gamma effective slope should rise with dose (curvature)');
});

test('[aberrations] fraction free is 1 at zero dose and decreasing', () => {
  for (const k of Object.keys(ABERRATION)) {
    approx(aberrationFree(0, k), 1, 1e-12, `${k} free(0)`);
    monotone(linspace(0, 5, 30).map((D) => aberrationFree(D, k)), 'dec', `${k} free(D)`);
  }
});
