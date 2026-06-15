# Personal website — Igor Shuryak, MD, PhD

A single self-contained `index.html` (HTML + CSS in one file, no build step, no
dependencies). It works on GitHub Pages, Columbia personal hosting, or any
static host. Open `index.html` locally in a browser to preview.

## Deploy free on GitHub Pages (recommended)

1. Create a free account at https://github.com if you do not have one.
2. Create a **new public repository** named exactly **`ishuryak.github.io`**
   (replace `ishuryak` with your GitHub username). Using this exact name makes
   the site live at the root URL `https://ishuryak.github.io`.
3. Upload **both** `index.html` and `headshot.jpg` to the repository (the page
   will show a broken image if the photo is missing):
   - Web route: on the repo page, **Add file → Upload files**, drag in
     `index.html` **and** `headshot.jpg`, then **Commit changes**.
   - Or via command line from this folder:
     ```bash
     cd website
     git init
     git add index.html headshot.jpg
     git commit -m "Personal website"
     git branch -M main
     git remote add origin https://github.com/ishuryak/ishuryak.github.io.git
     git push -u origin main
     ```
4. In the repo, go to **Settings → Pages**. Under **Build and deployment →
   Source**, select **Deploy from a branch**, branch **main**, folder **/ (root)**,
   then **Save**.
5. Wait 1–2 minutes. The site is live at **https://ishuryak.github.io**.

### Custom domain (optional, ~$10–15/year for the domain only)
Buy a domain (e.g. `shuryak.org`), add it under **Settings → Pages → Custom
domain**, and create the DNS records GitHub shows. Hosting stays free; you only
pay the domain registrar.

## Deploy free on Columbia hosting (alternative, gives a columbia.edu URL)
Columbia offers free static web space to affiliates. Request/enable personal web
space via CUIT (https://www.cuit.columbia.edu/web-publishing), then upload
`index.html` to your web directory. The page would appear under a
`columbia.edu/~<uni>` style URL. You can host on both — they are the same file.

## Editing the content
Everything is in `index.html`. To update:
- **Publications:** edit the `<ol class="pubs">` list.
- **Google Scholar link:** two `href="https://scholar.google.com/citations?user="`
  placeholders — paste your full Scholar profile URL into both.
- **Research themes / About / Talks:** edit the matching `<section>`.
No rebuild needed; save and re-upload (or `git commit` + `git push`).

## Notes
- The footer carries a personal-site disclaimer (required so the page is not
  read as an official Columbia site).
- The page contains only public, aggregate information — no patient-level data.
- Accessibility basics are built in (skip link, semantic headings, alt-friendly
  markup, high-contrast colors) to meet Columbia's website accessibility policy.
