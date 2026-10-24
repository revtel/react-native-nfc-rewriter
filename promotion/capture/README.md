# Localized app screenshot capture

These helpers render the app's production UI in a separate simulator-only preview app. They never communicate with an NFC tag. The data, including the memory pages and NFC responses, is a deterministic demo fixture in `entry.js`. The real flow interpreter generates the demo trace.

Use a copy of an existing **Release iOS simulator** `.app` with the same native dependencies. In the copy's `Info.plist`, set `CFBundleIdentifier` to `com.revteltech.nfcopenrewriter.promotion` and `CFBundleDisplayName` to `NFC Preview`. The separate identifier avoids changing the original app or its stored data. Do not use a physical-device build.

```sh
python3 promotion/capture/build.py /absolute/path/to/copied/NfcPreview.app
python3 promotion/capture/snapshot.py --device SIMULATOR-UDID --app /absolute/path/to/copied/NfcPreview.app --output /absolute/path/to/raw-captures
```

The bundle helper makes temporary adjacent copies of four source modules, changes only their preview navigation/initial state, bundles the screenshot entry, and removes the temporary copies in `finally`. It does not edit the production source files or the normal app entry. Source-marker checks fail if a refactor needs the preview helper to be reviewed.

The snapshot helper launches each of the six scenes in English, Traditional Chinese, and Japanese using iOS launch defaults. No tapping, writing, locking, formatting, or real NFC action occurs. Each screenshot must be visually inspected before use. Keep the demo-data caption on the site and README; these are not physical-device results.

After visual inspection, use Python with Pillow to export the captures proportionally at 720 px width:

```sh
python3 promotion/capture/export.py /absolute/path/to/raw-captures --captured-on YYYY-MM-DD
```

This writes `docs/assets/screenshots/{en,zh-Hant,ja}/`, updates `promotion/screenshot-sources.json`, and removes the six superseded flat images. README always references the `en/` set. No text or UI retouching is applied.

After capture, terminate or uninstall only the independent `.promotion` simulator app. The source and native app dependencies are unchanged.
