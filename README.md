# Personal website - Igor Shuryak, MD, PhD

A dependency-free static academic website for GitHub Pages or any conventional static host.
The repository contains two linked experiences:

- `index.html`: the main academic profile and research overview.
- `v2/`: nine interactive explorables spanning eight research threads.

The v2 page uses vanilla JavaScript modules and bundled synthetic data. There is no build
step, analytics code, cookie, form, external runtime library, or patient-level dataset.

## Local preview

Serve the repository root over HTTP so module scripts and the CAST JSON can load:

```bash
cd website
python3 -m http.server 8000
```

Then open `http://localhost:8000/` for the main site or
`http://localhost:8000/v2/` for the interactive site. Opening the main HTML file directly
can display the profile, but the v2 module and data fetches require HTTP.

## Tests

The explorable calculations and bundled CAST artifact have a dependency-free adversarial
test suite:

```bash
cd v2
npm test
```

Every `tests/*.test.mjs` module is discovered automatically. GitHub Actions runs the same
suite for pushes and pull requests.

## Deploy on GitHub Pages

1. Push the **entire repository contents**, including `v2/`, `headshot.jpg`, `robots.txt`,
   and `sitemap.xml`, to the `main` branch of the GitHub Pages repository.
2. In **Settings -> Pages**, choose **Deploy from a branch**, branch `main`, folder `/`.
3. The main page will be available at the site root and the explorables at `/v2/`.

Uploading only `index.html` and `headshot.jpg` is not sufficient because the main page links
to the v2 assets and data.

## Provenance and editing

- Edit academic profile content in `index.html`.
- Edit explorable presentation in `v2/index.html` and `v2/assets/`.
- Map published equations and parameters in `v2/PROVENANCE.md`.
- Record illustrative CATE assumptions in `v2/sim_registry.yaml`.
- Record CAST snapshot hashes and diagnostic limitations in
  `v2/CAST_SIMULATION_METHOD.md`.

Published inputs, teaching assumptions, and simulation-derived quantities must remain
visibly distinct. If the CAST JSON or generator changes, update its hashes, rerun the test
suite, and review the scientific labels before deployment.

## Privacy and accessibility

The site contains public academic information plus aggregate or synthetic results. It uses
semantic headings, keyboard-visible focus, reduced-motion support, responsive charts, and
light/dark palettes. The footer makes clear that this is a personal academic site rather
than an official Columbia University publication.
