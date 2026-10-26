import React from 'react';
import {
  Linking,
  Platform,
  Share,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import NfcManager from 'react-native-nfc-manager';
import NfcProxy from '../src/NfcProxy';
import Type5MemoryScanScreen, {
  Type5InspectionResult,
  createStyles,
} from '../src/Screens/Type5MemoryScan';
import {createType5Report} from '../src/features/type5-memory/report';
import {analyzeType5Memory} from '../src/features/type5-memory/model';
import {i18n, translateText as tr} from '../src/i18n';
import {spacing, type, visualColors} from '../src/visual/theme';
import fixture from './fixtures/type5Inspection.json';

const originalPlatform = Platform.OS;
const metadataNotice =
  'iOS may read NDEF while obtaining the tag identifier. The block limits apply only to this inspector’s raw reads.';

jest.mock('../src/NfcProxy', () => ({scanType5Memory: jest.fn()}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined)},
  Ndef: require('react-native-nfc-manager/ndef-lib'),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

function button(tree, label) {
  return tree.root
    .findAllByType(Button)
    .find((node) => node.props.children === label);
}
function text(tree) {
  return tree.root
    .findAllByType(Text)
    .flatMap((node) => [node.props.children].flat(Infinity))
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ');
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return {promise, resolve};
}
async function open(navigation) {
  let tree;
  await act(async () => {
    tree = renderer.create(<Type5MemoryScanScreen navigation={navigation} />);
  });
  return tree;
}
beforeEach(() => {
  jest.clearAllMocks();
  useColorScheme.mockReturnValue('light');
  jest.spyOn(Share, 'share').mockResolvedValue({action: Share.sharedAction});
});
afterEach(async () => {
  await i18n.changeLanguage('en');
  Object.defineProperty(Platform, 'OS', {value: originalPlatform});
  jest.restoreAllMocks();
});

test.each(['en', 'zh-Hant', 'ja'])(
  'iOS preliminary NDEF notice is localized before scanning and retained with result evidence: %s',
  async (language) => {
    await i18n.changeLanguage(language);
    Object.defineProperty(Platform, 'OS', {value: 'ios'});
    let tree = await open();
    expect(text(tree)).toContain(tr(metadataNotice));
    expect(NfcProxy.scanType5Memory).not.toHaveBeenCalled();
    expect(tr(metadataNotice)).not.toBe(
      language === 'en' ? '' : metadataNotice,
    );
    await act(async () => tree.unmount());
    Object.defineProperty(Platform, 'OS', {value: 'android'});
    tree = await open();
    expect(text(tree)).not.toContain(tr(metadataNotice));
    await act(async () => tree.unmount());

    const result = {
      ...fixture,
      platform: 'ios',
      metadataRead: {
        method: 'getTag',
        mayReadNdef: true,
        includedInRawReadBounds: false,
      },
    };
    const report = createType5Report(result);
    expect(report.metadataRead).toEqual(result.metadataRead);
    expect(report.blocks).toEqual(fixture.blocks);
    const styles = createStyles({colors: visualColors(false), spacing, type});
    await act(async () => {
      tree = renderer.create(
        <Type5InspectionResult result={result} styles={styles} />,
      );
    });
    expect(text(tree)).toContain(tr(metadataNotice));
    await act(async () => tree.unmount());
  },
);

test('presentation fixture CC/NDEF agrees with actual verified block analysis', () => {
  expect(
    analyzeType5Memory({
      blocks: fixture.blocks,
      blockSize: fixture.scope.blockSize,
      reportedBlocks: fixture.scope.reportedBlocks,
      geometryTrusted: true,
    }),
  ).toEqual({cc: fixture.cc, ndef: fixture.ndef});
});

test('text and URI content are selectable plain data with no link execution', async () => {
  const openURL = jest.spyOn(Linking, 'openURL');
  const result = {
    ...fixture,
    ndef: {
      ...fixture.ndef,
      records: [
        {tnf: 1, type: 'T', payload: [2, 101, 110, 72, 105]},
        {
          tnf: 1,
          type: [85],
          payload: [4, 101, 120, 97, 109, 112, 108, 101, 46, 99, 111, 109],
        },
      ],
    },
  };
  const styles = createStyles({colors: visualColors(false), spacing, type});
  let tree;
  await act(async () => {
    tree = renderer.create(
      <Type5InspectionResult result={result} styles={styles} />,
    );
  });
  const values = tree.root
    .findAllByType(Text)
    .filter((node) => node.props.selectable)
    .map((node) => node.props.children);
  expect(values).toContain('Hi');
  expect(values).toContain('https://example.com');
  expect(openURL).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('opening never scans/shares; explicit scan and share preserve complete technical JSON', async () => {
  NfcProxy.scanType5Memory.mockResolvedValue(fixture);
  const tree = await open();
  expect(NfcProxy.scanType5Memory).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
  await act(async () => {
    await button(tree, 'SCAN TAG').props.onPress();
  });
  expect(text(tree)).toContain('Partial inspection');
  expect(text(tree)).toContain('NDEF record 2');
  expect(text(tree)).toContain(fixture.failure.message);
  expect(Share.share).not.toHaveBeenCalled();
  await act(async () => {
    await button(tree, 'SHARE JSON').props.onPress();
  });
  expect(JSON.parse(Share.share.mock.calls[0][0].message)).toEqual(
    createType5Report(fixture),
  );
  await act(async () => tree.unmount());
});

test('duplicate taps do not reenter and cancelled empty scan preserves prior evidence', async () => {
  NfcProxy.scanType5Memory.mockResolvedValueOnce(fixture);
  const tree = await open();
  await act(async () => {
    await button(tree, 'SCAN TAG').props.onPress();
  });
  const pending = deferred();
  NfcProxy.scanType5Memory.mockReturnValueOnce(pending.promise);
  let scan;
  await act(async () => {
    const onPress = button(tree, 'SCAN AGAIN').props.onPress;
    scan = onPress();
    onPress();
  });
  expect(NfcProxy.scanType5Memory).toHaveBeenCalledTimes(2);
  const options = NfcProxy.scanType5Memory.mock.calls[1][0];
  expect(options.shouldContinue()).toBe(true);
  await act(async () => {
    button(tree, 'CANCEL').props.onPress();
  });
  expect(options.shouldContinue()).toBe(false);
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  await act(async () => {
    options.onProgress({phase: 'reading', blocksRead: 99, plannedBlocks: 100});
    pending.resolve(null);
    await scan;
  });
  expect(text(tree)).toContain('Partial inspection');
  expect(text(tree)).not.toContain('99');
  await act(async () => tree.unmount());
});

test('blur and unmount invalidate native work and ignore late result/progress', async () => {
  const listeners = {};
  const navigation = {
    isFocused: () => true,
    addListener: (event, callback) => {
      listeners[event] = callback;
      return jest.fn();
    },
  };
  const pending = deferred();
  NfcProxy.scanType5Memory.mockReturnValueOnce(pending.promise);
  const tree = await open(navigation);
  let scan;
  await act(async () => {
    scan = button(tree, 'SCAN TAG').props.onPress();
  });
  const options = NfcProxy.scanType5Memory.mock.calls[0][0];
  await act(async () => {
    listeners.blur();
  });
  expect(options.shouldContinue()).toBe(false);
  await act(async () => {
    pending.resolve(fixture);
    options.onProgress({phase: 'reading', blocksRead: 50, plannedBlocks: 50});
    await scan;
    listeners.focus();
  });
  expect(text(tree)).not.toContain('Partial inspection');
  await act(async () => tree.unmount());
  expect(options.shouldContinue()).toBe(false);
});

test('explicit cancellation can retain a new verified prefix without reentering', async () => {
  const pending = deferred();
  NfcProxy.scanType5Memory.mockReturnValueOnce(pending.promise);
  const tree = await open();
  let scan;
  await act(async () => {
    scan = button(tree, 'SCAN TAG').props.onPress();
  });
  await act(async () => {
    button(tree, 'CANCEL').props.onPress();
  });
  const cancelled = {...fixture, cancelled: true};
  await act(async () => {
    pending.resolve(cancelled);
    await scan;
  });
  expect(text(tree)).toContain('Cancelled; verified bytes retained.');
  expect(text(tree)).toContain('2 / 3 blocks');
  await act(async () => tree.unmount());
});

test.each(['en', 'zh-Hant', 'ja'])(
  'localized fixtures retain full wrapping blocks and long diagnostics: %s',
  async (language) => {
    await i18n.changeLanguage(language);
    for (const isDark of [false, true]) {
      const styles = createStyles({
        colors: visualColors(isDark),
        spacing,
        type,
      });
      let tree;
      await act(async () => {
        tree = renderer.create(
          <Type5InspectionResult result={fixture} styles={styles} />,
        );
      });
      expect(text(tree)).toContain(tr('Partial inspection'));
      expect(text(tree)).toContain(fixture.failure.message);
      expect(
        tree.root
          .findAllByType(View)
          .filter((node) => /^type5-block-/.test(node.props.testID || '')),
      ).toHaveLength(2);
      const selectable = tree.root
        .findAllByType(Text)
        .filter((node) => node.props.selectable);
      for (const node of selectable) {
        expect(node.props.numberOfLines).toBeUndefined();
        expect(node.props.allowFontScaling).not.toBe(false);
      }
      const raw = selectable.find(
        (node) =>
          node.props.children ===
          '20 21 22 23 24 25 26 27 28 29 2A 2B 2C 2D 2E 2F 30 31 32 33 34 35 36 37 38 39 3A 3B 3C 3D 3E 3F',
      );
      expect(raw).toBeDefined();
      expect(raw.props.style.fontFamily).toBeDefined();
      expect(styles.technical.width).toBeUndefined();
      expect(styles.card.height).toBeUndefined();
      await act(async () => tree.unmount());
    }
  },
);

test('unknown geometry, CC inconsistency and one-byte blocks remain explicit', async () => {
  const result = JSON.parse(JSON.stringify(fixture));
  result.status = 'limited';
  result.scope = {
    ...result.scope,
    kind: 'block-zero-preview',
    blockSize: 1,
    readBlocks: 1,
    plannedBlocks: 1,
    readBytes: 1,
  };
  result.blocks = [{address: 0, bytes: [225]}];
  result.systemInfo = {...result.systemInfo, blockCount: null, blockSize: null};
  result.cc.status = 'inconsistent';
  result.ndef = {...result.ndef, status: 'unavailable', records: [], tlvs: []};
  const styles = createStyles({colors: visualColors(false), spacing, type});
  let tree;
  await act(async () => {
    tree = renderer.create(
      <Type5InspectionResult result={result} styles={styles} />,
    );
  });
  expect(text(tree)).toContain('capacity unknown');
  expect(text(tree)).toContain('CC conflicts with reported geometry');
  expect(text(tree)).toContain('Block 0 · 1 bytes');
  await act(async () => tree.unmount());
});

test('status and interpretation matrix remains readable in every language and theme', async () => {
  const complete = JSON.parse(JSON.stringify(fixture));
  complete.status = 'complete';
  complete.failure = null;
  complete.blocks.push({address: 2, bytes: Array(32).fill(0)});
  complete.scope = {...complete.scope, readBlocks: 3, readBytes: 96};
  const limited = JSON.parse(JSON.stringify(fixture));
  limited.status = 'limited';
  limited.failure = null;
  limited.blocks = [{address: 0, bytes: [0xe1]}];
  limited.scope = {
    ...limited.scope,
    kind: 'block-zero-preview',
    reportedBlocks: null,
    plannedBlocks: 1,
    readBlocks: 1,
    readBytes: 1,
    blockSize: 1,
    limits: ['unknown-geometry'],
  };
  limited.systemInfo = {
    ...limited.systemInfo,
    blockCount: null,
    blockSize: null,
    geometryTrusted: false,
  };
  const unidentified = JSON.parse(JSON.stringify(limited));
  unidentified.status = 'unidentified';
  unidentified.blocks = [];
  unidentified.scope = {
    ...unidentified.scope,
    kind: 'none',
    readBlocks: 0,
    readBytes: 0,
  };
  const inconsistent = JSON.parse(JSON.stringify(complete));
  inconsistent.blocks[0].bytes[2] = 12;
  for (const result of [complete, limited, unidentified, inconsistent]) {
    Object.assign(
      result,
      analyzeType5Memory({
        blocks: result.blocks,
        blockSize: result.scope.blockSize,
        reportedBlocks: result.scope.reportedBlocks,
        geometryTrusted: result.systemInfo.geometryTrusted,
      }),
    );
  }
  expect(limited.cc.status).toBe('incomplete');
  expect(inconsistent.cc.status).toBe('inconsistent');
  expect(complete.ndef.records).toHaveLength(2);
  for (const language of ['en', 'zh-Hant', 'ja']) {
    await i18n.changeLanguage(language);
    for (const isDark of [false, true]) {
      const styles = createStyles({
        colors: visualColors(isDark),
        spacing,
        type,
      });
      for (const result of [
        complete,
        limited,
        fixture,
        unidentified,
        inconsistent,
      ]) {
        let tree;
        await act(async () => {
          tree = renderer.create(
            <Type5InspectionResult result={result} styles={styles} />,
          );
        });
        expect(text(tree)).not.toContain('undefined');
        for (const node of tree.root.findAllByType(Text)) {
          expect(node.props.numberOfLines).toBeUndefined();
        }
        if (result.status === 'complete') {
          expect(text(tree)).toContain(tr('Reported range complete'));
        }
        if (result.cc.status === 'incomplete') {
          expect(text(tree)).toContain(tr('Incomplete'));
        }
        if (result.cc.status === 'inconsistent') {
          expect(text(tree)).toContain(
            tr('CC conflicts with reported geometry'),
          );
        }
        await act(async () => tree.unmount());
      }
    }
  }
});
