# iOS promotion Universal Links

This directory contains a deployment candidate for associating the promotion website with NFC Open ReWriter. Committing these files does not enable Universal Links by itself. Website association, the installed app's signed entitlements, and real iPhone behavior each need verification. The source changes are not a claim about the app currently available in the App Store.

The intended website is `https://revtel.github.io/react-native-nfc-rewriter/`. Ordinary links to its supported home pages open the app's Home screen when iOS delivers them to the app. They do not change the selected app language or start NFC operations. Genuine background NFC activities instead open tag detail with the records supplied by iOS. Existing custom-scheme record-sharing links continue to open an editor without executing commands.

## Association file and scope

[`apple-app-site-association`](./apple-app-site-association) is an extensionless JSON file. Its app identifier is `HE7MCCDHL4.com.revteltech.nfcopenrewriter`, confirmed from a signed development app (version 0.6.0, build 202610251952). Check the actual signed artifact again before deploying or testing a different app identity; the App ID prefix must come from its `application-identifier`, rather than assuming it always equals the Team ID.

The file claims only these six exact paths on `revtel.github.io`:

| Website edition | Paths |
| --- | --- |
| English | `/react-native-nfc-rewriter/`, `/react-native-nfc-rewriter/index.html` |
| Traditional Chinese | `/react-native-nfc-rewriter/zh-Hant/`, `/react-native-nfc-rewriter/zh-Hant/index.html` |
| Japanese | `/react-native-nfc-rewriter/ja/`, `/react-native-nfc-rewriter/ja/index.html` |

There is no wildcard for other product pages, assets, or the organization website. The app entitlement adds `applinks:revtel.github.io`; it keeps the existing associated domains. An entitlement contains a hostname, not the project path.

Apple requires this file at:

```text
https://revtel.github.io/.well-known/apple-app-site-association
```

This repository's GitHub Pages source is `master:/docs`, which serves the project prefix `/react-native-nfc-rewriter/`. Adding `docs/.well-known/apple-app-site-association` here would serve the wrong URL. The promotion generator also does not publish files to the hostname root.

See Apple's [associated domains setup](https://developer.apple.com/documentation/xcode/supporting-associated-domains), [Universal Link debugging guidance](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links), and [background tag reading documentation](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading).

## Deploy to the organization website

Deployment requires a separately reviewed change to [`revtel/revtel.github.io`](https://github.com/revtel/revtel.github.io). The hosting review on 2026-10-26 found Pages publishing from `master:/` with the legacy branch build, HTTPS enforced, and no custom domain. It contains an existing generated Gatsby website, with no association file or dot-directory publishing configuration. Recheck these settings and the latest tree before changing them.

The ready-to-copy [`organization-site/`](./organization-site/) deployment tree contains only these two additions, with paths relative to that repository's root:

```text
.nojekyll
.well-known/apple-app-site-association
```

The `.nojekyll` marker is empty. The nested association file is byte-identical to the source configuration in this directory; keep both copies synchronized if the scope changes. This tree contains no replacement HTML, Gatsby assets, or repository settings. Copy only these additions after checking for conflicts in the destination, rather than replacing its root directory.

1. Preserve the current website and record the deployment commit for rollback. Do not replace the organization site's HTML, assets, service worker, or publishing branch.
2. Copy `organization-site/.well-known/apple-app-site-association` to `.well-known/apple-app-site-association` at the organization repository root, without adding `.json` to its name. If another association file now exists, merge only this app's entry and preserve all other apps and services.
3. Ensure the branch build includes `.well-known`. For the reviewed generated static site, copy the prepared `organization-site/.nojekyll` marker to the organization repository root to disable Jekyll filtering. Review that change against the current site; if it needs Jekyll, use an explicit `_config.yml` include instead. The `.nojekyll` in this project's `docs/` does not configure the organization site.
4. After the change is approved for publication, deploy through the organization's existing Pages process. Do not rebuild or replace the Gatsby site as part of this association change.
5. Verify the public response and then Apple/device association as described below. Keep the deployment gate open if any check fails.

GitHub Pages does not provide custom response headers through `.htaccess`. Prefer `application/json` when the hosting configuration allows it, and inspect the real origin response, Apple's CDN copy, and device association after deployment. An origin `application/octet-stream` response alone is not proof of a functional failure or a reason to migrate hosting. CDN acceptance observed today does not establish compatibility with every older or future client. A different hostname or a browser redirect cannot establish association for the original `revtel.github.io` URL.

## Verify the deployment and app independently

The preparation review on 2026-10-26 observed the promotion home returning HTTP 200 and both host-root association locations returning HTTP 404. A follow-up on 2026-10-27 found the deployed origin returning HTTP 200 with `application/octet-stream`; Apple's CDN returned HTTP 200 with `application/json` and `Apple-Origin-Format: json`. The JSON copies were equivalent and contained the expected app identifier and six paths. This establishes HTTP/CDN acceptance at that time, independently of physical iPhone and background-NFC verification.

**Origin response:** fetch the exact URL without following redirects:

```sh
curl --silent --show-error --dump-header /tmp/nfc-aasa-headers \
  --output /tmp/nfc-aasa-body \
  https://revtel.github.io/.well-known/apple-app-site-association
cat /tmp/nfc-aasa-headers
python3 -m json.tool /tmp/nfc-aasa-body
```

Require HTTP 200, valid JSON matching the reviewed app identifier and six paths, and no redirect. Record the `Content-Type`; prefer `application/json` where it can be configured. If the origin serves `application/octet-stream`, verify Apple's CDN acceptance and the test device's association rather than declaring failure from that header alone. A 200 HTML error page is a failure. Also confirm the existing organization home/assets and all three promotion pages still work.

**Signed app:** inspect the app being installed, rather than the Xcode project alone:

```sh
codesign --display --entitlements :- /path/to/NfcOpenReader.app
```

Confirm `application-identifier` matches the association file and `com.apple.developer.associated-domains` contains `applinks:revtel.github.io` together with the retained domains. Record the app version/build and iOS version with the test results. An older local app with the correct identifier can still lack the new domain entitlement.

**Apple and device association:** verify that Apple's CDN returns the expected association JSON, then use the diagnostics in [Apple's debugging guidance](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links) to check the domain and intended path on the test iPhone. Apple uses its own CDN for association files, so an updated origin does not prove that the device has received it, and CDN acceptance alone does not prove device association. Record the diagnostics and account for CDN/device refresh before evaluating a fresh installation. Do not silently uninstall an app containing saved records as a refresh shortcut.

**Physical iPhone behavior:** use a supported current iOS version and the exact signed build above. Test ordinary promotion links from another app, such as Notes or Messages, with the app terminated and already running. Check all three language paths: each opens Home once without changing the user's chosen language. Also confirm existing custom-scheme shared records open their editor without execution, and unrelated website paths are not claimed. Safari's address bar, a same-site navigation, or a user preference to stay in the browser is not equivalent to an external Universal Link test.

Then use a known NFC tag already containing an appropriate associated HTTPS URL to check background NFC notification → cold launch, warm resume, and exiting/reopening the app afterward. Expect tag detail once with the OS-provided NDEF records, no stale replay, and no crash. Repeat a deliberate scan of the same tag to check it is still delivered. Preserve crash logs if a failure occurs. Coordinate any required tag write separately; this checklist does not authorize writing, formatting, or locking a tag.

Unit tests, a simulator URL invocation, an iOS build, public AASA delivery, device association, and actual background NFC are separate evidence. [Issue #17](https://github.com/revtel/react-native-nfc-rewriter/issues/17) remains open until the current physical background-NFC behavior has been verified.

## Roll back

If association causes a problem, remove only this app's entry from the organization site's association file, preserving other entries. Remove the file only if this change created it and it has no remaining consumers. Revert a newly added `.nojekyll` or include configuration only after checking that later site changes do not rely on it. Recheck the existing website after deployment.

The app entitlement/routing changes can be reverted independently in a subsequent app build; existing installed builds and Apple's cached association may retain the prior state until refreshed. Removing website JSON does not instantly replace an installed app or purge every cached association.
