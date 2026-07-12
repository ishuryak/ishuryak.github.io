# Provenance

Every equation, default parameter, and quoted number on this site is taken from a published,
peer-reviewed paper or an already-public artifact. No unpublished result and no patient-level
data appears anywhere on this site.

Each explorable below is listed against the paper supplying its equations and each of its
default parameters.

## Explorable 1. Fractionation and biologically effective dose

**Equations.** Shuryak I, Wang E, Brenner DJ. Understanding the impact of radiotherapy
fractionation on overall survival in a large head and neck squamous cell carcinoma dataset.
*Front Oncol* 14:1422211 (2024). doi:10.3389/fonc.2024.1422211, Section 2.3.

**Parameters.** Shuryak I, Hall EJ, Brenner DJ. Dose dependence of accelerated repopulation
in head and neck cancer. *Radiother Oncol* (2018). PMID 29534828, Table 2.

| Symbol | Value | Note |
|---|---|---|
| α | 0.069 Gy⁻¹ (95% CI 0.065, 0.075) | dose-independent repopulation model |
| λ | 0.035 day⁻¹ (95% CI 0.028, 0.049) | maximum repopulation rate |
| T_k | 28.6 days (95% CI 26.7, 31.9) | repopulation onset, with the slider limited to this interval |
| α/β | 10 Gy (fixed) | slider spans the 7 to 13 Gy sensitivity range of the 2024 paper |
| g | 0.0154 day⁻¹ (fixed) | background growth |

The repopulation term is the published hard hinge `max(0, T − T_k)`.

## Explorable 2. Targeted and non-targeted effects in high-LET radiation

**Equations and all parameters.** Shuryak I, Sachs RK, Brenner DJ. Quantitative modeling of
carcinogenesis induced by single beams or mixtures of space radiations using targeted and
non-targeted effects. *Sci Rep* 11:23467 (2021). doi:10.1038/s41598-021-02883-y.
Model from Eqs. 1, 4, 12 and 14. Parameters from Table 1. Mixture composition from the
paper's reference 1 (Kim et al.).

Endpoint: intestinal tumorigenesis in Apc(1638N/+) mice.

| Radiation | LET (keV/µm) | T (Gy⁻¹) | N | r |
|---|---|---|---|---|
| γ | n/a | 2.77 (2.47, 3.04) | 0.62 (0.33, 0.87) | 0.047 (0.021, 0.077) |
| H | 0.22 | 2.77 shared | 0.89 (0.58, 1.18) | 0.047 |
| ⁴He | 1.57 | 2.77 shared | 1.34 (1.08, 1.62) | 0.047 |
| ¹²C | 13 | 2.77 shared | 2.87 (2.56, 3.20) | 0.047 |
| ¹⁶O | 22 | 2.77 shared | 2.68 (2.34, 2.94) | 0.047 |
| ²⁸Si | 69 | 8.52 (8.20, 8.85) | 3.58 (3.28, 3.90) | 0.208 (0.143, 0.301) |
| ⁵⁶Fe | 148 | 4.74 (4.42, 5.07) | 3.34 (3.05, 3.63) | 0.107 (0.054, 0.193) |

Saturation rate s = 38.66 Gy⁻¹ (95% CI 38.34, 38.98), common to all radiation types.
Background mean 3.279 tumors per mouse across 68 control mice. B and q are derived from r
via the paper's Eqs. 8 to 11, not fitted freely.

Mars-mission mixture: H 0.311, ⁴He 0.109, ¹²C 0.029, ¹⁶O 0.029, ²⁸Si 0.022, ⁵⁶Fe 0.019 Gy,
totalling 0.519 Gy.

**Numerical check.** The incremental effect additivity ODE is integrated live in the browser.
At the published mixture dose it returns 4.74 excess tumors per mouse, against the published
4.74 (Monte Carlo range 4.50 to 5.00). Simple effect additivity returns 12.34, against the
published 12.33. The ratio is 2.6, as published. Silicon alone at the full mixture dose gives
9.66, which simple additivity exceeds, and that is the published absurdity the figure exists
to show.

## Explorable 3. CAST trajectory explorer

**Method.** CAST (Causal Analysis of Survival Trajectories), arXiv:2505.06367, presented
across three NeurIPS 2025 workshops.

**Data.** Precomputed simulation scenarios from the public CAST demonstration site
(`NeurIPS_2025/cast_demo_website/docs/data/scenarios.json`, copied verbatim). The data are
simulated, so the true treatment effect is known and every method can be scored against it.
No patient data are involved.

## Explorable 4. Why the dose response is curved

**Source.** Shuryak I, Cornforth MN. Accounting for overdispersion of lethal lesions in the
linear quadratic model improves performance at both high and low radiation doses.
*Int J Radiat Biol* 97(1):50-59 (2021). doi:10.1080/09553002.2020.1784489, Eqs. 1 and 6,
Tables 2 and 3.

SF = 1 / [1 + (αD + βD²)·r]^(1/r), recovering the classical Poisson form as r goes to zero.

| Cell line | α (Gy⁻¹) | β (Gy⁻²) | r |
|---|---|---|---|
| DU145 | 0.16 | 0.028 | 0.126 |
| U373MG | 0.08 | 0.047 | 0.241 |
| CHO AA8 | 0.18 | 0.019 | 0.000 |
| CP3 | 0.00 | 0.075 | 0.069 |

Cytogenetic estimate in human lymphocytes, r = 0.138 (95% CI 0.020, 0.301), from Shuryak,
Loucas & Cornforth, *Front Oncol* 7:318 (2017).

Chromosome panel: Cornforth M, Shuryak I, Loucas B. *Transl Cancer Res* (2017),
doi:10.21037/tcr.2017.05.16. γ rays α = 0.15, β = 0.073. ⁵⁶Fe α = 0.64, β = 0.00.

**Note.** The cell-survival data behind these fits are not tabulated in the paper. They were
digitized from Garcia et al., *Phys Med Biol* 51:2813 (2006). No data points are replotted
here, only the published fitted curves.

## Explorable 5. Second cancers

**Source.** Shuryak I, Hahnfeldt P, Hlatky L, Sachs RK, Brenner DJ. A new view of
radiation-induced cancer: integrating short- and long-term processes.
*Radiat Environ Biophys* 48(3):263-274 (Part I) and 48(3):275-286 (Part II), 2009.
Acute ERR from Part II. Fractionated case from Part I, Eqs. 7 to 11, 16, 17 and 22, with
logistic repopulation between fractions. Parameters from Part II, Tables 1 and 2.

Lung: X = 0.860 y/Gy, Y = 0.387 /Gy, δ = 9.49e-3 /y, log10 Z = 4.99, α = 0.25 /Gy,
β = 0.025 /Gy², λ = 0.05 /day, b = 0.460 /y. Breast, thyroid, stomach and bladder likewise
from Table 2.

**Numerical check.** With a single fraction, the fractionated formalism reduces exactly to
the published acute expressions for Sf and ISf. With 2 Gy fractions, the lung ERR peaks at
about 36 Gy, inside the 20 to 60 Gy range the paper reports for the repopulating case.

## Explorable 6. Radiopharmaceutical retention

**Source.** Shuryak I, Dadachova E. *J Nucl Med* 56(10):1622-1628 (2015).
doi:10.2967/jnumed.115.160515. Seven models (Table 1) and their fitted parameters and
Akaike weights (Table 2), for blood, kidneys, liver, bone marrow and lungs.
Physical decay g(t) = exp[-(ln2/1014)·t] for ¹⁸⁸Re.

**Every retention curve and every time integral on this page is recomputed in the browser
from the published model definitions and the Table 2 parameters**, integrated from zero to
infinity with the decay factor included. The paper's tabulated integral column (Table 3) is
not quoted, and no value from it is reproduced here.

## Explorable 7. Radiation resistance

**Acute survival model.** Shuryak I, Brenner DJ. *Radiat Environ Biophys* (2010),
doi:10.1007/s00411-010-0305-1, Eq. 3, with parameters from Shuryak I, Brenner DJ.
*J Theor Biol* 261(2):305-317 (2009): c8 = 10 breaks per cell per kGy, k23 = 8.0,
k1 = 0.058 /kGy.

S = exp(-c8·D·exp[-k23·exp(-k1·D)])

**Numerical check.** These published constants give D10 = 12.1 kGy, against the measured
12.0 kGy for *Deinococcus radiodurans*. Setting k23 = 0 gives D10 = 0.23 kGy.

**Survey of 21 organisms.** Sharma A, Gaidamakova EK, ... Shuryak I, ... Daly MJ.
*PNAS* 114(44):E9253-E9260 (2017), doi:10.1073/pnas.1713608114, Table 1. All 21 rows are
transcribed verbatim. Hill law f_H = κ·(DSB_D10)^n / [1 + κ·(DSB_D10)^n], fitted n = 1.5,
κ = 0.01 (SI Fig. S7); linearized fit n = 1.7 ± 0.2. Regression R² = 0.78,
Pearson r = 0.883 (p = 5.5e-7).

*D. radiodurans* sodA⁻ is tabulated as identical to wild type (D10 = 12.0 kGy, f_H = 0.94),
and the site says so, because that is the published finding.

## Explorable 8. What is one CT scan actually worth?

**Source.** Brenner DJ, Shuryak I, Einstein AJ. Impact of reduced patient life expectancy on
potential cancer risks from radiologic imaging. *Radiology* 261(1):193-198 (2011).
PMID 21771956.

The published quantity is a ratio of lifetime risks, computed from empirical life tables and
disease-specific survival curves. There is no closed-form survival model to re-derive, so the
explorable presents only the patient groups the paper reports, with nothing interpolated
between them: colon cancer stage 0/I versus stage IV at age 70 (8% versus 92% reduction),
and post-bypass coronary CT angiography at 55 versus 75 (57% versus 12%). The one point
estimate the paper prints with an interval is R = 0.58 (95% CI 0.52, 0.64) for a 65-year-old
after bypass surgery.
