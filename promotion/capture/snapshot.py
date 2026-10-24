#!/usr/bin/env python3
"""Capture deterministic simulator previews without changing real app data."""
import argparse
from pathlib import Path
import plistlib
import subprocess
import time

BUNDLE_ID = 'com.revteltech.nfcopenrewriter.promotion'
SHOTS = ['scan', 'write', 'toolkit', 'flow-editor', 'flow-trace', 'memory']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', required=True, help='Explicit booted simulator UDID')
    parser.add_argument('--app', required=True, type=Path, help='Copied, bundled simulator .app')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    info = plistlib.loads((args.app / 'Info.plist').read_bytes())
    if info.get('CFBundleIdentifier') != BUNDLE_ID:
        parser.error('Only the independent .promotion simulator preview app may be installed.')
    # This fixture is intentionally a separate simulator-only app identifier.
    subprocess.run(['xcrun', 'simctl', 'install', args.device, str(args.app)], check=True)
    for language in ['en', 'zh-Hant', 'ja']:
        directory = args.output / language
        directory.mkdir(parents=True, exist_ok=True)
        for shot in SHOTS:
            subprocess.run(['xcrun', 'simctl', 'terminate', args.device, BUNDLE_ID], capture_output=True)
            subprocess.run([
                'xcrun', 'simctl', 'launch', args.device, BUNDLE_ID,
                '-promotionLocale', language, '-promotionShot', shot,
            ], check=True, capture_output=True)
            time.sleep(3)
            output = directory / f'{shot}.png'
            subprocess.run(['xcrun', 'simctl', 'io', args.device, 'screenshot', str(output)], check=True, capture_output=True)
            print(f'Captured {language}/{shot}.png', flush=True)
    subprocess.run(['xcrun', 'simctl', 'terminate', args.device, BUNDLE_ID], capture_output=True)


if __name__ == '__main__':
    main()
