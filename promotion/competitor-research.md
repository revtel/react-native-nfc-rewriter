# NFC utility app positioning research

Checked on **2026-10-24**. Scope: NFC Tools, NXP TagInfo, and NXP TagWriter. This is a small official-source review, not hands-on competitor testing. Prices, ratings, download counts, and unsupported superiority claims are deliberately excluded.

## Recommended positioning

> An open-source NFC workbench for reading tags, writing NDEF, and building response-driven command flows.

The app serves people exploring tags and developers prototyping NFC integrations. Everyday reading and writing provide the entry point. Response-driven command flows and inspectable MIT-licensed React Native source provide the deeper story. This positioning describes our implementation; it does not assert that competitors cannot provide similar capabilities.

Public copy uses three themes:

1. **Read, write, and inspect.** Tag information, NDEF editing, and readable Type 2 pages.
2. **Build flows that respond to your tags.** Capture response bytes, reuse variables, branch, repeat within limits, and inspect the trace.
3. **Explore the app. Extend the source.** Use the app, adapt the code, or contact the team about integration and custom development.

## Comparison

“Documented” below means described by an official product page, help article, or app-store listing. It does not establish device compatibility, feature quality, or an exact free/paid entitlement.

| Product / edition | Audience and documented capabilities | Commands, memory, and workflows | Evidence boundary |
| --- | --- | --- | --- |
| NFC Tools Android, free | General tag reading, NDEF writing, tag utilities, and entry to phone-task automation | Android product page lists memory dump/export and advanced commands | General product-page features must not all be assigned to the free edition without testing [W1, W2] |
| NFC Tools Android, Pro | Separate paid app; reusable profiles, importing tags, task conditions, task execution without tags, and NDEF emulation are advertised | Conditions are presented in the phone-task context; task execution uses the NFC Tasks companion app | Do not equate phone tasks with branching on NFC protocol responses [W3, W4] |
| NFC Tools iOS, free + Pro IAP | A single app with in-app Pro purchase, rather than Android's separate Pro app | iOS product page also advertises memory dump/export and advanced commands | Exact free/Pro boundaries require testing [W5, W6] |
| NXP TagInfo Android | Tag/card analysis for enthusiasts and developers; IC/vendor identification, NDEF analysis, memory layouts, report sharing | Memory inspection is a documented core capability | Do not claim our tag analysis is deeper; hardware coverage was not tested [N1, N2] |
| NXP TagInfo iOS | Type 2/4/5, simple/expert NDEF views, Scan & Launch, sharing; version history includes originality checks | This review did not confirm an equivalent response-driven protocol flow editor | Do not copy the Android capability list onto iOS or treat “not confirmed” as “absent” [N1, N3] |
| NXP TagWriter Android | Content writing, tag configuration, existing-content reading and record management; backup, CSV/batch and sequential tag writing are advertised | Focuses on content and configuration | Full platform parity and hardware behavior require testing [N4, N5] |
| NXP TagWriter iOS | NDEF writing and content management; version history also describes NXP card user-memory display and Type 2 NDEF formatting | Memory display cannot be described as exclusive to our app | Do not assume every Android product-page feature exists on iOS [N4, N6] |

## Conclusions that affect the README and website

- Memory inspection and custom commands are already advertised by competitors. They are useful features, not established exclusive advantages.
- NFC Tools' advanced-command guide documents comma-separated command sequences [W7]. “Multiple commands” alone is not a defensible distinction.
- Show our actual sequence: **response → captured variable → branch / next command → execution trace**. The complete equivalent combination was not established for competitors in this review; this is an unknown, not proof of absence.
- NFC Tools already has Android intents and web callback integration [W8]. Integration alone is not exclusive either.
- NFC Tools' “Your NFC projects” page is a project showcase/submission page [W9]. It is not evidence that Wakdev does or does not accept development commissions. The same caution applies to NXP's developer resources.
- Competitors' full app-source availability and licensing were not established by the reviewed pages. Do not label them closed source. Our own MIT license and React Native source can be directly verified.
- Our three-language interface is useful availability information. NFC Tools documents many languages, so avoid presenting language count as an advantage.
- Publish our capabilities and screenshots rather than a competitive checkmark matrix that would require ongoing testing.

## Our evidence and release boundary

The repository's `LICENSE`, `src/features/nfc-script/`, `src/services/nfc/scriptService.js`, and `src/features/ntag21x-memory/` support the source-level claims above. The archived local acceptance record distinguishes physical NTAG215 results from UI fixtures and generic Type 2 partial scans. NTAG213/216 model support must not be described as physical-device validation of those models.

The public [Google Play listing](https://play.google.com/store/apps/details?id=com.washow.nfcopenrewriter), reviewed on the date above, describes reading/writing and custom transceive and lists an update predating the current source. The App Store release could not be independently retrieved by the main agent's web fetch. Neither store has been confirmed to contain all current-source features. Both README and website therefore label screenshots and newer capabilities as a **development preview**, without inventing an availability date.

For contact information, the app's Settings screen links Revteltech, NFC To GO, and `nfctogo@gmail.com`. [NFC To GO's official site](https://www.nfctogo.com/) also publicly describes NFC product development and consulting and lists that email. These support a project-inquiry link; no email or form was submitted.

## Official sources

### Wakdev

- W1 — [NFC Tools Android](https://www.wakdev.com/en/apps/nfc-tools-android.html)
- W2 — [NFC Tools on Google Play](https://play.google.com/store/apps/details?id=com.wakdev.wdnfc)
- W3 — [NFC Tools Pro Edition](https://www.wakdev.com/en/apps/other-apps/nfc-tools-pro-edition.html)
- W4 — [NFC Tools Pro on Google Play](https://play.google.com/store/apps/details?id=com.wakdev.nfctools.pro)
- W5 — [NFC Tools iOS](https://www.wakdev.com/en/apps/nfc-tools-ios.html)
- W6 — [NFC Tools on the App Store](https://apps.apple.com/us/app/nfc-tools/id1252962749)
- W7 — [How to use advanced NFC commands](https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-use-advanced-nfc-commands.html)
- W8 — [NFC Tools Android API](https://www.wakdev.com/en/apps/nfc-tools-android/api.html)
- W9 — [Your NFC projects](https://www.wakdev.com/en/apps/nfc-tools-android/your-nfc-projects.html)

### NXP

- N1 — [NFC TagInfo product page](https://www.nxp.com/design/design-center/software/rfid-developer-resources/the-nfc-taginfo-app-by-nxp:NFC-TAGINFO)
- N2 — [NFC TagInfo on Google Play](https://play.google.com/store/apps/details?id=com.nxp.taginfolite)
- N3 — [NFC TagInfo on the App Store](https://apps.apple.com/us/app/nfc-taginfo-by-nxp/id1246143596)
- N4 — [NFC TagWriter product page](https://www.nxp.com/design/design-center/software/rfid-developer-resources/nfc-tagwriter-app-by-nxp:NFC-TAGWRITER)
- N5 — [NFC TagWriter on Google Play](https://play.google.com/store/apps/details?id=com.nxp.nfc.tagwriter)
- N6 — [NFC TagWriter on the App Store](https://apps.apple.com/us/app/nfc-tagwriter-by-nxp/id1246143221)

## Follow-up only if needed

An exact free/paid feature matrix, response-dependent protocol scripting equivalence, and tag/device coverage need direct testing. None is required to publish the current first-person product positioning. Recheck the linked sources before making a new comparative claim.
