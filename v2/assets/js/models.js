/* Published model implementations.
   Every constant below is transcribed from a published, peer-reviewed paper. The source
   for each is recorded in v2/PROVENANCE.md. */

/* ------------------------------------------------------------------ *
 * Mechanistic biologically effective dose (BED), head and neck cancer
 *
 * Equations: Shuryak I, Wang E, Brenner DJ. Front Oncol 14:1422211 (2024).
 *   BED_simp = m*d*(1 + d/r)
 *   BED_DI   = [ m*a*d*(d + r)/r  -  g*T  -  L*max(0, T - Tk) ] / a
 * Parameters: Shuryak I, Hall EJ, Brenner DJ. Radiother Oncol (2018), Table 2.
 *
 * The repopulation term is the published hard hinge, max(0, T - Tk).
 * ------------------------------------------------------------------ */
export const BED = {
  ab: 10.0,          // alpha/beta, Gy. Fixed at 10 Gy in all three papers.
  alpha: 0.069,      // Gy^-1. 2018 Table 2, dose-independent model (95% CI 0.065-0.075).
  lambda: 0.035,     // day^-1. Max repopulation rate (95% CI 0.028-0.049).
  Tk: 28.6,          // days. Repopulation onset (95% CI 26.7-31.9).
  g: 0.0154,         // day^-1. Background growth. Fixed.
  TkCI: [26.7, 31.9],
  abRange: [7, 13],  // Sensitivity range explored in the 2024 paper.
};

export const bedSimple = (m, d, ab = BED.ab) => m * d * (1 + d / ab);

export function bedDI(m, d, T, p = {}) {
  const ab = p.ab ?? BED.ab, a = p.alpha ?? BED.alpha;
  const L = p.lambda ?? BED.lambda, Tk = p.Tk ?? BED.Tk, g = p.g ?? BED.g;
  return (m * a * d * (d + ab) / ab - g * T - L * Math.max(0, T - Tk)) / a;
}

/* Overall treatment time for a conventional 5-fraction week. */
export const scheduleDays = (m, fxPerWeek = 5) =>
  (Math.ceil(m / fxPerWeek) - 1) * 7 + ((m - 1) % fxPerWeek) + 1;

/* ------------------------------------------------------------------ *
 * Targeted + non-targeted effects, high-LET radiation
 *
 * Shuryak I, Sachs RK, Brenner DJ. Sci Rep 11:23467 (2021).
 * Endpoint: Apc(1638N/+) mouse intestinal tumorigenesis.
 *
 *   Eq. 1   M      = B + N*(1 - exp[-s*D]) + T*D
 *   Eq. 4   mu_rad = [N*(1 - exp[-s*D]) + T*D] * (1 + q*(1+r)) / (1 + q)
 *   Eq. 12  RER(I) = mu_rad(D, I) / mu_rad(D, gamma)
 *           RBE    = ratio of iso-effective doses (no closed form; solved numerically)
 *
 * B and q are NOT free parameters: they are derived from the fitted variance
 * parameter r via Eqs. 8-11, using the observed control-mouse background.
 * ------------------------------------------------------------------ */
export const S_NTE = 38.66;        // Gy^-1, common to all radiation types (95% CI 38.34-38.98).
export const MU_BAC = 3.279;       // Mean background tumors/mouse, 68 control mice.

/* Table 1: T (Gy^-1), N, r, LET (keV/um). T and r are shared across gamma/H/He/C/O. */
export const IONS = {
  gamma: { label: 'γ rays',   T: 2.77, N: 0.62, r: 0.047, let: null, color: '#6b7a88' },
  H:     { label: 'H (proton)', T: 2.77, N: 0.89, r: 0.047, let: 0.22, color: '#0f8b9e' },
  He:    { label: '⁴He',       T: 2.77, N: 1.34, r: 0.047, let: 1.57, color: '#1b7f5c' },
  C:     { label: '¹²C',       T: 2.77, N: 2.87, r: 0.047, let: 13,   color: '#b8860b' },
  O:     { label: '¹⁶O',       T: 2.77, N: 2.68, r: 0.047, let: 22,   color: '#e07b39' },
  Si:    { label: '²⁸Si',      T: 8.52, N: 3.58, r: 0.208, let: 69,   color: '#c0392b' },
  Fe:    { label: '⁵⁶Fe',      T: 4.74, N: 3.34, r: 0.107, let: 148,  color: '#7b52ab' },
};

/* Eq. 8-11: q and B derived from r. */
const qOf = (r) => 500 * (1 - Math.exp(-Math.exp((1.33 + 26.85 * r - 20.95 * r * r + 1843.14 * r ** 3) / 500)));
const weight = (r) => { const q = qOf(r); return (1 + q * (1 + r)) / (1 + q); };

/** Excess (radiation-induced) tumors per mouse, Eq. 4. This is the plotted quantity. */
export function muRad(D, ion) {
  const { T, N, r } = IONS[ion];
  return (N * (1 - Math.exp(-S_NTE * D)) + T * D) * weight(r);
}
/** Derivative, needed for the IEA synergy ODE. */
export function dMuRad(D, ion) {
  const { T, N, r } = IONS[ion];
  return (N * S_NTE * Math.exp(-S_NTE * D) + T) * weight(r);
}
/** Inverse: the dose of `ion` producing excess yield I. muRad is monotone increasing. */
export function invMuRad(I, ion, hi = 10) {
  let lo = 0;
  /* Grow the bracket until it actually contains the root. A fixed bracket silently
     saturates at hi (returning hi, not the inverse) for any I above muRad(hi, ion). */
  while (muRad(hi, ion) < I && hi < 1e6) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (muRad(mid, ion) < I) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Radiation effects ratio: same dose, ratio of excess yields (Eq. 12). */
export const RER = (D, ion) => muRad(D, ion) / muRad(D, 'gamma');

/** Relative biological effectiveness: ratio of iso-effective doses.
 *  Solved numerically (the closed form requires the Lambert W function). */
export function RBE(D, ion) {
  if (ion === 'gamma' || D <= 0) return 1;
  const target = muRad(D, ion);
  const dGamma = invMuRad(target, 'gamma', 100);
  return dGamma / D;
}

/* Mars-mission-relevant ion mixture (Sci Rep 2021, from Kim et al.), doses in Gy. */
export const MARS_MIX = { H: 0.311, He: 0.109, C: 0.029, O: 0.029, Si: 0.022, Fe: 0.019 };
export const MARS_TOTAL = Object.values(MARS_MIX).reduce((a, b) => a + b, 0); // 0.519 Gy

/** Simple effect additivity: just add each component's effect. Wrong unless every
 *  component's dose response is linear-no-threshold. */
export function SEA(totalDose) {
  const f = totalDose / MARS_TOTAL;
  return Object.entries(MARS_MIX).reduce((sum, [ion, d]) => sum + muRad(d * f, ion), 0);
}

const ieaSlope = (() => {
  const frac = Object.fromEntries(Object.entries(MARS_MIX).map(([k, v]) => [k, v / MARS_TOTAL]));
  const entries = Object.entries(frac);
  return (I) => entries.reduce((s, [ion, f]) => s + f * dMuRad(invMuRad(I, ion), ion), 0);
})();

/** One classical RK4 step of dI/dD = sum_i f_i * mu_i'(mu_i^-1(I)). */
const ieaStep = (I, h) => {
  const k1 = ieaSlope(I), k2 = ieaSlope(I + h * k1 / 2),
        k3 = ieaSlope(I + h * k2 / 2), k4 = ieaSlope(I + h * k3);
  return I + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
};

/** Incremental effect additivity: excess tumors/mouse at one total mixture dose.
 *  Reproduces the published value of 4.74 excess tumors/mouse at 0.519 Gy. */
export function IEA(totalDose, steps = 120) {
  let I = 0;
  const h = totalDose / steps;
  for (let k = 0; k < steps; k++) I = ieaStep(I, h);
  return I;
}

/** IEA sampled along an ascending dose grid. The ODE is integrated ONCE across the whole
 *  grid and read off at each node, rather than re-integrated from zero per node, which is
 *  what makes the mixture panel plottable at interactive speed.
 *
 *  Step size is capped at H_MAX so accuracy does not depend on how finely the caller spaced
 *  the grid: a coarse grid subdivides rather than taking one long, inaccurate step. */
const H_MAX = 0.0015;                       // Gy
export function IEACurve(grid, minStepsPerNode = 8) {
  let I = 0, D = 0;
  return grid.map((target) => {
    const span = target - D;
    const n = Math.max(minStepsPerNode, Math.ceil(Math.abs(span) / H_MAX));
    const h = span / n;
    for (let k = 0; k < n; k++) I = ieaStep(I, h);
    D = target;
    return I;
  });
}

/* ------------------------------------------------------------------ *
 * Radiopharmaceutical retention: discrete compartments vs continuous
 * distributions of rates.
 *
 * Shuryak I, Dadachova E. J Nucl Med 56(10):1622-1628 (2015).
 * Re-188-labeled melanin-binding antibody in melanoma-xenograft mice.
 * Retention is normalized to the 5-minute timepoint, so t = T - 5 min,
 * and physical decay is carried explicitly by g(t).
 *
 *   g(t) = exp[-(ln2 / tau0) * t],  tau0 = 1014 min (Re-188 half-life)
 *
 * Three discrete-rate models (ME, MEC, BE) and four continuous-distribution
 * models (SE, MSE, SSE, SMSE). The largest number of exponentials anywhere
 * in the paper is TWO. It never fits five.
 * ------------------------------------------------------------------ */
export const TAU0 = 1014;                                   // min
const decay = (t) => Math.exp(-(Math.LN2 / TAU0) * t);

/* Table 2: fitted parameters and Akaike weights, per tissue.
   The paper's tabulated time-integral column is deliberately not transcribed. Every integral
   shown on the site is recomputed from these parameters by pkIntegral(). */
export const PK = {
  blood:  { label: 'Blood',
    ME:{w:0.000,tau1:119},  MEC:{w:0.000,w1:0.73,tau2:55.8},
    BE:{w:0.076,w2:0.50,tau3:29.5,tau4:442},
    SE:{w:0.263,tau5:143,g1:0.44}, MSE:{w:0.231,tau6:6.8,g2:0.23},
    SSE:{w:0.431,tau7:138}, SMSE:{w:0.000,tau8:40.5} },
  kidneys:{ label: 'Kidneys',
    ME:{w:0.009,tau1:509},  MEC:{w:0.421,w1:0.79,tau2:354},
    BE:{w:0.123,w2:0.72,tau3:323,tau4:6091},
    SE:{w:0.041,tau5:754,g1:0.70}, MSE:{w:0.140,tau6:140,g2:0.38},
    SSE:{w:0.008,tau7:1143}, SMSE:{w:0.256,tau8:210} },
  liver:  { label: 'Liver',
    ME:{w:0.000,tau1:406},  MEC:{w:0.386,w1:0.80,tau2:289},
    BE:{w:0.191,w2:0.64,tau3:227,tau4:2844},
    SE:{w:0.071,tau5:660,g1:0.61}, MSE:{w:0.279,tau6:81,g2:0.32},
    SSE:{w:0.031,tau7:821}, SMSE:{w:0.042,tau8:165} },
  marrow: { label: 'Bone marrow',
    ME:{w:0.363,tau1:1354}, MEC:{w:0.111,w1:0.93,tau2:1205},
    BE:{w:0.029,w2:1.00,tau3:1354,tau4:Infinity},
    SE:{w:0.110,tau5:1332,g1:1.03}, MSE:{w:0.109,tau6:1241,g2:0.94},
    SSE:{w:0.007,tau7:3729}, SMSE:{w:0.271,tau8:525} },
  lungs:  { label: 'Lungs',
    ME:{w:0.000,tau1:202},  MEC:{w:0.000,w1:0.88,tau2:158},
    BE:{w:0.274,w2:0.46,tau3:40.8,tau4:730},
    SE:{w:0.184,tau5:247,g1:0.48}, MSE:{w:0.024,tau6:19.4,g2:0.27},
    SSE:{w:0.518,tau7:244}, SMSE:{w:0.000,tau8:70.6} },
};

export const PK_MODELS = {
  ME:  { label: 'Mono-exponential (1 compartment)',   kind: 'discrete',   color: '#6b7a88' },
  MEC: { label: 'Mono-exponential + constant',        kind: 'discrete',   color: '#b8860b' },
  BE:  { label: 'Bi-exponential (2 compartments)',    kind: 'discrete',   color: '#c0392b' },
  SE:  { label: 'Stretched exponential',              kind: 'continuous', color: '#0a4d8c' },
  MSE: { label: 'Modified stretched exponential',     kind: 'continuous', color: '#0f8b9e' },
  SSE: { label: 'Simplified stretched exponential',   kind: 'continuous', color: '#1b7f5c' },
  SMSE:{ label: 'Simplified modified stretched exp.', kind: 'continuous', color: '#7b52ab' },
};

/** Retention fraction at time t (min), including physical decay. */
export function pkRetention(t, tissue, model) {
  const p = PK[tissue][model];
  let f;
  switch (model) {
    case 'ME':   f = Math.exp(-t / p.tau1); break;
    case 'MEC':  f = p.w1 * Math.exp(-t / p.tau2) + (1 - p.w1); break;
    case 'BE':   f = p.w2 * Math.exp(-t / p.tau3) + (1 - p.w2) * Math.exp(-t / p.tau4); break;
    case 'SE':   f = Math.exp(-Math.pow(t / p.tau5, p.g1)); break;
    case 'MSE':  f = Math.exp(1 - Math.pow(1 + t / p.tau6, p.g2)); break;
    case 'SSE':  f = Math.exp(-Math.sqrt(t / p.tau7)); break;
    case 'SMSE': f = Math.exp(1 - Math.sqrt(1 + t / p.tau8)); break;
  }
  return decay(t) * f;
}

/** Time integral of the retention curve (proportional to absorbed dose).
 *  Simpson's rule to 30000 min, by which point physical decay has removed
 *  everything (about 30 half-lives). */
export function pkIntegral(tissue, model, T = 30000, n = 6000) {
  const h = T / n;
  let s = pkRetention(0, tissue, model) + pkRetention(T, tissue, model);
  for (let i = 1; i < n; i++) s += pkRetention(i * h, tissue, model) * (i % 2 ? 4 : 2);
  return s * h / 3;
}

/** Akaike-weighted, model-averaged time integral, as a ratio to the bi-exponential.
 *  The paper calls this MNTI. */
export function pkModelAveragedRatio(tissue) {
  const be = pkIntegral(tissue, 'BE');
  let acc = 0;
  for (const m of Object.keys(PK_MODELS)) acc += PK[tissue][m].w * (pkIntegral(tissue, m) / be);
  return acc;
}

/* ------------------------------------------------------------------ *
 * Overdispersion of lethal lesions in the linear-quadratic model
 *
 * Shuryak I, Cornforth MN. Int J Radiat Biol 97(1):50-59 (2021), Eqs. 1 & 6.
 *
 *   mu    = alpha*D + beta*D^2                 mean lethal lesions per cell
 *   SF_NB = 1 / [1 + mu*r]^(1/r)               overdispersed (negative binomial)
 *   r -> 0 recovers the classical Poisson LQ:  SF = exp(-mu)
 *
 * A negative binomial arises when the Poisson mean is itself gamma-distributed,
 * i.e. when radiosensitivity varies between cells. r is the heterogeneity.
 * ------------------------------------------------------------------ */
export const CELLS = {
  DU145:  { label: 'DU145 (prostate)',  nb:{a:0.16,b:0.028,r:0.126}, pois:{a:0.22,b:0.012}, dmax:8 },
  U373MG: { label: 'U373MG (glioma)',   nb:{a:0.08,b:0.047,r:0.241}, pois:{a:0.16,b:0.020}, dmax:8 },
  CHOAA8: { label: 'CHO AA8 (hamster)', nb:{a:0.18,b:0.019,r:0.000}, pois:{a:0.18,b:0.018}, dmax:8 },
  CP3:    { label: 'CP3 (prostate)',    nb:{a:0.00,b:0.075,r:0.069}, pois:{a:0.14,b:0.044}, dmax:8 },
};
/* Cytogenetic estimates of r (Shuryak, Loucas & Cornforth, Front Oncol 7:318, 2017). */
export const R_LYMPHOCYTES = { est: 0.138, lo: 0.020, hi: 0.301 };

export const survivalNB = (D, a, b, r) => {
  const mu = a * D + b * D * D;
  return r <= 1e-9 ? Math.exp(-mu) : Math.pow(1 + mu * r, -1 / r);
};
export const survivalPoisson = (D, a, b) => Math.exp(-(a * D + b * D * D));

/* ------------------------------------------------------------------ *
 * Chromosome aberrations: gamma rays vs iron ions
 * Cornforth M, Shuryak I, Loucas B. Transl Cancer Res (2017).
 * Fraction of human lymphocytes free of lethal aberrations, Y = c + a*D + b*D^2.
 * Iron is purely exponential (beta = 0); gamma rays are curved.
 * ------------------------------------------------------------------ */
export const ABERRATION = {
  gamma: { label: 'γ rays (¹³⁷Cs)',            a: 0.15, b: 0.073, ea: 0.01, eb: 0.004, color: '#6b7a88' },
  Fe:    { label: '⁵⁶Fe ions (150 keV/µm)',    a: 0.64, b: 0.00,  ea: 0.07, eb: 0.05,  color: '#7b52ab' },
};
export const aberrationFree = (D, k) =>
  Math.exp(-(ABERRATION[k].a * D + ABERRATION[k].b * D * D));

/* ------------------------------------------------------------------ *
 * Radiation resistance
 *
 * (a) Acute survival of Deinococcus radiodurans.
 *     Shuryak I, Brenner DJ. Radiat Environ Biophys (2010), Eq. 3 (closed form);
 *     parameters from Shuryak I, Brenner DJ. J Theor Biol 261(2):305-317 (2009).
 *
 *       S = exp( -c8 * D * exp[ -k23 * exp(-k1 * D) ] )        D in kGy
 *       k1  = c1*c7/c3     k23 = c5*c9*T_rep/c6
 *
 *     k23 is the inducible antioxidant defense. Set it to zero and survival
 *     collapses to a plain exponential: the shoulder IS the defense.
 *
 *     Colonies form as tetrads and diads (75:25), so the colony-forming
 *     survival is  S_cfu = 0.75*(1-(1-S)^4) + 0.25*(1-(1-S)^2).
 * ------------------------------------------------------------------ */
export const DR = {
  c8: 10.0,     // DSB per cell per kGy
  c1: 1.0e6, c3: 1.0, c5: 0.1, c6: 0.075, c7: 5.8e-8, c9: 1.5, Trep: 4.0,
};
DR.k1  = DR.c1 * DR.c7 / DR.c3;          // 0.058 /kGy
DR.k23 = DR.c5 * DR.c9 * DR.Trep / DR.c6; // 8.0, dimensionless

export const drSurvival = (D, k23 = DR.k23, k1 = DR.k1) =>
  Math.exp(-DR.c8 * D * Math.exp(-k23 * Math.exp(-k1 * D)));

export const drColony = (D, k23 = DR.k23) => {
  const S = drSurvival(D, k23);
  return 0.75 * (1 - Math.pow(1 - S, 4)) + 0.25 * (1 - Math.pow(1 - S, 2));
};

/** Dose giving 10% survival, by bisection. */
export function drD10(k23 = DR.k23, useColony = false) {
  const f = (D) => (useColony ? drColony(D, k23) : drSurvival(D, k23)) - 0.1;
  let lo = 0, hi = 60;
  if (f(hi) > 0) return hi;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/* (b) One law across the tree of life.
 *     Sharma A, Gaidamakova EK, ... Shuryak I, ... Daly MJ. PNAS 114(44) (2017), Table 1.
 *
 *       DSB_D10 = D10(Gy) * DSB_yield(DSB/Mbp/Gy) * genome(Mbp)
 *       f_H     = kappa * DSB_D10^n / [1 + kappa * DSB_D10^n]      (Eq. 3a)
 *
 *     f_H is the fraction of cellular Mn(II) held in small-molecule antioxidant
 *     complexes, measured by electron paramagnetic resonance.
 *     Fitted (SI Fig. S7): n = 1.5, kappa = 0.01 for Eq. 3a;
 *     n = 1.7 +/- 0.2, log10(kappa) = -2.1 +/- 0.3 for the linearised Eq. 3b.
 *     Regression R^2 = 0.78; Pearson r = 0.883 (p = 5.50e-7).
 */
export const HILL = { n: 1.5, kappa: 0.01, n3b: 1.7, r2: 0.78, pearson: 0.883 };
export const hill_fH = (dsb, n = HILL.n, k = HILL.kappa) => {
  const x = k * Math.pow(dsb, n);
  return x / (1 + x);
};

/* Table 1, all 21 rows. D10 in kGy as tabulated. */
export const ORGANISMS = [
  { g:'Bacteria',   name:'Deinococcus radiodurans',        short:'Dr',        dsb:118, d10:12.0, fH:0.94 },
  { g:'Bacteria',   name:'D. radiodurans sodA⁻ (SOD-KO)',  short:'Dr sodA⁻',  dsb:118, d10:12.0, fH:0.94 },
  { g:'Bacteria',   name:'Deinococcus geothermalis',       short:'Dg',        dsb:118, d10:12.0, fH:0.94 },
  { g:'Bacteria',   name:'Deinococcus ficus',              short:'Df',        dsb:84,  d10:7.0,  fH:0.97 },
  { g:'Bacteria',   name:'Rubrobacter xylanophilus',       short:'Rx',        dsb:59,  d10:6.0,  fH:0.97 },
  { g:'Bacteria',   name:'Acinetobacter radioresistens',   short:'Ar',        dsb:48,  d10:5.0,  fH:0.70 },
  { g:'Bacteria',   name:'Enterococcus faecium',           short:'Ef',        dsb:18,  d10:2.0,  fH:0.81 },
  { g:'Bacteria',   name:'Escherichia coli K-12',          short:'Ec',        dsb:6,   d10:0.7,  fH:0.17 },
  { g:'Bacteria',   name:'Pseudomonas putida',             short:'Pp',        dsb:5,   d10:0.3,  fH:0.13 },
  { g:'Human',      name:'Jurkat T4 human cells',          short:'JT',        dsb:72,  d10:0.004,fH:0.95 },
  { g:'Archaea',    name:'Halobacterium salinarum',        short:'Hs',        dsb:39,  d10:5.0,  fH:0.95 },
  { g:'Archaea',    name:'Haloferax volcanii',             short:'Hv',        dsb:18,  d10:1.5,  fH:0.84 },
  { g:'Yeast',      name:'S. cerevisiae EXF-6761',         short:'6761',      dsb:32,  d10:3.5,  fH:0.51 },
  { g:'Yeast',      name:'S. cerevisiae EXF-5735',         short:'5735',      dsb:20,  d10:2.6,  fH:0.30 },
  { g:'Yeast',      name:'S. cerevisiae FY1679',           short:'1679',      dsb:20,  d10:2.4,  fH:0.26 },
  { g:'Yeast',      name:'Rhodotorula taiwanensis',        short:'Rt',        dsb:16,  d10:0.8,  fH:0.35 },
  { g:'Yeast',      name:'S. cerevisiae BY4741',           short:'4741',      dsb:10,  d10:1.0,  fH:0.21 },
  { g:'Yeast',      name:'S. cerevisiae BY4741 sod1⁻',     short:'sod1⁻',     dsb:10,  d10:1.4,  fH:0.21 },
  { g:'Yeast',      name:'S. cerevisiae BY4741 sod2⁻',     short:'sod2⁻',     dsb:10,  d10:1.1,  fH:0.21 },
  { g:'Yeast',      name:'S. cerevisiae EXF-6219',         short:'6219',      dsb:7,   d10:0.8,  fH:0.23 },
  { g:'Yeast',      name:'S. cerevisiae EXF-6218',         short:'6218',      dsb:8,   d10:0.8,  fH:0.20 },
];
export const GROUPS = {
  Bacteria: '#0a4d8c', Human: '#c0392b', Archaea: '#1b7f5c', Yeast: '#b8860b',
};

/* ------------------------------------------------------------------ *
 * Radiation carcinogenesis: initiation, promotion, cell killing, repopulation
 *
 * Shuryak I, Hahnfeldt P, Hlatky L, Sachs RK, Brenner DJ.
 *   Radiat Environ Biophys 48(3):263-274 (Part I) and 48(3):275-286 (Part II), 2009.
 *
 *   ERR = (Q1*Q2 + Q3)/Q4 - 1
 *   Q1  = (1 + Y*D) / [1 + Y*D*(1 - exp(-delta*Ty))]            promotion
 *   Q2  = [(exp(b*Tx) - 1)*Sf(Z,D) + b*X*ISf(D)] * exp(b*Ty)    initiation + niche survival
 *   Q3  = exp(b*Ty) - 1 ;   Q4 = exp(b*(Tx + Ty)) - 1
 *
 * Acute exposure (Part II):
 *   Sf(Z,D)  = 1 - (1 - exp(-a*D - b*D^2))^Z
 *   ISf(D)   = D * exp(-a*D - b*D^2)
 *
 * Fractionated exposure (Part I, Eqs. 7-11, 16-17, 22): normal and pre-malignant
 * stem cells repopulate logistically between fractions, dn/dt = lambda*n*(1 - n/m),
 * which is what pushes the risk peak out to therapeutic doses. With m normalized to 1:
 *   n_plus(k)  = S * n_minus(k),          S = exp(-a*d - b*d^2)
 *   n_minus(k+1) = logistic regrowth of n_plus(k) over the interfraction gap
 *   I(k)  = d * n_plus(k)
 *   F(k)  = 1 / { n_plus(k) * [1 + SUM_{j=k..K} (n_minus(j+1) - n_plus(j))
 *                                              / (n_minus(j+1) * n_plus(j))] }
 *   ISf   = SUM_k I(k)*F(k) ;   Sf = 1 - (1 - F(0))^Z
 * With K = 1 this reduces exactly to the acute expressions above, which is the
 * check used in the test suite.
 * ------------------------------------------------------------------ */
export const SITES = {
  lung:    { label:'Lung',    X:0.860, Y:0.387, delta:9.49e-3, Z:10**4.99, alpha:0.25, beta:0.025, lam:0.05, b:0.460,  dmax:60 },
  breast:  { label:'Breast',  X:4.75,  Y:0.938, delta:3.05e-3, Z:10**6.65, alpha:0.25, beta:0.050, lam:0.05, b:0.199,  dmax:60 },
  thyroid: { label:'Thyroid', X:34.4,  Y:0.237, delta:0.0156e-3, Z:10**4.03, alpha:0.30, beta:0.030, lam:0.05, b:0.0768, dmax:60 },
  stomach: { label:'Stomach', X:6.53,  Y:0.120, delta:0.206e-3, Z:10**3.58, alpha:0.25, beta:0.025, lam:0.05, b:0.222,  dmax:60 },
  bladder: { label:'Bladder', X:0.151, Y:0.626, delta:1.68e-3, Z:10**1.96, alpha:0.25, beta:0.025, lam:0.05, b:0.282,  dmax:60 },
};

/** Treatment day of fraction k (1-indexed), 5 fractions per week. */
const fxDay = (k) => Math.floor((k - 1) / 5) * 7 + ((k - 1) % 5);

/** Sf and ISf for K fractions of dose d. K = 1 gives the acute case. */
export function fractionated(D, s, K = 1) {
  const d = D / K;
  const S = Math.exp(-s.alpha * d - s.beta * d * d);
  const m = 1;
  const nMinus = new Array(K + 2).fill(m);   // n_minus(1..K+1); n_minus(K+1) = m
  const nPlus  = new Array(K + 1).fill(m);   // n_plus(0..K); n_plus(0) = m
  nMinus[1] = m;
  for (let k = 1; k <= K; k++) {
    nPlus[k] = S * nMinus[k];
    if (k < K) {
      const gapDays = fxDay(k + 1) - fxDay(k);
      const n0 = nPlus[k];
      /* Exact solution of the logistic ODE from n0 over the gap. */
      nMinus[k + 1] = n0 * m / (n0 + (m - n0) * Math.exp(-s.lam * gapDays));
    }
  }
  nMinus[K + 1] = m;                          // full recovery after treatment ends

  const F = new Array(K + 1).fill(1);
  for (let k = 0; k <= K; k++) {
    let sum = 0;
    for (let j = Math.max(k, 1); j <= K; j++) {
      sum += (nMinus[j + 1] - nPlus[j]) / (nMinus[j + 1] * nPlus[j]);
    }
    F[k] = 1 / (nPlus[k] * (1 + sum));
  }
  let ISf = 0;
  for (let k = 1; k <= K; k++) ISf += d * nPlus[k] * F[k];
  const Sf = 1 - Math.pow(1 - F[0], s.Z);
  return { Sf, ISf };
}

/** Excess relative risk of a second cancer. Tx = age at exposure, Ty = years since. */
export function ERR(D, siteKey, { Tx = 30, Ty = 25, K = 1 } = {}) {
  const s = SITES[siteKey];
  if (D <= 0) return 0;
  const { Sf, ISf } = fractionated(D, s, K);
  const Q1 = (1 + s.Y * D) / (1 + s.Y * D * (1 - Math.exp(-s.delta * Ty)));
  const Q2 = ((Math.exp(s.b * Tx) - 1) * Sf + s.b * s.X * ISf) * Math.exp(s.b * Ty);
  const Q3 = Math.exp(s.b * Ty) - 1;
  const Q4 = Math.exp(s.b * (Tx + Ty)) - 1;
  return (Q1 * Q2 + Q3) / Q4 - 1;
}

/* ------------------------------------------------------------------ *
 * Life-expectancy-adjusted risk from medical radiation
 *
 * Brenner DJ, Shuryak I, Einstein AJ. Impact of reduced patient life expectancy
 * on potential cancer risks from radiologic imaging. Radiology 261(1):193-198 (2011).
 *
 * The published quantity is a RATIO:
 *   R = lifetime risk for this patient / lifetime risk for a healthy person of the
 *       same age and sex, using empirical life tables (not a closed-form survival
 *       model, so there is nothing to re-derive here).
 * Dose and the dose-and-dose-rate effectiveness factor cancel out of R entirely,
 * which is why the result is a pure percentage.
 *
 * These are the published scenarios. Nothing is interpolated between them.
 * ------------------------------------------------------------------ */
export const LE_SCENARIOS = [
  { key:'colon4',  group:'Colon cancer, stage IV',      age:70, reduction:0.92,
    note:'A 70-year-old with metastatic colon cancer.' },
  { key:'colon0',  group:'Colon cancer, stage 0 or I',  age:70, reduction:0.08,
    note:'A 70-year-old with early, curable colon cancer.' },
  { key:'cabg55',  group:'After coronary bypass',       age:55, reduction:0.57,
    note:'A 55-year-old having coronary CT angiography after bypass surgery.' },
  { key:'cabg75',  group:'After coronary bypass',       age:75, reduction:0.12,
    note:'A 75-year-old having the same scan.' },
];
/* The one point estimate the paper prints with a confidence interval. */
export const LE_R65 = { R: 0.58, lo: 0.52, hi: 0.64,
  note: '65-year-old after coronary bypass, having coronary CT angiography' };
