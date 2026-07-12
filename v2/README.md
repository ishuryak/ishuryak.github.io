# Interactive site (v2)

An additive second version of the personal website, carrying interactive explorables for
the research threads. The original `../index.html` is untouched and still deploys at the
site root. This version lives at `/v2/`.

## What is here

| Path | Purpose |
|---|---|
| `index.html` | The page. Research map plus eight explorables. |
| `assets/js/plot.js` | Declarative SVG plotting core (about 200 lines). No dependencies. |
| `assets/js/models.js` | The published model equations, in JavaScript. Every constant is cited. |
| `assets/js/widgets.js` | One module per explorable, plus the research map. |
| `assets/css/site.css` | Styling, light and dark, responsive. |
| `assets/data/cast_scenarios.json` | Precomputed CAST simulation scenarios (simulated data, no PHI). |
| `PROVENANCE.md` | Every equation and default parameter mapped to its published source. |

Total weight is well under 1 MB. There is no build step, no bundler, and no external
library or CDN. Deploy the folder as-is.

## Running it locally

**Serve it over HTTP. Opening `index.html` from the filesystem does not work.** The page
loads its JavaScript as an ES module, and browsers block module scripts from `file://`
(null origin), so every explorable comes up blank. The CAST scenario file is fetched, and
`fetch` is blocked from `file://` for the same reason.

```bash
cd website/v2
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying

The folder is already deployable. On GitHub Pages it will appear at `/v2/` with no
configuration. To promote it to the site root once approved:

```bash
git mv v2/index.html index.html      # and update the relative asset paths
```

Until then, both versions coexist and the live site is never broken.

## The rule this site is built on

Every equation, default parameter, and quoted number traces to a published, peer-reviewed
paper or an already-public artifact. Where a control would have needed a quantity that no
paper reports, the control was removed rather than guessed. See `PROVENANCE.md`.

No patient-level data is used anywhere. No unpublished result appears.

## Verification performed

- The JavaScript implementations were checked numerically against the published values.
  The incremental-effect-additivity solver returns 4.74 excess tumors per mouse for the
  Mars mixture against the published 4.74, and simple additivity returns 12.34 against
  the published 12.33.
- The radiation effects ratio converges to the analytic low-dose limit. Relative biological
  effectiveness approaches the same limit from above, and still sits about 10% over it at
  the 1 mGy left edge of the plotted dose axis, so the two are close there but not equal.
- The biologically-effective-dose model was checked to apply no repopulation penalty
  before the onset day, and to lose effective dose once treatment runs past it.
- Every page rendered and inspected in a browser at desktop and phone widths, in light and
  dark themes.

## Adding the remaining explorables

Seven of the eight research threads now have a live explorable. Biodosimetry is the one still
to build. It needs a source-verified model in `models.js`, a widget in `widgets.js`, a section
in `index.html`, and an entry in `PROVENANCE.md`. The plotting core should not need to change.
