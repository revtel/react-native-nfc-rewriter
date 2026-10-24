#!/usr/bin/env python3
"""Bundle screenshot-only screen initial states; production files are not edited."""
from pathlib import Path
import argparse
import plistlib
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise RuntimeError(f'Capture source changed; review replacement: {old}')
    return source.replace(old, new, 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('app', type=Path, help='A copy of an existing simulator .app bundle, in a temporary directory.')
    args = parser.parse_args()
    if args.app.suffix != '.app' or not args.app.is_dir():
        parser.error('Expected an existing copied .app directory')
    info = plistlib.loads((args.app / 'Info.plist').read_bytes())
    if info.get('CFBundleIdentifier') != 'com.revteltech.nfcopenrewriter.promotion':
        parser.error('Use a copied simulator app with the independent .promotion bundle identifier.')
    generated = []

    def copy(source, output, replacements):
        path = ROOT / output
        if path.exists():
            raise RuntimeError(f'Refusing to overwrite {path}')
        text = (ROOT / source).read_text()
        for old, new in replacements:
            text = replace_once(text, old, new)
        path.write_text(text)
        generated.append(path)

    try:
        copy('src/App.js', 'src/App.promotion.js', [
            ("from './AppNavigator'", "from './AppNavigator.promotion'"),
        ])
        copy('src/AppNavigator.js', 'src/AppNavigator.promotion.js', [
            ("from './Screens/NfcScriptEditor'", "from './Screens/NfcScriptEditor/PromotionPreview'"),
            ("from './Screens/Ntag21xMemoryScan'", "from './Screens/Ntag21xMemoryScan/PromotionPreview'"),
            ('<HomeTabs.Navigator', "<HomeTabs.Navigator initialRouteName={({write: 'NdefTypeListTab', toolkit: 'ToolKitTab'})[globalThis.__promotionShot] || 'HomeTab'}"),
            ('initialRouteName="Landing"', "initialRouteName={globalThis.__promotionShot.startsWith('flow-') ? 'NfcScriptEditor' : globalThis.__promotionShot === 'memory' ? 'Ntag21xMemoryScan' : 'MainTabs'}"),
            ('name="NfcScriptEditor"', 'name="NfcScriptEditor" initialParams={{savedRecord: globalThis.__promotionRecord}}'),
        ])
        copy('src/Screens/NfcScriptEditor/index.js', 'src/Screens/NfcScriptEditor/PromotionPreview.js', [
            ("const [mode, setMode] = React.useState('editor');", "const [mode, setMode] = React.useState(globalThis.__promotionShot === 'flow-trace' ? 'trace' : 'editor');"),
            ('const [result, setResult] = React.useState(null);', 'const [result, setResult] = React.useState(globalThis.__promotionTrace);'),
        ])
        copy('src/Screens/Ntag21xMemoryScan/index.js', 'src/Screens/Ntag21xMemoryScan/PromotionPreview.js', [
            ('const [scan, setScan] = React.useState(null);', 'const [scan, setScan] = React.useState(globalThis.__promotionScan);'),
        ])
        subprocess.run([
            'node', 'node_modules/react-native/cli.js', 'bundle', '--platform', 'ios',
            '--dev', 'false', '--entry-file', 'promotion/capture/entry.js',
            '--bundle-output', str(args.app.resolve() / 'main.jsbundle'),
            '--assets-dest', str(args.app.resolve()), '--max-workers', '2',
        ], cwd=ROOT, check=True)
    finally:
        for path in generated:
            path.unlink()


if __name__ == '__main__':
    main()
