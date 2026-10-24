# Promotion assets and website maintenance

The public site consists of buildless static pages in `docs/`. It uses HTML, CSS, and local images: no package installation, JavaScript runtime, external fonts, analytics, or backend is required. App code and dependencies are unaffected.

## Files

- `docs/index.html`: English page.
- `docs/zh-Hant/index.html` and `docs/ja/index.html`: Traditional Chinese and Japanese pages.
- `promotion/site-template.html` and `promotion/locales/`: shared English template and complete translations.
- `scripts/build-promotion.py`: standard-library generator for the committed static HTML files.
- `docs/styles.css`: responsive presentation and reduced-motion support.
- `docs/assets/screenshots/{en,zh-Hant,ja}/`: six screenshots per language. README uses only `en/`; each website edition uses its matching set.
- `docs/assets/app-icon.png`: optimized copy of the existing project icon, also used as favicon and social preview.
- `docs/.nojekyll`: tells GitHub Pages to serve the static files without Jekyll processing.
- [competitor-research.md](./competitor-research.md): dated positioning research and official sources.
- [screenshot-sources.json](./screenshot-sources.json): capture provenance, processing, and evidence boundaries.
- [verification.md](./verification.md): static-site checks and deployment limitations.

## Preview locally

From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:4173/`. For a closer reproduction of the GitHub project URL, serve the repository's parent directory and open `/react-native-nfc-rewriter/docs/`. Page assets use relative paths so the repository prefix is preserved.

Check desktop and mobile widths, keyboard navigation, image links, FAQ expansion, and the app-store/source/contact destinations. The contact action opens the visitor's mail client; it does not submit a form or send email automatically.

## Publish with GitHub Pages

After the reviewed site files have been committed and pushed to the publishing branch:

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the branch containing these files (currently `master`) and **`/docs`**, then save.
4. Wait for the Pages deployment to succeed and open the URL reported by GitHub.
5. Check the home page, a screenshot link, both download links, and the project inquiry link.

The expected project URL is `https://revtel.github.io/react-native-nfc-rewriter/`, assuming the existing owner/repository names and no custom domain. A successful local preview does not establish a successful deployment. Once Pages is configured for `master` and `/docs`, pushing updates to that branch publishes the committed static pages; the local generator itself does not deploy anything.

GitHub's [publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) describes the branch `/docs` option. No custom GitHub Actions workflow is needed for this buildless page.

## Update content and screenshots

Keep the product name, download links, service contact, and capability descriptions consistent between the root README and the page. If changing the public URL, update the README website link and the page's canonical, Open Graph URL, and absolute image URL.

The current screenshot set was captured on 2026-10-24 in an independent iOS simulator preview app, using the production screen components and deterministic demo data. All 18 images have matching English, Traditional Chinese, and Japanese editions. Only proportional downscaling and lossless PNG optimization were applied. The manifest records the raw capture path, hash, locale, and demo-data boundary. See [capture instructions](./capture/README.md) to reproduce the set. These images are not a hardware acceptance run.

When replacing an image, inspect it for private data and confusing test labels, preserve its original capture provenance, update its dimensions in HTML, and update the manifest. Do not present fixtures as physical NFC results. For memory captures, distinguish model-specific scans, generic CC-declared data areas, and partial results.

The current source is ahead of the confirmed store description. Keep the development-preview wording until the matching app-store releases have been verified. The website and screenshots both support English, Traditional Chinese, and Japanese. The language switcher uses ordinary links and works without JavaScript. English is the root page; the other editions have their own static URLs, canonical metadata, and alternate-language links.

The first version intentionally excludes tutorials, case studies, campaigns, and performance tracking.

## Update the three language editions

Edit `promotion/site-template.html` for shared structure and English text. Add or update the corresponding complete text nodes / accessible attributes in both `promotion/locales/zh-Hant.json` and `promotion/locales/ja.json`, then run:

```sh
python3 scripts/build-promotion.py
python3 scripts/build-promotion.py --check
```

The generator rejects missing translations and checks that committed pages match their sources. Commit the generated HTML with the source changes. GitHub Pages still serves the committed files directly; no build pipeline or browser JavaScript is required. The language selection is represented by the URL, so links can be shared and bookmarked. App interface language and website language remain independent.
