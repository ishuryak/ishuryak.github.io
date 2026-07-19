/* Adversarial tests - Explorable 7: radiation resistance.
   Anchors: Shuryak & Brenner Radiat Environ Biophys 2010 / J Theor Biol 2009
   (D10 = 12.1 kGy; k23=0 -> 0.23 kGy); Sharma ... Shuryak ... Daly PNAS 2017
   (Hill law, 21-organism table). PROVENANCE.md. */
import { test, assert, approx, finite, monotone, linspace } from './harness.mjs';
import {
  drSurvival, drColony, drD10, DR, hill_fH, HILL, ORGANISMS,
} from '../assets/js/models.js';

test('[resist] full survival at zero dose', () => {
  approx(drSurvival(0), 1, 1e-12, 'drSurvival(0)');
  approx(drColony(0), 1, 1e-12, 'drColony(0)');
});

/* Published anchor: the fitted constants give D10 ≈ 12.1 kGy (measured 12.0). */
test('[resist] Deinococcus D10 reproduces the published 12.1 kGy', () => {
  approx(drD10(), 12.1, 0.25, 'drD10 default');
});

/* The shoulder IS the inducible antioxidant defense: zeroing k23 must both
   collapse survival to a plain exponential AND crash D10 to ~0.23 kGy. */
test('[resist] removing the antioxidant defense (k23=0) collapses the curve', () => {
  for (const D of linspace(0, 15, 25))
    approx(drSurvival(D, 0), Math.exp(-DR.c8 * D), 1e-12, `k23=0 exponential D=${D}`);
  approx(drD10(0), 0.23, 0.05, 'drD10 with k23=0');
  // At an intermediate dose the intact defense must help enormously.
  assert(drSurvival(5, DR.k23) > drSurvival(5, 0) * 1e3,
    'defense provides no shoulder at 5 kGy');
});

test('[resist] survival is bounded and decreasing; colony survival >= clonogen survival', () => {
  const D = linspace(0, 20, 40);
  monotone(D.map((d) => drSurvival(d)), 'dec', 'drSurvival');
  for (const d of D) {
    const s = drSurvival(d), c = drColony(d);
    assert(s >= 0 && s <= 1 + 1e-12, `S out of range: ${s}`);
    assert(c >= s - 1e-12, `colony ${c} < clonogen ${s} at D=${d}`);
  }
});

/* Hill law for the tree-of-life fraction: 0 at zero, monotone, saturating to 1. */
test('[resist] Hill fraction is 0 at zero DSB, increasing, and saturates below 1', () => {
  approx(hill_fH(0), 0, 1e-12, 'fH(0)');
  monotone(linspace(0, 200, 50).map((x) => hill_fH(x)), 'inc', 'fH(dsb)');
  const big = hill_fH(1e4);
  assert(big > 0.99 && big < 1, `fH saturation ${big} not in (0.99,1)`);
});

/* Published finding preserved in the data: the SOD knockout is tabulated
   identical to wild-type D. radiodurans. */
test('[resist] SOD-knockout row matches wild-type D. radiodurans', () => {
  const wt = ORGANISMS.find((o) => o.short === 'Dr');
  const ko = ORGANISMS.find((o) => o.short === 'Dr sodA⁻');
  assert(wt && ko, 'rows missing');
  approx(ko.d10, wt.d10, 1e-12, 'D10 KO==WT');
  approx(ko.fH, wt.fH, 1e-12, 'fH KO==WT');
  approx(ko.dsb, wt.dsb, 1e-12, 'DSB KO==WT');
});

/* Table integrity: the whole 21-organism panel must be well-formed. */
test('[resist] the 21-organism table is well-formed', () => {
  assert(ORGANISMS.length === 21, `expected 21 organisms, got ${ORGANISMS.length}`);
  for (const o of ORGANISMS) {
    assert(o.d10 > 0, `${o.short} D10 not positive`);
    assert(o.fH >= 0 && o.fH <= 1, `${o.short} fH out of [0,1]`);
    assert(o.dsb > 0, `${o.short} DSB not positive`);
  }
});
