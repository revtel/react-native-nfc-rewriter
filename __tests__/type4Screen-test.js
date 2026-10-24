import React from 'react';
import {
  FlatList,
  Linking,
  Platform,
  Share,
  Text,
  TouchableOpacity,
} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import NfcManager from 'react-native-nfc-manager';
import NfcProxy from '../src/NfcProxy';
import Type4NdefScanScreen, {
  Type4InspectionResult,
  Type4TranscriptItem,
  Type4ExchangeDetails,
  createStyles,
} from '../src/Screens/Type4NdefScan';
import {createType4Fixture} from '../test-support/type4Fixtures';
import {
  analyzeType4Cc,
  analyzeType4Ndef,
} from '../src/features/type4-ndef/model';
import {createType4Report} from '../src/features/type4-ndef/report';
import {i18n, translateText as tr} from '../src/i18n';
import {spacing, type, visualColors} from '../src/visual/theme';

jest.mock('../src/NfcProxy', () => ({scanType4Ndef: jest.fn()}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined)},
  Ndef: require('react-native-nfc-manager/ndef-lib'),
}));
const originalPlatform = Platform.OS;
const style = (dark = false) =>
  createStyles({colors: visualColors(dark), spacing, type});
function text(tree) {
  return tree.root
    .findAllByType(Text)
    .flatMap((node) => [node.props.children].flat(Infinity))
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ');
}
function button(tree, title) {
  return tree.root
    .findAllByType(Button)
    .find((node) => node.props.children === title);
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
    tree = renderer.create(<Type4NdefScanScreen navigation={navigation} />);
  });
  return tree;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Share, 'share').mockResolvedValue({action: Share.sharedAction});
});
afterEach(async () => {
  await i18n.changeLanguage('en');
  Platform.OS = originalPlatform;
  jest.restoreAllMocks();
});

test('fixtures use real CC/NDEF analyzers and internally consistent verified byte accounting', () => {
  for (const variant of [
    'complete',
    'partial',
    'restricted',
    'changed',
    'unavailable',
    'long',
  ]) {
    const result = createType4Fixture(variant);
    expect(result.cc).toEqual(analyzeType4Cc(result.cc.rawBytes));
    expect(result.scope.commandsSent).toBe(result.transcript.length);
    expect(result.scope.verifiedFileBytes).toBe(
      result.cc.rawBytes.length +
        (result.file.rawNlen?.length || 0) +
        result.scope.readBytes,
    );
    if (result.consistency.status === 'equal-length') {
      expect(result.ndef).toEqual(
        analyzeType4Ndef({
          bytes: result.file.chunks.flatMap((chunk) => chunk.bytes),
          declaredLength: result.file.nlen,
          complete: true,
        }),
      );
    }
  }
  expect(createType4Fixture().ndef.records).toHaveLength(2);
});

test('missing status words keep nullable evidence and never invent an oversized response cause', async () => {
  const exchange = {
    ...createType4Fixture().transcript[0],
    data: [],
    responseBytes: [0x90],
    sw1: null,
    sw2: null,
    responseLength: 1,
    responseTruncated: true,
    outcome: 'malformed-response',
  };
  let tree;
  await act(async () => {
    tree = renderer.create(
      <Type4TranscriptItem exchange={exchange} styles={style()} />,
    );
  });
  expect(text(tree).replace(/\s+/g, ' ')).toContain('SW Unknown');
  await act(async () => tree.root.findByType(TouchableOpacity).props.onPress());
  expect(text(tree)).toContain(
    'Incomplete response evidence; only the available bounded prefix is retained.',
  );
  expect(text(tree).toLowerCase()).not.toContain('oversized');
  expect(text(tree)).toContain('90');
  await act(async () => tree.unmount());
});

test('decoded URI is selectable plain text and never opens a link', async () => {
  const openURL = jest.spyOn(Linking, 'openURL');
  const result = createType4Fixture();
  const payload = [
    0xd1,
    1,
    12,
    0x55,
    4,
    ...Array.from('example.com', (char) => char.charCodeAt(0)),
  ];
  result.ndef = analyzeType4Ndef({
    bytes: payload,
    declaredLength: payload.length,
    complete: true,
  });
  let tree;
  await act(async () => {
    tree = renderer.create(
      <Type4InspectionResult result={result} styles={style()} />,
    );
  });
  expect(
    tree.root
      .findAllByType(Text)
      .filter((node) => node.props.selectable)
      .map((node) => node.props.children),
  ).toContain('https://example.com');
  expect(openURL).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('explicit scan/share only, platform scope is visible and no URI executes', async () => {
  Platform.OS = 'ios';
  const openURL = jest.spyOn(Linking, 'openURL');
  const result = createType4Fixture();
  NfcProxy.scanType4Ndef.mockResolvedValue(result);
  const tree = await open();
  expect(NfcProxy.scanType4Ndef).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findAllByType(TouchableOpacity)
      .find(
        (node) =>
          node.props.accessibilityLabel === 'Platform and trace details',
      )
      .props.onPress(),
  );
  expect(text(tree)).toContain('iOS can automatically SELECT');
  await act(async () => {
    await button(tree, 'SCAN TAG').props.onPress();
  });
  expect(text(tree)).toContain('Declared NDEF bytes acquired');
  expect(text(tree)).toContain('NDEF record 2');
  expect(openURL).not.toHaveBeenCalled();
  expect(Share.share).not.toHaveBeenCalled();
  await act(async () => {
    await button(tree, 'SHARE JSON').props.onPress();
  });
  expect(JSON.parse(Share.share.mock.calls[0][0].message)).toEqual(
    createType4Report(result),
  );
  expect(
    JSON.parse(Share.share.mock.calls[0][0].message).metadataAcquisition,
  ).toEqual({
    method: 'none',
    automaticPlatformSelection: true,
    fullRfTrace: false,
  });
  await act(async () => tree.unmount());
});

test.each(['en', 'zh-Hant', 'ja'])(
  'platform disclosure keeps scan reachable and exposes all notices without RF: %s',
  async (language) => {
    await i18n.changeLanguage(language);
    Platform.OS = 'ios';
    const tree = await open();
    const ios = tr(
      'iOS can automatically SELECT configured applications before this inspector sends its first APDU.',
    );
    const trace = tr(
      'The transcript contains app-controlled APDUs only; it is not a complete RF trace.',
    );
    expect(button(tree, tr('SCAN TAG'))).toBeDefined();
    expect(text(tree)).toContain(
      tr(
        'Read-only commands may change selection, session state, or read counters.',
      ),
    );
    expect(text(tree)).not.toContain(ios);
    const disclosure = () =>
      tree.root
        .findAllByType(TouchableOpacity)
        .find(
          (node) =>
            node.props.accessibilityLabel === tr('Platform and trace details'),
        );
    expect(disclosure().props.accessibilityState.expanded).toBe(false);
    await act(async () => disclosure().props.onPress());
    expect(disclosure().props.accessibilityState.expanded).toBe(true);
    expect(text(tree)).toContain(ios);
    expect(text(tree)).toContain(trace);
    expect(text(tree)).toContain(tr('This inspection does not validate SDM.'));
    expect(NfcProxy.scanType4Ndef).not.toHaveBeenCalled();
    await act(async () => disclosure().props.onPress());
    expect(text(tree)).not.toContain(ios);
    await act(async () => tree.unmount());
  },
);

test('duplicate scan taps are guarded and empty cancellation retains previous result', async () => {
  NfcProxy.scanType4Ndef.mockResolvedValueOnce(createType4Fixture());
  const tree = await open();
  await act(async () => {
    await button(tree, 'SCAN TAG').props.onPress();
  });
  const pending = deferred();
  NfcProxy.scanType4Ndef.mockReturnValueOnce(pending.promise);
  let scan;
  await act(async () => {
    const press = button(tree, 'SCAN AGAIN').props.onPress;
    scan = press();
    press();
  });
  expect(NfcProxy.scanType4Ndef).toHaveBeenCalledTimes(2);
  const options = NfcProxy.scanType4Ndef.mock.calls[1][0];
  await act(async () => {
    button(tree, 'CANCEL').props.onPress();
  });
  expect(options.shouldContinue()).toBe(false);
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  await act(async () => {
    options.onProgress({phase: 'read-ndef', bytesRead: 1234, commandsSent: 50});
    pending.resolve(null);
    await scan;
  });
  expect(text(tree)).toContain('Declared NDEF bytes acquired');
  expect(text(tree)).not.toContain('1234');
  await act(async () => tree.unmount());
});

test('cancelled verified CC prefix is retained and blur/unmount rejects late native work', async () => {
  const pending = deferred();
  NfcProxy.scanType4Ndef.mockReturnValueOnce(pending.promise);
  const listeners = {};
  const navigation = {
    isFocused: () => true,
    addListener: (name, callback) => {
      listeners[name] = callback;
      return jest.fn();
    },
  };
  const tree = await open(navigation);
  let scan;
  await act(async () => {
    scan = button(tree, 'SCAN TAG').props.onPress();
  });
  await act(async () => {
    button(tree, 'CANCEL').props.onPress();
  });
  const prefix = createType4Fixture('restricted');
  prefix.cancelled = true;
  prefix.status = 'partial';
  await act(async () => {
    pending.resolve(prefix);
    await scan;
  });
  expect(text(tree)).toContain('Cancelled; verified bytes retained.');
  expect(text(tree)).toContain('CC evidence only');
  const next = deferred();
  NfcProxy.scanType4Ndef.mockReturnValueOnce(next.promise);
  await act(async () => {
    scan = button(tree, 'SCAN AGAIN').props.onPress();
  });
  const options = NfcProxy.scanType4Ndef.mock.calls[1][0];
  await act(async () => listeners.blur());
  expect(options.shouldContinue()).toBe(false);
  await act(async () => {
    next.resolve(createType4Fixture());
    await scan;
    listeners.focus();
  });
  expect(text(tree)).not.toContain('Declared NDEF bytes acquired');
  await act(async () => tree.unmount());
  expect(options.shouldContinue()).toBe(false);
});

test('long transcript stays virtualized and every exchange can reveal its full evidence', async () => {
  const result = createType4Fixture('long');
  expect(result.transcript.length).toBeGreaterThan(550);
  NfcProxy.scanType4Ndef.mockResolvedValueOnce(result);
  const tree = await open();
  await act(async () => {
    await button(tree, 'SCAN TAG').props.onPress();
  });
  const list = tree.root.findByType(FlatList);
  expect(list.props.data).toHaveLength(result.transcript.length);
  expect(list.props.initialNumToRender).toBe(8);
  const payloadToggle = button(tree, 'SHOW ALL PAYLOAD BYTES');
  expect(payloadToggle).toBeDefined();
  await act(async () => payloadToggle.props.onPress());
  expect(button(tree, 'HIDE PAYLOAD BYTES')).toBeDefined();
  await act(async () => button(tree, 'HIDE PAYLOAD BYTES').props.onPress());
  const exchange = {
    ...result.transcript[result.transcript.length - 1],
    message: '原始 native diagnostic '.repeat(80),
    messageLength: 5000,
    messageTruncated: true,
  };
  let row;
  await act(async () => {
    row = renderer.create(
      <Type4TranscriptItem exchange={exchange} styles={style()} />,
    );
  });
  expect(text(row)).not.toContain(exchange.message);
  await act(async () => {
    row.root.findByType(TouchableOpacity).props.onPress();
  });
  expect(
    row.root.findByType(TouchableOpacity).props.accessibilityState.expanded,
  ).toBe(true);
  expect(text(row)).toContain(exchange.message);
  expect(text(row)).toContain('00 B0 00 00 02');
  expect(text(row)).toContain('5000');
  for (const node of row.root.findAllByType(Text)) {
    expect(node.props.numberOfLines).toBeUndefined();
  }
  await act(async () => {
    tree.unmount();
    row.unmount();
  });
});

test.each(['en', 'zh-Hant', 'ja'])(
  'all states, non-atomic consistency and report bytes remain stable: %s',
  async (language) => {
    await i18n.changeLanguage(language);
    for (const dark of [false, true]) {
      for (const variant of [
        'complete',
        'partial',
        'restricted',
        'changed',
        'unavailable',
      ]) {
        const result = createType4Fixture(variant);
        let tree;
        await act(async () => {
          tree = renderer.create(
            <Type4InspectionResult result={result} styles={style(dark)} />,
          );
        });
        expect(text(tree)).toContain(
          tr(
            'Reads are sequential. Equal initial and final NLEN confirms only equal lengths, not an atomic snapshot, unchanged content, or authenticity.',
          ),
        );
        expect(text(tree)).not.toContain('undefined');
        expect(createType4Report(result)).toEqual(
          createType4Report(createType4Fixture(variant)),
        );
        for (const node of tree.root.findAllByType(Text)) {
          expect(node.props.numberOfLines).toBeUndefined();
          expect(node.props.allowFontScaling).not.toBe(false);
        }
        await act(async () => tree.unmount());
      }
    }
    let tree;
    const exchange = createType4Fixture('partial').transcript.slice(-1)[0];
    await act(async () => {
      tree = renderer.create(
        <Type4ExchangeDetails exchange={exchange} styles={style()} />,
      );
    });
    expect(text(tree)).toContain('69 82');
    await act(async () => tree.unmount());
  },
);
