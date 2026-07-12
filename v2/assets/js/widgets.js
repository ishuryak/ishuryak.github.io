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
          label: 'Incremental effect additivity (IEA): the correct theory' },
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

  function draw() {
    const shape = document.querySelector('[data-cast-shape][aria-pressed=true]').dataset.castShape;
    const conf = parseFloat($('cast-conf').value);
    /* Snap to the nearest precomputed confounding level. */
    const level = data.conf_grid.reduce((a, b) =>
      Math.abs(b - conf) < Math.abs(a - conf) ? b : a);
    const key = `${shape}_conf${level.toFixed(2)}`;
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
