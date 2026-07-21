# CAST simulation snapshot and diagnostic definitions

This note documents the exact synthetic artifact rendered by the CAST explorable. It is a
website provenance record, not an extension of the claims in arXiv:2505.06367 and not a
statement about patient data.

## Bundled snapshot

- Generated: 2026-07-18 20:29
- Scenarios: 24 (`2 shapes x 4 measured-confounding levels x 3 latent-confounding levels`)
- Cohort size: 2,000 per scenario
- Follow-up horizons: 12, 36, 60, 84, and 108 months
- Scenario seeds: 1001 through 1024 in shape/confounding/latent-confounding loop order
- Fine truth grid: 0 to 210 months in 0.5-month increments
- Administrative censoring: 180 months; independent exponential dropout mean: 210 months
- Forest configuration: 1,000 trees, base forest seed 101, full `grf` tuning enabled
- Data file: `assets/data/cast_scenarios.json`
- Data SHA-256: `21ad1acfcaa9dbc46c62924602d882c6a7e94fb9a66dc51373796817fffb18c6`

The data file was copied byte-for-byte from the companion CAST demonstration generator.
Because that generator snapshot was not represented by a clean, immutable repository commit
at export time, reproducibility is pinned here by content hashes rather than by a commit ID:

| Generator file | SHA-256 |
|---|---|
| `R/01_simulate.R` | `c4732fe2a927f9e5a046094ac048d5ec94625f7874ddedcd1b9c33b463efbc61` |
| `R/02_fit_methods.R` | `e1c80c36f2d300f12bfbf8894337c2a445875b30f99ee37cb817bcf5538d5c57` |
| `R/03_export.R` | `1ee9befc46507d91576df250386b6b872b12115c3e74c975a30991e7ed3262c6` |
| `R/cast_core.R` | `0cfa0e036d9cd633504af609596d4a4289877137e2c185c2db35e6b2effc29a1` |

If the generator is changed, regenerate the JSON, update all hashes, rerun `npm test`, and
review every scientific label below.

The snapshot did not record the R, `grf`, and `survival` package versions. Exact bitwise
regeneration therefore still requires the companion environment; the bundled JSON and its
tests are the immutable website artifact. A future generator release should add a lockfile
or session-information record before producing a replacement snapshot.

## Data-generating process

The simulation draws age, stage, performance status, comorbidity, smoking, negative-control
covariates, and a standardized latent fitness factor. Age, stage, performance status, and
comorbidity affect prognosis and treatment assignment. The latent factor affects both when
its strength is nonzero but is withheld from the primary fitted models. Censoring is
independent, with an administrative cap.

Treatment multiplies the baseline hazard by a function of follow-up time only. The plateau
shape remains protective; the reversal shape transitions smoothly from protective to
harmful. The treatment effect does **not** vary with patient covariates. Consequently, the
population benefit-ranking/AUTOC target is zero in every scenario.

The estimand is the marginal survival-probability difference
`P(T > t | treatment) - P(T > t | control)` at each displayed horizon.

## Estimators and displayed quantities

- **Naive:** unadjusted Kaplan-Meier survival-probability difference.
- **Cox:** adjusted proportional-hazards model plus a standardized marginal survival-
  probability difference curve.
- **RSF and T-learner:** survival-forest plug-in estimators.
- **CSF:** causal survival forest fitted separately at each horizon.
- **CAST:** a quadratic trajectory fit to the CSF horizon estimates. Cross-horizon
  influence-function covariance is Ledoit-Wolf shrunk and propagated through the smooth fit.
- **RMSE:** root mean squared error against the known simulated truth across the five
  horizons; lower is better.
- **Pointwise interval check:** the count of displayed horizons where the known truth falls
  inside each method's pointwise interval. It is descriptive for one simulated dataset and
  is not an estimate of simultaneous coverage.
- **Overlap:** the range of estimated propensities before clipping and the fraction near 0
  or 1.
- **CSF latent-factor sensitivity:** the largest absolute horizon-wise difference between
  CSF estimates omitting and including the simulated latent factor. It is not a CAST
  sensitivity refit.
- **Cox HR E-value:** an association-scale sensitivity summary derived from the Cox hazard
  ratio; it is not the same quantity as the CSF sensitivity card.
- **AUTOC null diagnostic:** a benefit-ranking estimate at the 60-month horizon. Since the
  DGP has no covariate-level treatment-effect modification, its population target is zero;
  departures from zero reflect finite-sample and model variation.

## Interval limitation

The CAST region uses `fit +/- 1.96 x pointwise standard error` at each horizon. Cross-horizon
covariance enters the coefficient covariance of the smooth fit, but no simultaneous sup-t
or other family-wise multiplier is applied. The correct description is therefore
"covariance-aware pointwise 95% intervals," not "joint" or "simultaneous" coverage.
