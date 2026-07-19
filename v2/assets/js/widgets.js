import { render, seq, logseq, C } from './plot.js';
import {
  bedSimple, bedDI, scheduleDays,
  IONS, muRad, RER, RBE, SEA, IEA, IEACurve, MARS_MIX, MARS_TOTAL,
  CELLS, survivalNB, survivalPoisson, ABERRATION, aberrationFree,
  SITES, ERR,
  drSurvival, drD10, hill_fH, HILL, ORGANISMS, GROUPS,
  PK, PK_MODELS, pkRetention, pkIntegral, pkModelAveragedRatio,
  LE_SCENARIOS, LE_R65,
} from './models.js';

const $ = (id) => document.getElementById(id);
const num = (v, n = 2) => Number(v).toFixed(n);

/* Wire a range input to a live value label and a redraw callback. */
function slider(id, fn, format = (v) => v) {
  const inp = $(id), out = $(id + '-val');
  const sync = () => { if (out) out.textContent = format(parseFloat(inp.value)); fn(); };
  inp.addEventListener('input', sync);
  sync();
  return inp;
}

/* =================================================================
 * Widget 1. BED explorer
 * Shuryak, Wang & Brenner, Front Oncol 14:1422211 (2024) [equations]
 * Shuryak, Hall & Brenner, Radiother Oncol (2018), Table 2 [parameters]
 * ================================================================= */
export function bedExplorer() {
  const chart = $('bed-chart');
  if (!chart) return;

  const PRESETS = {
    conv:  { m: 35, d: 2.0 },    // 70 Gy / 35 fx
    hypo:  { m: 20, d: 2.75 },   // 55 Gy / 20 fx
  };

  function draw() {
    const m   = parseFloat($('bed-m').value);
    const d   = parseFloat($('bed-d').value);
    const ab  = parseFloat($('bed-ab').value);
    const Tk  = parseFloat($('bed-tk').value);
    const gap = parseFloat($('bed-gap').value);   // treatment prolongation, days

    const ms = Array.from({ length: 40 }, (_, i) => i + 1);
    const T  = (k) => scheduleDays(k) + gap;

    const totalDose = ms.map((k) => k * d);
    const noRepop   = ms.map((k) => bedSimple(k, d, ab));
    const withRep   = ms.map((k) => bedDI(k, d, T(k), { ab, Tk }));

    /* First schedule long enough for repopulation to have switched on. */
    const onsetM = ms.find((k) => T(k) > Tk);

    const series = [
      { type: 'line', x: totalDose, y: noRepop, color: C.gray, dash: '6 4',
        label: 'No repopulation (naive BED)' },
      { type: 'line', x: totalDose, y: withRep, color: C.blue,
        label: 'With accelerated repopulation (published model)' },
    ];
    if (onsetM) {
      series.push({ type: 'vline', at: onsetM * d, color: C.red,
        label: `Repopulation switches on (day ${Tk.toFixed(1)})` });
    }
    series.push({ type: 'marker', x: m * d, y: bedDI(m, d, T(m), { ab, Tk }), color: C.blue,
      label: 'Your schedule' });

    render(chart, {
      xlabel: 'Total prescribed dose (Gy)',
      ylabel: 'Biologically effective dose (Gy)',
      ymin: 0,
      series,
      caption: 'Biologically effective dose against total prescribed dose, with and without accelerated tumor repopulation.',
    });

    const bd = bedDI(m, d, T(m), { ab, Tk });
    const bs = bedSimple(m, d, ab);
    $('bed-sched').textContent = `${num(m * d, 1)} Gy / ${m} fx`;
    $('bed-days').textContent  = `${T(m)} days`;
    $('bed-bed').textContent   = `${num(bd, 1)} Gy`;
    $('bed-loss').textContent  = `${num(bs - bd, 1)} Gy`;
  }

  const FMT = {
    'bed-m': (v) => String(Math.round(v)),
    'bed-d': (v) => num(v, 2),
    'bed-gap': (v) => `+${Math.round(v)} d`,
    'bed-tk': (v) => num(v, 1),
    'bed-ab': (v) => num(v, 1),
  };
  ['bed-m', 'bed-d', 'bed-ab', 'bed-tk', 'bed-gap'].forEach((id) => slider(id, draw, FMT[id]));

  document.querySelectorAll('[data-bed-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = PRESETS[btn.dataset.bedPreset];
      $('bed-m').value = p.m;
      $('bed-d').value = p.d;
      /* Dispatch on both so each value label refreshes. */
      $('bed-m').dispatchEvent(new Event('input'));
      $('bed-d').dispatchEvent(new Event('input'));
    });
  });
  draw();
}

/* =================================================================
 * Widget 2. High-LET: targeted + non-targeted effects
 * Shuryak, Sachs & Brenner, Sci Rep 11:23467 (2021)
 * ================================================================= */
export function hiLetExplorer() {
  const chart = $('let-chart');
  if (!chart) return;

  let mode = 'dose';   // 'dose' | 'quality' | 'mixture'
  const shown = new Set(['gamma', 'H', 'Si', 'Fe']);

  function drawDose() {
    const D = seq(0, 1.4, 120);
    const series = [...shown].map((ion) => ({
      type: 'line', x: D, y: D.map((d) => muRad(d, ion)),
      color: IONS[ion].color, label: IONS[ion].label,
    }));
    const at = parseFloat($('let-dose').value);
    series.push({ type: 'vline', at, color: C.gray, dash: '4 4' });
    render(chart, {
      xlabel: 'Dose (Gy)', ylabel: 'Excess tumors per mouse', ymin: 0, series,
      caption: 'Radiation-induced excess intestinal tumors per mouse against dose, by radiation type.',
    });
  }

  function drawQuality() {
    /* Log dose axis over the paper's own plotting range, 1 mGy to 2.54 Gy. On a linear
       axis the low-dose convergence of RBE and RER is compressed against the y-axis and
       cannot be seen, which would contradict the caption. */
    const LO = 0.001, HI = 2.54;
    const D = logseq(LO, HI, 220);
    const ions = [...shown].filter((i) => i !== 'gamma');
    const series = [];
    for (const ion of ions) {
      series.push({ type: 'line', x: D, y: D.map((d) => RBE(d, ion)), color: IONS[ion].color,
        label: `${IONS[ion].label}: RBE` });
      series.push({ type: 'line', x: D, y: D.map((d) => RER(d, ion)), color: IONS[ion].color,
        dash: '5 4', label: `${IONS[ion].label}: RER` });
    }
    series.push({ type: 'hline', at: 1, color: C.gray, dash: '2 3' });
    const at = Math.min(Math.max(parseFloat($('let-dose').value), LO), HI);
    series.push({ type: 'vline', at, color: C.gray, dash: '4 4' });
    render(chart, {
      xlabel: 'Dose (Gy), logarithmic', ylabel: 'Ratio relative to γ rays',
      xlim: [LO, HI], xlog: true, ymin: 0, series,
      caption: 'Relative biological effectiveness (solid) and radiation effects ratio (dashed) against dose, on a logarithmic dose axis.',
    });
  }

  function drawMixture() {
    const D = seq(0.001, MARS_TOTAL, 60);
    const sea = D.map(SEA);
    const iea = IEACurve(D);
    /* Each component ion, plotted at the dose it would receive across the mixture ramp. */
    const comps = Object.keys(MARS_MIX).map((ion) => ({
      type: 'line', x: D, y: D.map((d) => muRad(d * MARS_MIX[ion] / MARS_TOTAL, ion)),
      color: IONS[ion].color, width: 1.3, label: IONS[ion].label,
    }));
    /* Si alone at the full mixture dose: the ceiling SEA absurdly exceeds. */
    const siFull = D.map((d) => muRad(d, 'Si'));

    render(chart, {
      xlabel: 'Total mixture dose (Gy)', ylabel: 'Excess tumors per mouse', ymin: 0,
      series: [
        ...comps,
        { type: 'line', x: D, y: siFull, color: C.red, dash: '2 3', width: 1.6,
          label: '²⁸Si alone at the full dose (the ceiling)' },
        /* Near-black, not red: SEA must not be confused with the Si component or the Si ceiling. */
        { type: 'line', x: D, y: sea, color: C.ink, width: 3,
          label: 'Simple effect additivity (SEA): just add the ions' },
        { type: 'line', x: D, y: iea, color: C.blue, width: 3,
          label: 'Incremental effect additivity (IEA): a mechanistically motivated alternative' },
      ],
      caption: 'Predicted excess tumors for a Mars-mission ion mixture: simple versus incremental effect additivity.',
    });
  }

  function readouts() {
    const at = parseFloat($('let-dose').value);
    const ref = shown.has('Fe') ? 'Fe' : ([...shown].find((i) => i !== 'gamma') || 'Fe');
    $('let-rbe').textContent = num(RBE(at, ref), 2);
    $('let-rer').textContent = num(RER(at, ref), 2);
    $('let-refion').textContent = IONS[ref].label;
    $('let-gap').textContent = num(RBE(at, ref) - RER(at, ref), 2);
  }

  function draw() {
    if (mode === 'dose') drawDose();
    else if (mode === 'quality') drawQuality();
    else drawMixture();
    if (mode !== 'mixture') readouts();
    /* The dose slider, ion toggles and RBE readouts are meaningless for the fixed mixture. */
    $('let-dose-ctl').hidden = (mode === 'mixture');
    $('let-ion-ctl').hidden = (mode === 'mixture');
    $('let-readout').hidden = (mode === 'mixture');
    $('let-mix-note').hidden = (mode !== 'mixture');
    $('let-quality-note').hidden = (mode !== 'quality');
  }

  document.querySelectorAll('[data-let-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.letMode;
      document.querySelectorAll('[data-let-mode]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === btn)));
      draw();
    });
  });
  document.querySelectorAll('[data-let-ion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ion = btn.dataset.letIon;
      if (shown.has(ion)) { if (shown.size > 1) shown.delete(ion); }
      else shown.add(ion);
      btn.setAttribute('aria-pressed', String(shown.has(ion)));
      draw();
    });
  });
  slider('let-dose', draw, (v) => `${num(v, 3)} Gy`);

  /* Mixture summary numbers, computed once (they are fixed by the published mixture). */
  $('mix-sea').textContent = num(SEA(MARS_TOTAL), 2);
  $('mix-iea').textContent = num(IEA(MARS_TOTAL), 2);
  $('mix-si').textContent  = num(muRad(MARS_TOTAL, 'Si'), 2);
  draw();
}

/* =================================================================
 * Widget 3a. From the average effect to the individual effect
 * Illustrative synthetic cohort generated in the browser. No study data
 * and no published estimates: a concept demonstration that a single
 * average hides a distribution of individual effects, and that only the
 * predictable part of that variation can be targeted in advance.
 * ================================================================= */

/* Small seeded PRNG (mulberry32) so the synthetic cohort is fixed across
   redraws and only the sliders move the picture. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Survival-probability differences shown as signed percentage points.
   Round to the displayed precision before choosing the sign, so a value that
   rounds to zero never prints as "−0.0". */
const fmtPP = (v) => { const pp = Math.round(v * 1000) / 10; return `${pp >= 0 ? '+' : '−'}${Math.abs(pp).toFixed(1)} pp`; };

/* Deterministic synthetic cohort: a standardized predictive marker and an
   independent unpredictable component, drawn once from a fixed seed. Exported as
   pure functions so the data-generating process can be tested without a DOM
   (see tests/cate.test.mjs). */
export function cateCohort(N, seed) {
  const rng = mulberry32(seed);
  const gauss = () => {                          // Box-Muller standard normal
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const standardize = (a) => {
    const mean = a.reduce((s, x) => s + x, 0) / a.length;
    const sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length) || 1;
    return a.map((x) => (x - mean) / sd);
  };
  return {
    N,
    marker: standardize(Array.from({ length: N }, gauss)),   // predictive, actionable
    noise:  standardize(Array.from({ length: N }, gauss)),   // unpredictable residual
  };
}

/* Individual effects and summary readouts for one (mu, tau, rho) setting.
   ITE = mu + sqrt(rho)*tau*marker + sqrt(1-rho)*tau*noise. Because marker and
   noise are each standardized to sample mean 0, the sample ATE equals mu
   exactly. Ranking by the predictable part `pred` and scoring the treated top
   half on the true effect is the targeting / AUTOC analogue. */
export function cateReadouts(cohort, mu, tau, rho) {
  const { N, marker, noise } = cohort;
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const sP = Math.sqrt(rho) * tau;               // predictable spread
  const sU = Math.sqrt(1 - rho) * tau;           // unpredictable spread
  const pred = marker.map((mi) => mu + sP * mi);       // what a model could predict
  const ite  = pred.map((p, i) => p + sU * noise[i]);  // the true individual effect
  const order = pred.map((_, i) => i).sort((a, b) => pred[b] - pred[a]);
  const top = order.slice(0, Math.round(N / 2));
  const ate = mean(ite);
  const targeted = mean(top.map((i) => ite[i]));
  return {
    pred, ite, ate, targeted,
    gain: targeted - ate,
    pBenefit: ite.filter((v) => v > 0).length / N,
    pHarm:    ite.filter((v) => v < 0).length / N,
  };
}

export function cateExplorer() {
  const chart = $('cate-chart');
  if (!chart) return;

  const cohort = cateCohort(1000, 20250712);
  const N = cohort.N;

  function draw() {
    const mu  = parseFloat($('cate-mu').value);    // average benefit (ATE)
    const tau = parseFloat($('cate-tau').value);   // total heterogeneity SD
    const rho = parseFloat($('cate-rho').value);   // predictable share, 0..1

    const { ite, ate, targeted, gain, pBenefit, pHarm } = cateReadouts(cohort, mu, tau, rho);

    /* Histogram of individual effects, split at zero (harm red / benefit green). */
    const lo = Math.min(...ite), hi = Math.max(...ite);
    const span = (hi - lo) || 1;
    const nb = 22, bw = span / nb;
    const counts = new Array(nb).fill(0);
    ite.forEach((v) => {
      let k = Math.floor((v - lo) / bw);
      if (k >= nb) k = nb - 1; if (k < 0) k = 0;
      counts[k]++;
    });
    const benX = [], benY = [], harmX = [], harmY = [];
    counts.forEach((c, k) => {
      const center = lo + bw * (k + 0.5);
      (center >= 0 ? (benX.push(center), benY.push(c)) : (harmX.push(center), harmY.push(c)));
    });

    /* Only emit a bar series when it has bins: an empty x array would make
       plot.js take Math.min/Math.max of nothing and corrupt the x-domain. */
    const series = [];
    if (harmX.length) series.push({ type: 'bar', x: harmX, y: harmY, color: C.red, bw: bw * 0.9, label: 'Harmed (effect below zero)' });
    if (benX.length)  series.push({ type: 'bar', x: benX,  y: benY,  color: C.green, bw: bw * 0.9, label: 'Helped (effect above zero)' });
    series.push({ type: 'vline', at: 0,   color: C.ink,  dash: '4 3', label: 'No effect' });
    series.push({ type: 'vline', at: ate, color: C.blue, dash: '2 0', label: 'Trial average (ATE)' });

    render(chart, {
      xlabel: 'Individual treatment effect (survival difference)',
      ylabel: 'Number of patients', ymin: 0,
      series,
      caption: 'Distribution of individual treatment effects across the synthetic cohort; the blue line is the single trial average a study would report.',
    });

    $('cate-dgp').textContent =
      `Synthetic cohort: n = ${N}. Each patient's true effect is known because the data are simulated.`;
    $('cate-ate').textContent = fmtPP(ate);
    $('cate-benefit').textContent = `${Math.round(pBenefit * 100)}%`;
    $('cate-harm').textContent = `${Math.round(pHarm * 100)}%`;
    const gpp = Math.round(gain * 1000) / 10;   // gain in pp, at display precision
    $('cate-target').textContent = `${fmtPP(targeted)} (${gpp >= 0 ? '+' : '−'}${Math.abs(gpp).toFixed(1)} vs all)`;

    $('cate-caption').innerHTML = tau < 1e-6
      ? 'With no variation between patients, everyone experiences the average effect: the distribution is a single spike and there is no one to single out.'
      : rho < 0.05
        ? `The effect genuinely varies between patients, but here that variation is essentially unpredictable, so ranking patients by predicted benefit and treating the top half recovers almost none of it: targeting adds only ${fmtPP(gain)} over treating everyone.`
        : `Treating the half of patients with the highest <em>predicted</em> benefit yields an average effect of ${fmtPP(targeted)}, a gain of ${fmtPP(gain)} over the ${fmtPP(ate)} from treating everyone. Only the predictable part of the variation can be captured this way.`;
  }

  slider('cate-mu', draw, (v) => fmtPP(parseFloat(v)));
  slider('cate-tau', draw, (v) => `±${(Math.abs(parseFloat(v)) * 100).toFixed(1)} pp`);
  slider('cate-rho', draw, (v) => `${Math.round(parseFloat(v) * 100)}%`);
  draw();
}

/* =================================================================
 * Widget 3. CAST trajectory explorer
 * Reskin of the public NeurIPS 2025 demo (arXiv 2505.06367).
 * Data: precomputed simulation scenarios. No patient data.
 * ================================================================= */
export async function castExplorer() {
  const chart = $('cast-chart');
  if (!chart) return;

  let data;
  try {
    data = await (await fetch('assets/data/cast_scenarios.json')).json();
  } catch (e) {
    chart.innerHTML = '<p class="note">The CAST scenarios could not be loaded. ' +
      'If you are viewing this page from the local filesystem, serve it over HTTP ' +
      '(for example <code>python3 -m http.server</code>) so the browser will fetch the data file.</p>';
    return;
  }

  const H = data.horizons;                       // [12, 36, 60, 84, 108] months
  const METHODS = {
    naive:    { label: 'Naive (unadjusted)', color: C.red },
    cox:      { label: 'Cox proportional hazards', color: C.gold },
    rsf:      { label: 'Random survival forest', color: C.green },
    csf:      { label: 'Causal survival forest', color: C.teal },
    cast:     { label: 'CAST', color: C.blue },
  };
  const on = new Set(['naive', 'cox', 'cast']);

  const RMSE_ORDER = ['naive', 'cox', 'rsf', 'tlearner', 'csf', 'cast'];
  const RMSE_LABEL = { naive: 'Naive', cox: 'Cox', rsf: 'Random forest', tlearner: 'T-learner', csf: 'Causal forest', cast: 'CAST' };
  const RMSE_COLOR = { naive: C.red, cox: C.gold, rsf: C.green, tlearner: C.purple, csf: C.teal, cast: C.blue };

  /* E-value (VanderWeele & Ding) for a hazard ratio under a common outcome: the minimum
     strength, on the risk-ratio scale, that an unmeasured confounder would need with both
     treatment and outcome to explain the association away. */
  const evalueHR = (hr, lo, hi) => {
    const approxRR = (h) => (1 - Math.pow(0.5, Math.sqrt(h))) / (1 - Math.pow(0.5, Math.sqrt(1 / h)));
    const ev = (rr) => { const r = rr < 1 ? 1 / rr : rr; return r + Math.sqrt(r * (r - 1)); };
    return { point: ev(approxRR(hr)), ci: (lo <= 1 && hi >= 1) ? 1 : ev(approxRR(hr < 1 ? hi : lo)) };
  };

  /* Number of horizons whose 95% band contains the known simulated truth. */
  const cover = (lo, hi, truth) => truth.reduce((c, t, i) => c + (lo[i] <= t && t <= hi[i] ? 1 : 0), 0);

  function draw() {
    const shape = document.querySelector('[data-cast-shape][aria-pressed=true]').dataset.castShape;
    const conf = parseFloat($('cast-conf').value);
    /* Snap to the nearest precomputed confounding level. */
    const level = data.conf_grid.reduce((a, b) =>
      Math.abs(b - conf) < Math.abs(a - conf) ? b : a);
    /* Second axis: unmeasured confounding, present only in the augmented data file. */
    const hasU = Array.isArray(data.unmeas_grid);
    $('cast-unmeas-ctl').hidden = !hasU;
    const uconf = hasU ? parseFloat($('cast-unmeas').value) : 0;
    const umLevel = hasU ? data.unmeas_grid.reduce((a, b) =>
      Math.abs(b - uconf) < Math.abs(a - uconf) ? b : a) : 0;
    const key = hasU ? `${shape}_conf${level.toFixed(2)}_unmeas${umLevel.toFixed(2)}`
                     : `${shape}_conf${level.toFixed(2)}`;
    const s = data.scenarios[key];
    if (!s) return;

    const series = [
      { type: 'line', x: H, y: s.truth, color: C.ink, width: 3.2, label: 'True effect (known, simulated)' },
    ];
    if (on.has('cast') && s.cast) {
      series.push({ type: 'band', x: H, y0: s.cast.lo, y1: s.cast.hi, color: C.blue, label: 'CAST 95% band' });
    }
    for (const [k, m] of Object.entries(METHODS)) {
      if (!on.has(k)) continue;
      const y = k === 'cast' ? s.cast?.fit : k === 'csf' ? s.csf?.ate : k === 'cox' ? s.cox?.ate : s[k];
      if (!y) continue;
      series.push({ type: 'line', x: H, y, color: m.color, label: m.label,
        dash: (k === 'cast' ? null : '6 4'), width: k === 'cast' ? 3 : 2 });
      series.push({ type: 'points', x: H, y, color: m.color });
    }

    render(chart, {
      xlabel: 'Months since treatment', ylabel: 'Treatment effect (survival difference)',
      series,
      caption: 'Estimated treatment-effect trajectory over follow-up, by method, against the known simulated truth.',
    });

    const err = (k) => s.rmse?.[k];
    $('cast-rmse-naive').textContent = err('naive')?.toFixed(3) ?? 'n/a';
    $('cast-rmse-cast').textContent = err('cast')?.toFixed(3) ?? 'n/a';
    $('cast-smd').textContent = Math.abs(s.meta.smd_age).toFixed(2);
    $('cast-ph').textContent = s.cox.ph_p < 0.05
      ? `violated (p = ${s.cox.ph_p.toFixed(3)})`
      : `not rejected (p = ${s.cox.ph_p.toFixed(2)})`;
    $('cast-level').textContent = level.toFixed(2);

    /* Item 1: the data-generating process behind this scenario. */
    const md = s.meta;
    $('cast-dgp').textContent =
      `Simulated cohort: n = ${md.n} · ${Math.round(md.event_rate * 100)}% had an event · ` +
      `${Math.round(md.treated_frac * 100)}% treated · confounding level ${level.toFixed(2)}.`;

    /* Item 3: all-method RMSE strip, worst first, so the causal methods cluster at the short end. */
    const rm = s.rmse, maxR = Math.max(...RMSE_ORDER.map((k) => rm[k]));
    $('cast-rmse').innerHTML =
      '<div class="rmse-title">Error vs known truth (RMSE, shorter is better)</div><ul>' +
      RMSE_ORDER.slice().sort((a, b) => rm[b] - rm[a]).map((k) =>
        `<li><span class="rlab">${RMSE_LABEL[k]}</span>` +
        `<span class="rbar"><i style="width:${(rm[k] / maxR * 100).toFixed(1)}%;background:${RMSE_COLOR[k]}"></i></span>` +
        `<span class="rval">${rm[k].toFixed(3)}</span></li>`).join('') + '</ul>';

    /* Item 3: 95% band coverage at this confounding level (causal survival forest shown alongside). */
    const nH = s.truth.length;
    $('cast-cov').textContent =
      `${cover(s.cast.lo, s.cast.hi, s.truth)}/${nH} · CSF ${cover(s.csf.lo, s.csf.hi, s.truth)}/${nH}`;

    /* Item 2: positivity / propensity overlap. */
    const ov = s.overlap;
    $('cast-overlap').textContent = `${ov.min.toFixed(2)}–${ov.max.toFixed(2)}`;
    $('cast-overlap-n').textContent = ov.pct_extreme > 0
      ? `PS range; ${(ov.pct_extreme * 100).toFixed(1)}% near 0 or 1, positivity strained`
      : 'propensity range; support looks adequate';

    /* Item 4 (minimal): E-value for the Cox hazard ratio. */
    const evH = evalueHR(s.cox.hr, s.cox.lo, s.cox.hi);
    $('cast-eval').textContent = evH.point.toFixed(2);
    $('cast-eval-n').textContent = evH.ci <= 1
      ? `HR ${s.cox.hr.toFixed(2)}; CI already includes no effect`
      : `HR ${s.cox.hr.toFixed(2)}; CI-limit E-value ${evH.ci.toFixed(2)}`;

    /* Item 6: aggregate AUTOC benefit-ranking (augmented data only). */
    const aOk = s.autoc && Number.isFinite(s.autoc.est);
    $('cast-autoc-card').hidden = !aOk;
    if (aOk) {
      $('cast-autoc').textContent = s.autoc.est.toFixed(3);
      $('cast-autoc-n').textContent = `targeting value ± ${s.autoc.se.toFixed(3)}`;
    }

    /* Item 4 (full): empirical robustness to the withheld latent factor. */
    const rOk = s.robustness && Array.isArray(s.robustness.shift);
    $('cast-robust-card').hidden = !rOk;
    if (rOk) {
      const sh = s.robustness.shift.filter(Number.isFinite);
      const mx = sh.reduce((m, v) => Math.abs(v) > Math.abs(m) ? v : m, 0);
      const evs = (s.robustness.evalue || []).filter(Number.isFinite);
      const evTxt = evs.length ? `; E-value ${Math.max(...evs).toFixed(2)}` : '';
      $('cast-robust').textContent = `${(mx * 100).toFixed(1)} pp`;
      $('cast-robust-n').textContent = `max horizon shift if latent factor ignored${evTxt}`;
    }
  }

  document.querySelectorAll('[data-cast-shape]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cast-shape]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b === btn)));
      draw();
    });
  });
  document.querySelectorAll('[data-cast-method]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.castMethod;
      if (on.has(k)) { if (on.size > 1) on.delete(k); } else on.add(k);
      btn.setAttribute('aria-pressed', String(on.has(k)));
      draw();
    });
  });
  slider('cast-conf', draw, (v) => Number(v).toFixed(2));
  slider('cast-unmeas', draw, (v) => Number(v).toFixed(2));
  draw();
}

/* =================================================================
 * Research map: highlight the threads that have a live explorable.
 * ================================================================= */
export function researchMap() {
  document.querySelectorAll('.map .node').forEach((n) => {
    const go = () => { const h = n.dataset.target; if (h) location.hash = h; };
    n.addEventListener('click', go);
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

/* =================================================================
 * Widget 4. Why the dose response is curved (overdispersion)
 * Shuryak & Cornforth, Int J Radiat Biol 97(1):50-59 (2021)
 * Cornforth, Shuryak & Loucas, Transl Cancer Res (2017)
 * ================================================================= */
export function lqExplorer() {
  const chart = $('lq-chart');
  if (!chart) return;
  let panel = 'cells';

  function drawCells() {
    const key = $('lq-cell').value;
    const c = CELLS[key];
    const r = parseFloat($('lq-r').value);
    const D = seq(0, c.dmax, 140);

    render(chart, {
      xlabel: 'Dose (Gy)', ylabel: 'Surviving fraction', ylog: true,
      ylim: [1e-4, 1.2],
      series: [
        { type: 'line', x: D, y: D.map((d) => survivalPoisson(d, c.pois.a, c.pois.b)),
          color: C.gray, dash: '6 4', label: 'Classical linear-quadratic (Poisson)' },
        { type: 'line', x: D, y: D.map((d) => survivalNB(d, c.nb.a, c.nb.b, r)),
          color: C.blue, width: 3, label: `Overdispersed, heterogeneity r = ${r.toFixed(3)}` },
        { type: 'line', x: D, y: D.map((d) => survivalNB(d, c.nb.a, c.nb.b, c.nb.r)),
          color: C.orange, dash: '3 3',
          label: `Published fit for this cell line (r = ${c.nb.r.toFixed(3)})` },
      ],
      caption: 'Cell surviving fraction against dose, classical versus overdispersed linear-quadratic.',
    });

    const d8 = c.dmax;
    const sNB = survivalNB(d8, c.nb.a, c.nb.b, r), sP = survivalPoisson(d8, c.pois.a, c.pois.b);
    $('lq-fitted').textContent = c.nb.r.toFixed(3);
    $('lq-ratio').textContent = `${(sNB / sP).toFixed(1)}×`;
    $('lq-at').textContent = `${d8} Gy`;
  }

  function drawAberr() {
    const D = seq(0, 5, 120);
    render(chart, {
      xlabel: 'Dose (Gy)', ylabel: 'Fraction of cells free of lethal aberrations', ylog: true,
      ylim: [1e-3, 1.2],
      series: Object.keys(ABERRATION).map((k) => ({
        type: 'line', x: D, y: D.map((d) => aberrationFree(d, k)),
        color: ABERRATION[k].color, width: 2.6, label: ABERRATION[k].label,
      })),
      caption: 'Fraction of human lymphocytes free of lethal chromosome aberrations, gamma rays versus iron ions.',
    });
  }

  function draw() {
    if (panel === 'cells') drawCells(); else drawAberr();
    $('lq-cell-ctl').hidden = (panel !== 'cells');
    $('lq-r-ctl').hidden = (panel !== 'cells');
    $('lq-readout').hidden = (panel !== 'cells');
    $('lq-aberr-note').hidden = (panel !== 'aberr');
  }

  document.querySelectorAll('[data-lq-panel]').forEach((b) => b.addEventListener('click', () => {
    panel = b.dataset.lqPanel;
    document.querySelectorAll('[data-lq-panel]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  $('lq-cell').addEventListener('change', draw);
  slider('lq-r', draw, (v) => Number(v).toFixed(3));
  draw();
}

/* =================================================================
 * Widget 5. Second cancers: why more dose is not always more cancer
 * Shuryak, Hahnfeldt, Hlatky, Sachs & Brenner,
 *   Radiat Environ Biophys 48(3):263-274 and 275-286 (2009)
 * ================================================================= */
export function cancerExplorer() {
  const chart = $('ca-chart');
  if (!chart) return;

  function draw() {
    const site = $('ca-site').value;
    const Tx = parseFloat($('ca-age').value);
    const Ty = parseFloat($('ca-fu').value);
    const dpf = parseFloat($('ca-dpf').value);      // dose per fraction
    const s = SITES[site];

    const D = seq(0.5, s.dmax, 90);
    const acute = D.map((d) => ERR(d, site, { Tx, Ty, K: 1 }));
    const frac  = D.map((d) => ERR(d, site, { Tx, Ty, K: Math.max(1, Math.round(d / dpf)) }));

    /* Linear no-threshold reference, anchored on the fractionated low-dose slope. */
    const lowD = 1, slope = ERR(lowD, site, { Tx, Ty, K: 1 }) / lowD;
    const lnt = D.map((d) => slope * d);

    /* Where does the fractionated curve peak? */
    let pi = 0; frac.forEach((v, i) => { if (v > frac[pi]) pi = i; });

    render(chart, {
      xlabel: 'Total radiation dose (Gy)', ylabel: 'Excess relative risk of a second cancer',
      ymin: 0,
      series: [
        { type: 'line', x: D, y: lnt, color: C.gray, dash: '6 4',
          label: 'Linear no-threshold extrapolation' },
        { type: 'line', x: D, y: acute, color: C.orange, dash: '3 3',
          label: 'Single acute dose (no repopulation)' },
        { type: 'line', x: D, y: frac, color: C.blue, width: 3,
          label: `Fractionated, ${dpf.toFixed(1)} Gy per fraction` },
        { type: 'marker', x: D[pi], y: frac[pi], color: C.blue, label: 'Peak risk' },
      ],
      caption: 'Excess relative risk of a radiation-induced second cancer against total dose.',
    });

    $('ca-peak').textContent = `${D[pi].toFixed(0)} Gy`;
    $('ca-peakerr').textContent = frac[pi].toFixed(2);
    $('ca-lnt').textContent = (slope * D[pi]).toFixed(1);
    $('ca-over').textContent = `${(slope * D[pi] / Math.max(frac[pi], 1e-9)).toFixed(1)}×`;
  }

  $('ca-site').addEventListener('change', draw);
  slider('ca-age', draw, (v) => `${Math.round(v)} y`);
  slider('ca-fu', draw, (v) => `${Math.round(v)} y`);
  slider('ca-dpf', draw, (v) => `${Number(v).toFixed(1)} Gy`);
  draw();
}

/* =================================================================
 * Widget 6. How life survives extreme radiation
 * Shuryak & Brenner, Radiat Environ Biophys (2010) and J Theor Biol 261 (2009)
 * Sharma, ..., Shuryak, ..., Daly, PNAS 114(44) (2017), Table 1
 * ================================================================= */
export function resistExplorer() {
  const chart = $('dr-chart');
  if (!chart) return;
  let panel = 'survival';

  function drawSurvival() {
    const k23 = parseFloat($('dr-k23').value);
    const D = seq(0, 20, 160);
    render(chart, {
      xlabel: 'Acute dose (kGy)', ylabel: 'Surviving fraction', ylog: true, ylim: [1e-5, 1.4],
      series: [
        { type: 'line', x: D, y: D.map((d) => drSurvival(d, 0)), color: C.gray, dash: '6 4',
          label: 'No inducible defense (plain exponential)' },
        { type: 'line', x: D, y: D.map((d) => drSurvival(d, k23)), color: C.blue, width: 3,
          label: `Antioxidant defense, k₂₃ = ${k23.toFixed(1)}` },
        { type: 'hline', at: 0.1, color: C.red, dash: '2 3', label: '10% survival (D₁₀)' },
      ],
      caption: 'Survival of Deinococcus radiodurans against acute dose, with and without the inducible antioxidant defense.',
    });
    $('dr-d10').textContent = `${drD10(k23).toFixed(1)} kGy`;
    $('dr-d10off').textContent = `${drD10(0).toFixed(2)} kGy`;
    $('dr-fold').textContent = `${(drD10(k23) / drD10(0)).toFixed(0)}×`;
  }

  function drawTree() {
    const x = logseq(4, 200, 80);
    const groups = [...new Set(ORGANISMS.map((o) => o.g))];
    render(chart, {
      xlabel: 'DNA double-strand breaks survived at D₁₀ (per genome), logarithmic',
      ylabel: 'Fraction of Mn²⁺ in antioxidant complexes (f_H)',
      xlim: [4, 200], xlog: true, ylim: [0, 1.05],
      series: [
        { type: 'line', x, y: x.map((v) => hill_fH(v)), color: C.gray, width: 2.4,
          label: `Published Hill law (n = ${HILL.n}, κ = ${HILL.kappa})` },
        ...groups.map((g) => ({
          type: 'points', color: GROUPS[g], label: g, r: 5,
          x: ORGANISMS.filter((o) => o.g === g).map((o) => o.dsb),
          y: ORGANISMS.filter((o) => o.g === g).map((o) => o.fH),
        })),
        /* D. radiodurans, its sodA⁻ knockout and D. geothermalis are tabulated identically,
           so they are one dot. Ring it, because that coincidence is the panel's point. */
        { type: 'marker', hollow: true, x: 118, y: 0.94, color: C.red,
          label: 'Ringed: D. radiodurans, its sodA⁻ knockout, and D. geothermalis (one point, identical)' },
      ],
      caption: 'Mn antioxidant content against DNA double-strand-break tolerance, across 21 organisms from bacteria to human cells.',
    });
  }

  function draw() {
    if (panel === 'survival') drawSurvival(); else drawTree();
    $('dr-k23-ctl').hidden = (panel !== 'survival');
    $('dr-readout').hidden = (panel !== 'survival');
    $('dr-tree-note').hidden = (panel !== 'tree');
    $('dr-surv-note').hidden = (panel !== 'survival');
  }

  document.querySelectorAll('[data-dr-panel]').forEach((b) => b.addEventListener('click', () => {
    panel = b.dataset.drPanel;
    document.querySelectorAll('[data-dr-panel]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  slider('dr-k23', draw, (v) => Number(v).toFixed(1));
  draw();
}

/* =================================================================
 * Widget 7. Radiopharmaceutical retention: compartments vs continuous rates
 * Shuryak & Dadachova, J Nucl Med 56(10):1622-1628 (2015)
 *
 * Every curve and every integral here is computed live in the browser from
 * the paper's model definitions and its Table 2 fitted parameters. The
 * paper's Table 3 integral column is NOT used: its SMSE entries cannot be
 * reproduced from the printed SMSE formula once physical decay is included
 * (they exceed the hard upper bound set by the Re-188 half-life), so the
 * honest thing is to recompute rather than to quote.
 * ================================================================= */
export function pkExplorer() {
  const chart = $('pk-chart');
  if (!chart) return;
  const on = new Set(['BE', 'SE', 'SSE']);

  function draw() {
    const tissue = $('pk-tissue').value;
    const t = logseq(1, 4000, 200);

    const series = [...on].map((m) => ({
      type: 'line', x: t, y: t.map((x) => pkRetention(x, tissue, m)),
      color: PK_MODELS[m].color, width: PK_MODELS[m].kind === 'continuous' ? 2.8 : 2.2,
      dash: PK_MODELS[m].kind === 'discrete' ? '6 4' : null,
      label: `${PK_MODELS[m].label}${PK[tissue][m].w >= 0.2 ? ' ★' : ''}`,
    }));

    render(chart, {
      xlabel: 'Time after injection (min), logarithmic',
      ylabel: 'Retained fraction (with physical decay)',
      xlim: [1, 4000], xlog: true, ylog: true, ylim: [1e-3, 1.2],
      series,
      caption: 'Radiopharmaceutical retention against time, discrete-compartment versus continuous-rate models.',
    });

    const be = pkIntegral(tissue, 'BE');
    const avg = pkModelAveragedRatio(tissue);
    const best = Object.keys(PK_MODELS).reduce((a, b) => PK[tissue][b].w > PK[tissue][a].w ? b : a);
    $('pk-be').textContent = `${Math.round(be)} min`;
    $('pk-avg').textContent = `${avg.toFixed(2)}×`;
    $('pk-best').textContent = PK_MODELS[best].label.replace(/ \(.*\)/, '');
    $('pk-gap').textContent = `${((avg - 1) * 100).toFixed(0)}%`;
  }

  document.querySelectorAll('[data-pk-model]').forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.pkModel;
    if (on.has(m)) { if (on.size > 1) on.delete(m); } else on.add(m);
    b.setAttribute('aria-pressed', String(on.has(m)));
    draw();
  }));
  $('pk-tissue').addEventListener('change', draw);
  draw();
}

/* =================================================================
 * Widget 8. What is one CT scan actually worth?
 * Brenner, Shuryak & Einstein, Radiology 261(1):193-198 (2011)
 * ================================================================= */
export function ctExplorer() {
  const chart = $('ct-chart');
  if (!chart) return;

  function draw() {
    const key = $('ct-scenario').value;
    const s = LE_SCENARIOS.find((x) => x.key === key);
    const adj = 100 * (1 - s.reduction);

    render(chart, {
      xlabel: '', ylabel: 'Lifetime radiation-associated cancer risk (%)',
      xlim: [-0.6, 1.6], ylim: [0, 118],
      xticks: [{ at: 0, label: 'Nominal estimate' }, { at: 1, label: 'This patient' }],
      series: [
        { type: 'bar', x: [0], y: [100], color: C.gray, bw: 0.5, text: ['100%'],
          label: 'Nominal: ignores life expectancy' },
        { type: 'bar', x: [1], y: [adj], color: C.blue, bw: 0.5, text: [`${adj.toFixed(0)}%`],
          label: 'Adjusted for realistic remaining life' },
      ],
      caption: 'Lifetime radiation-associated cancer risk, nominal versus adjusted for the patient\'s realistic remaining life expectancy.',
    });

    $('ct-red').textContent = `${(s.reduction * 100).toFixed(0)}%`;
    $('ct-left').textContent = `${adj.toFixed(0)}%`;
    $('ct-age').textContent = `${s.age} years`;
    $('ct-note').textContent = s.note;
  }
  $('ct-scenario').addEventListener('change', draw);
  draw();
}
