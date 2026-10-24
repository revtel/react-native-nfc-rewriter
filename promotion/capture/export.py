#!/usr/bin/env python3
"""Optimize inspected native captures and record their demo-data provenance."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ['scan', 'write', 'toolkit', 'flow-editor', 'flow-trace', 'memory']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('captures', type=Path)
    parser.add_argument('--captured-on', required=True, help='Capture date in the project owner’s timezone')
    args = parser.parse_args()
    captures = [(language, shot, args.captures / language / f'{shot}.png')
                for language in ['en', 'zh-Hant', 'ja'] for shot in SHOTS]
    for _, _, path in captures:
        if not path.is_file():
            parser.error(f'Missing native capture: {path}')
    manifest = {
        'capturedOn': args.captured_on,
        'releaseStatus': 'Development snapshot; app-store versions may differ.',
        'evidenceType': 'Simulator UI previews with deterministic demo tag data; not physical NFC results.',
        'processing': 'Proportional downscaling to 720 px width and lossless PNG optimization only. No UI or text retouching.',
        'captureEntry': 'promotion/capture/entry.js',
        'captureEntrySha256': hashlib.sha256((ROOT / 'promotion/capture/entry.js').read_bytes()).hexdigest(),
        'assets': [],
    }
    for language, shot, source in captures:
        with Image.open(source) as original:
            dimensions = original.size
            image = original.convert('RGB')
            image = image.resize((720, round(image.height * 720 / image.width)), Image.Resampling.LANCZOS)
            output = ROOT / 'docs/assets/screenshots' / language / f'{shot}.png'
            output.parent.mkdir(parents=True, exist_ok=True)
            image.save(output, optimize=True)
            manifest['assets'].append({
                'file': str(output.relative_to(ROOT)),
                'localSource': str(source.resolve()),
                'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'originalDimensions': dimensions, 'dimensions': image.size,
                'device': 'iPhone 17 Pro simulator', 'language': language,
                'scene': shot,
                'scope': 'Production UI with demo data. No physical NFC communication occurred.',
            })
    (ROOT / 'promotion/screenshot-sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    for shot in SHOTS:
        superseded = ROOT / 'docs/assets/screenshots' / f'{shot}.png'
        if superseded.exists():
            superseded.unlink()
    print('Exported 18 localized screenshots and provenance manifest.')


if __name__ == '__main__':
    main()
