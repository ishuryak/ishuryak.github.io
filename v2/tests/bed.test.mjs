/* Adversarial tests - Explorable 1: mechanistic BED (head & neck).
   Anchors: Shuryak, Wang & Brenner Front Oncol 2024; Shuryak, Hall & Brenner
   Radiother Oncol 2018 (see PROVENANCE.md). */
import { test, assert, approx, finite, monotone, linspace } from './harness.mjs';
import { bedSimple, bedDI, scheduleDays, BED } from '../assets/js/models.js';

/* Exact reduction: with no elapsed time there is no background growth and no
   repopulation penalty, so the dose-independent-repopulation BED must collapse
   onto the simple LQ BED. A failure here means the T-terms leak at T=0. */
test('[BED] bedDI(T=0) reduces exactly to bedSimple', () => {
  for (const m of [1, 10, 35]) for (const d of [1.2, 2, 3, 4]) {
    approx(bedDI(m, d, 0), bedSimple(m, d), 1e-9, `m=${m} d=${d}`);
  }
});

/* Repopulation penalty must be ONE-SIDED at Tk: identical below the onset,
   strictly biting above it. Adversarial: straddle Tk by ±1e-6 days. */
test('[BED] accelerated-repopulation penalty switches on only past Tk', () => {
  const m = 35, d = 2, Tk = BED.Tk;
  // Just below onset: BED falls only through slow background growth (-g*T/a).
  const below = bedDI(m, d, Tk - 1e-6);
  const at = bedDI(m, d, Tk);
  approx(below, at, 1e-3, 'continuous across Tk');
  // Past onset the extra -lambda*(T-Tk)/a term must make BED strictly smaller
  // than a linear extension of the pre-Tk background-only slope.
  const g = BED.g, a = BED.alpha, lam = BED.lambda;
  const noPenalty = at - (g / a) * 10;              // 10 more days, growth only
  const withPenalty = bedDI(m, d, Tk + 10);
  assert(withPenalty < noPenalty - 1e-6,
    `penalty absent past Tk: withPenalty=${withPenalty} !< noPenalty=${noPenalty}`);
  // Magnitude of the extra drop must equal lambda*(ΔT)/alpha.
  approx(noPenalty - withPenalty, (lam / a) * 10, 1e-6, 'penalty size = lambda*ΔT/alpha');
});

/* Prolonging treatment can only cost effective dose (never help). */
test('[BED] BED strictly decreases as treatment time lengthens', () => {
  const Ts = linspace(0, 60, 40);
  monotone(Ts.map((T) => bedDI(35, 2, T)), 'dec', 'bedDI vs T');
});

/* Monotone in the two dose levers. */
test('[BED] BED increases with dose per fraction and with fraction number', () => {
  monotone(linspace(1.2, 4, 30).map((d) => bedSimple(20, d)), 'inc', 'bedSimple vs d');
  monotone(linspace(1, 40, 40).map((m) => bedSimple(m, 2)), 'inc', 'bedSimple vs m');
  monotone(linspace(1.2, 4, 30).map((d) => bedDI(30, d, 45)), 'inc', 'bedDI vs d');
});

/* d -> 0 gives zero effective dose. */
test('[BED] zero dose gives zero BED', () => {
  approx(bedSimple(35, 0), 0, 1e-12, 'bedSimple(0)');
  approx(bedDI(35, 0, 0), 0, 1e-12, 'bedDI(0,0)');
});

/* Standard schedule geometry (5 fractions/week). */
test('[BED] scheduleDays matches the clinical calendar', () => {
  assert(scheduleDays(1) === 1, `1 fx -> ${scheduleDays(1)}`);
  assert(scheduleDays(5) === 5, `5 fx -> ${scheduleDays(5)}`);
  assert(scheduleDays(6) === 8, `6 fx -> ${scheduleDays(6)} (should start week 2)`);
  assert(scheduleDays(35) === 47, `35 fx -> ${scheduleDays(35)} (7 weeks)`);
});

/* Realism guard on the flagship 70 Gy / 35 fx preset: the mechanistic
   dose-equivalent should land in a clinically sane window, not blow up. */
test('[BED] 70 Gy / 35 fx preset yields a sane BED', () => {
  const bed = bedDI(35, 2, scheduleDays(35));
  finite(bed, 'preset BED');
  assert(bed > 55 && bed < 80, `70/35 BED = ${bed.toFixed(1)} outside [55,80]`);
});

/* No NaN anywhere on the widget's slider domains. */
test('[BED] no NaN across the full slider grid', () => {
  for (const m of linspace(1, 40, 20)) for (const d of linspace(1.2, 4, 15)) {
    const T = scheduleDays(Math.round(m));
    for (const ab of BED.abRange) {
      finite(bedSimple(m, d, ab), `bedSimple m=${m} d=${d}`);
      finite(bedDI(m, d, T, { ab }), `bedDI m=${m} d=${d} ab=${ab}`);
    }
  }
});
