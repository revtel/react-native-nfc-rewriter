# Localized static site verification

Checked on 2026-10-24 using a loopback-only Python static server and the in-app browser. The test URL used `/react-native-nfc-rewriter/` to reproduce GitHub Pages project-prefix behavior.

- Visually inspected all 18 native captures: six each in English, Traditional Chinese, and Japanese, including localized flow names and completion messages. The pictures show production screen components with deterministic demo data in an independent iOS simulator app.
- Confirmed all six README screenshot links use `screenshots/en/`.
- Clicked all three language links in the browser: page language, title, selected-language state, and every screenshot reference match the selected language.
- Checked all three editions at 320, 390, 768, and 1440 px widths; no horizontal overflow was observed. Visually inspected desktop Chinese/Japanese and mobile Japanese layouts, including the navigation and language controls.
- Opened the Japanese release FAQ and full-size memory image. The correct 720 × 1565 Japanese image loaded, and browser back returned to the page.
- All 24 static files (three pages, 18 screenshots, stylesheet, icon, and `.nojekyll`) and all three language directory routes returned HTTP 200.
- Local HTML references, image aspect ratios, anchor targets, screenshot locale paths, and HTML language/current-selection attributes passed checks.
- `python3 scripts/build-promotion.py --check` and `git diff --check` passed. No browser warning/error logs were returned during the localized checks.
- Every image has an alt attribute, and each page has one primary heading and main landmark. Keyboard Tab reaches “Skip to content”; Enter moves focus to the main landmark (also checked in the initial static-page pass).
- The existing store, GitHub, and team destinations were checked in the initial page pass. The broken Revteltech `/en` URL was replaced with its working home URL; the NFC library URL uses the canonical `revtel` owner.
- No production app source or normal app entry was changed. The screenshot helper's temporary screen copies were removed after bundling. The capture app uses an independent simulator-only bundle identifier and demo transport.

These checks cover static content, language navigation, and presentation. The screenshots do not represent a new hardware acceptance run. Exact README rendering on GitHub has not been checked after a push. During that local verification pass, no commit was pushed, remote Pages setting changed, live deployment verified, or contact message submitted. Deployment verification is separate from these local checks.
