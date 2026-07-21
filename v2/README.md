# Interactive research explorables

This directory is the interactive companion to the main academic site. It contains nine
explorables across eight research threads: seven panels that recompute published models, one
illustrative individual-effect simulation, and one CAST method-comparison simulation.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | Research map, controls, explanatory text, and source notes. |
| `assets/js/plot.js` | Dependency-free declarative SVG plotting core. |
| `assets/js/models.js` | Published model equations and constants. |
| `assets/js/widgets.js` | Interactive controllers and readouts. |
| `assets/css/site.css` | Responsive light/dark styling. |
| `assets/data/cast_scenarios.json` | Twenty-four precomputed synthetic CAST scenarios. |
| `PROVENANCE.md` | Published inputs and simulation classifications. |
| `CAST_SIMULATION_METHOD.md` | CAST snapshot hashes, definitions, and limitations. |
| `sim_registry.yaml` | Registered assumptions for the CATE teaching simulation. |
| `tests/` | Automatically discovered adversarial tests. |

The folder has no runtime dependencies, bundler, CDN, analytics, or patient-level data.
Deploy it as ordinary static files.

## Run locally

Serve the repository root rather than opening the file directly:

```bash
cd website
python3 -m http.server 8000
# http://localhost:8000/v2/
```

Browsers block ES modules and the CAST `fetch` request from a `file://` origin.

## Test

```bash
cd website/v2
npm test
```

The runner discovers every `tests/*.test.mjs` file. Tests cover all nine panels, including
the complete CAST scenario grid, trajectory dimensions, interval ordering, recalculated
RMSE values, overlap diagnostics, CSF latent-factor shifts, AUTOC sign/uncertainty, and the
pinned data hash.

## Scientific labeling rule

Do not collapse the site's three evidence categories:

1. **Published-model panels:** equations and defaults trace to cited papers.
2. **CATE teaching panel:** assumptions are user supplied, illustrative, and registered.
3. **CAST comparison panel:** estimates and diagnostics come from bundled synthetic
   scenarios; their definitions and limits are documented separately.

In particular, CAST displays covariance-aware **pointwise** 95% intervals, the latent-factor
sensitivity card compares CSF fits rather than CAST fits, and AUTOC is a null diagnostic
because the current CAST DGP has no covariate-level treatment-effect modification.

## Remaining research-map item

Seven of the eight research threads have at least one live explorable. Biodosimetry remains
the unimplemented thread; the ninth panel is the additional CATE teaching explorable within
the causal-ML thread.
