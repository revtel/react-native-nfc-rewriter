import React from 'react';
import {Buffer} from 'buffer';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import Clipboard from '@react-native-clipboard/clipboard';
import TagDetailScreen from '../src/Screens/TagDetail';
import NdefMessage from '../src/Components/NdefMessage';
import {i18n, translateText as tr} from '../src/i18n';
import {visualColors} from '../src/visual/theme';
import {createTagDiscovery} from '../src/features/tag-discovery/model';

jest.mock('react-native-screens/experimental', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {setString: jest.fn()},
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const bytes = (value) => Array.from(Buffer.from(value, 'utf8'));
const record = (value) => ({
  tnf: 1,
  type: [84],
  payload: [2, 101, 110, ...bytes(value)],
});
const uriRecord = (value) => ({
  tnf: 1,
  type: 'U',
  payload: [0, ...bytes(value)],
});
const strings = (tree) =>
  tree.root
    .findAllByType(Text)
    .flatMap((node) => [node.props.children].flat(Infinity))
    .filter((value) => typeof value === 'string' || typeof value === 'number');
const text = (tree) => strings(tree).join(' ');
const action = (tree, label) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.accessibilityLabel === label);
const view = (tag, navigation, key = 'detail') => (
  <TagDetailScreen navigation={navigation} route={{key, params: {tag}}} />
);
async function render(tag, navigation) {
  let tree;
  await act(async () => {
    tree = renderer.create(view(tag, navigation));
  });
  return tree;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return {promise, resolve, reject};
}

beforeEach(() => {
  jest.clearAllMocks();
  Clipboard.setString.mockReset().mockResolvedValue(undefined);
  useColorScheme.mockReturnValue('light');
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(async () => {
  await i18n.changeLanguage('en');
  jest.restoreAllMocks();
});

test('content leads summary/tools and raw JSON is lazy behind an independent disclosure', async () => {
  const tag = {
    id: 'AABBCCDDEEFF00112233445566778899',
    techTypes: ['android.nfc.tech.NfcA'],
    metadata: {secretValue: 'only-in-raw'},
    oddArray: [1, 'private-array-value'],
    ndefMessage: [record('Hello scanner')],
    ndefStatus: {status: 2, capacity: 256},
  };
  const raw = JSON.stringify(tag, null, 2);
  const stringify = jest.spyOn(JSON, 'stringify');
  const tree = await render(tag);
  const rendered = text(tree);
  expect(rendered.indexOf('Hello scanner')).toBeLessThan(
    rendered.indexOf('SCAN SUMMARY'),
  );
  expect(rendered.indexOf('SCAN SUMMARY')).toBeLessThan(
    rendered.indexOf('AVAILABLE TOOLS'),
  );
  expect(rendered.indexOf('AVAILABLE TOOLS')).toBeLessThan(
    rendered.lastIndexOf('Technical details'),
  );
  expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  expect(tree.root.findAllByType(NdefMessage)).toHaveLength(1);
  expect(
    action(tree, 'Technical details').props.accessibilityState.expanded,
  ).toBe(false);
  expect(action(tree, 'Raw tag JSON').props.accessibilityState.expanded).toBe(
    false,
  );
  expect(strings(tree)).not.toContain(raw);
  expect(stringify.mock.calls.filter((args) => args[0] === tag)).toHaveLength(
    0,
  );
  await act(async () => action(tree, 'Technical details').props.onPress());
  expect(text(tree)).toContain('Object: 1 fields');
  expect(text(tree)).toContain('Array: 2 items');
  expect(text(tree)).not.toContain('only-in-raw');
  expect(text(tree)).not.toContain('private-array-value');
  expect(strings(tree)).toContain('Payload byte count');
  expect(strings(tree)).not.toContain(raw);
  expect(stringify.mock.calls.filter((args) => args[0] === tag)).toHaveLength(
    0,
  );
  await act(async () => action(tree, 'Raw tag JSON').props.onPress());
  expect(strings(tree)).toContain(raw);
  expect(text(tree).indexOf('Copy raw tag JSON')).toBeLessThan(
    text(tree).indexOf(raw),
  );
  expect(stringify.mock.calls.filter((args) => args[0] === tag)).toHaveLength(
    1,
  );
  await act(async () => action(tree, 'Technical details').props.onPress());
  expect(action(tree, 'Raw tag JSON').props.accessibilityState.expanded).toBe(
    true,
  );
  expect(strings(tree)).toContain(raw);
  await act(async () => {
    await action(tree, 'Copy raw tag JSON').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenLastCalledWith(raw);
  await act(async () => tree.unmount());
});

test('every supplied record stays in order, including malformed, UTF-16, MIME and external-type records', async () => {
  const tag = {
    ndefMessage: [
      record('first'),
      null,
      {tnf: 1, type: 'T', payload: [0x80, 0]},
      {tnf: 2, type: 'application/vnd.wfa.wsc', payload: [1, 2]},
      {tnf: 4, type: 'application/vnd.wfa.wsc', payload: [1]},
      record('last'),
    ],
  };
  const tree = await render(tag);
  expect(tree.root.findAllByType(NdefMessage)).toHaveLength(6);
  expect(text(tree)).toContain('Record 2 · Malformed record');
  expect(text(tree)).toContain('Record 3 · Unsupported record');
  expect(text(tree)).toContain('Record 4 · Wi-Fi data');
  expect(text(tree)).toContain('Record 5 · Unknown record');
  expect(text(tree).indexOf('first')).toBeLessThan(
    text(tree).indexOf('Record 2'),
  );
  expect(text(tree).indexOf('Record 5')).toBeLessThan(
    text(tree).indexOf('last'),
  );
  expect(text(tree)).toContain('UTF-16 text is not decoded.');
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Clipboard.setString).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('Android native hex-string record IDs keep readable Text/URI and exact copy/raw sources', async () => {
  const message = 'Android 中文 text';
  const uri = 'https://example.com/d21';
  const tag = {
    id: '04AABBCCDDEEFF',
    techTypes: [
      'android.nfc.tech.NfcA',
      'android.nfc.tech.IsoDep',
      'android.nfc.tech.Ndef',
    ],
    ndefMessage: [
      {...record(message), id: ''},
      {
        tnf: 1,
        type: [85],
        id: 'A1B2',
        payload: [4, ...bytes('example.com/d21')],
      },
    ],
  };
  const tree = await render(tag);
  expect(text(tree)).toContain('Record 1 · Text');
  expect(text(tree)).toContain('Record 2 · Link');
  expect(text(tree)).toContain(message);
  expect(text(tree)).toContain(uri);
  expect(text(tree)).not.toContain('Malformed record');
  expect(Linking.openURL).not.toHaveBeenCalled();
  await act(async () => {
    await action(tree, 'Copy content for record 1').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenLastCalledWith(message);
  await act(async () => {
    await action(tree, 'Copy content for record 2').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenLastCalledWith(uri);
  await act(async () => action(tree, 'Raw tag JSON').props.onPress());
  const raw = JSON.stringify(tag, null, 2);
  expect(strings(tree)).toContain(raw);
  await act(async () => {
    await action(tree, 'Copy raw tag JSON').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenLastCalledWith(raw);
  expect(tag.ndefMessage.map((item) => item.id)).toEqual(['', 'A1B2']);
  expect(raw).toContain('"id": ""');
  expect(raw).toContain('"id": "A1B2"');
  await act(async () => tree.unmount());
});

test.each([
  [
    {ndefMessage: []},
    'No NDEF records were supplied by this scan.',
    'Records supplied: 0',
  ],
  [{}, 'NDEF data was not available in this scan.', 'Record count unavailable'],
  [
    {ndefMessage: null},
    'The supplied NDEF records field is invalid.',
    'Record count unavailable',
  ],
])(
  'empty, missing and invalid records remain distinct: %p',
  async (tag, notice, count) => {
    const tree = await render(tag);
    expect(text(tree)).toContain(notice);
    expect(text(tree)).toContain(count);
    expect(tree.root.findAllByType(NdefMessage)).toHaveLength(0);
    await act(async () => tree.unmount());
  },
);

test('status 1 is unconfirmed while positive metadata for status 2/3 is explicitly system-reported', async () => {
  for (const [status, capacity, label, capacityVisible] of [
    [1, 256, 'NDEF support is unconfirmed', false],
    [2, 256, 'System reports NDEF read/write', true],
    [3, 256, 'System reports NDEF read-only', true],
    [2, 0, 'System reports NDEF read/write', false],
    [undefined, 256, 'NDEF status is unavailable', false],
  ]) {
    const tree = await render({
      ndefStatus: {status, capacity},
      ndefMessage: [],
    });
    expect(text(tree)).toContain(label);
    expect(text(tree).includes('System-reported capacity:')).toBe(
      capacityVisible,
    );
    expect(text(tree)).not.toContain('unsupported NDEF');
    await act(async () => tree.unmount());
  }
});

test('UID/IDm copies use full strings and compatible tools only navigate with original parameters', async () => {
  const navigation = {navigate: jest.fn()};
  const tag = {
    id: 'LONG'.repeat(30),
    idm: '0102030405060708',
    techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.IsoDep'],
  };
  const tree = await render(tag, navigation);
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(Linking.openURL).not.toHaveBeenCalled();
  await act(async () => {
    await action(tree, 'Copy UID').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenLastCalledWith(tag.id);
  await act(async () => {
    await action(tree, 'Copy IDm').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenLastCalledWith(tag.idm);
  await act(async () =>
    action(tree, 'Type 4 NDEF / APDU Inspector').props.onPress(),
  );
  expect(navigation.navigate).toHaveBeenLastCalledWith(
    'Type4NdefScan',
    undefined,
  );
  await act(async () =>
    action(tree, 'Custom ISO-DEP Transceive').props.onPress(),
  );
  expect(navigation.navigate).toHaveBeenLastCalledWith('CustomTransceive', {
    nfcTech: 'IsoDep',
  });
  expect(text(tree)).toContain(
    'ISO-DEP alone does not confirm Type 4 formatting.',
  );
  await act(async () => tree.unmount());
  const nfcV = await render({tech: 'iso15693'}, navigation);
  await act(async () =>
    action(nfcV, 'ISO 15693 / NFC-V Inspector').props.onPress(),
  );
  expect(navigation.navigate).toHaveBeenLastCalledWith(
    'Type5MemoryScan',
    undefined,
  );
  expect(text(nfcV)).toContain('Type 5 formatting is unconfirmed.');
  if (Platform.OS === 'ios')
    expect(text(nfcV)).toContain('iOS discovery is limited');
  await act(async () => nfcV.unmount());
});

test('same-UID replacement resets all disclosure/content/feedback state and ignores pending old copy', async () => {
  const long = 'https://example.com/' + 'destination'.repeat(50);
  const first = {id: 'same-uid', ndefMessage: [uriRecord(long)]};
  const tree = await render(first);
  await act(async () => action(tree, 'Technical details').props.onPress());
  await act(async () => action(tree, 'Raw tag JSON').props.onPress());
  await act(async () =>
    action(tree, 'Full content for record 1').props.onPress(),
  );
  await act(async () => {
    await action(tree, 'Copy UID').props.onPress();
  });
  expect(text(tree)).toContain('Copied to clipboard.');
  const pending = deferred();
  Clipboard.setString.mockReturnValueOnce(pending.promise);
  let copying;
  await act(async () => {
    copying = action(tree, 'Copy UID').props.onPress();
  });
  const second = {id: 'same-uid', ndefMessage: [uriRecord(long + '-new')]};
  await act(async () => tree.update(view(second)));
  await act(async () => {
    pending.reject(new Error('old-copy'));
    await copying;
  });
  expect(
    action(tree, 'Technical details').props.accessibilityState.expanded,
  ).toBe(false);
  expect(action(tree, 'Raw tag JSON').props.accessibilityState.expanded).toBe(
    false,
  );
  expect(
    action(tree, 'Full content for record 1').props.accessibilityState.expanded,
  ).toBe(false);
  expect(action(tree, 'Open link for record 1')).toBeUndefined();
  expect(text(tree)).not.toContain('Copied to clipboard.');
  expect(text(tree)).not.toContain('Could not copy.');
  await act(async () => tree.unmount());
});

test('locale updates preserve user expansion and pending old link failures cannot affect a new scan', async () => {
  const long = 'https://example.com/' + 'x'.repeat(300);
  const first = {id: 'same', ndefMessage: [uriRecord(long)]};
  const tree = await render(first);
  await act(async () => action(tree, 'Technical details').props.onPress());
  await act(async () =>
    action(tree, 'Full content for record 1').props.onPress(),
  );
  await act(async () => i18n.changeLanguage('ja'));
  expect(
    action(tree, tr('Technical details')).props.accessibilityState.expanded,
  ).toBe(true);
  expect(
    action(tree, tr('Full content for record {{number}}', {number: 1})).props
      .accessibilityState.expanded,
  ).toBe(true);
  const pending = deferred();
  Linking.openURL.mockReturnValueOnce(pending.promise);
  let opening;
  await act(async () => {
    opening = action(
      tree,
      tr('Open link for record {{number}}', {number: 1}),
    ).props.onPress();
  });
  const second = {id: 'same', ndefMessage: [record('new scan')]};
  await act(async () => tree.update(view(second)));
  await act(async () => {
    pending.reject(new Error('old-open'));
    await opening;
  });
  expect(text(tree)).toContain('new scan');
  expect(text(tree)).not.toContain(
    tr('Could not open this link. You can still copy the target.'),
  );
  await act(async () => tree.unmount());
});

test.each(['en', 'zh-Hant', 'ja'])(
  'localized themed scan results keep raw values and reachable actions: %s',
  async (language) => {
    await i18n.changeLanguage(language);
    for (const scheme of ['light', 'dark']) {
      useColorScheme.mockReturnValue(scheme);
      const tag = {
        id: '04ABCDE0',
        ndefMessage: [
          record('中文 English 日本語'),
          {tnf: 2, type: 'text/vcard', payload: [1]},
          null,
        ],
      };
      const tree = await render(tag);
      expect(text(tree)).toContain('中文 English 日本語');
      expect(text(tree)).toContain(tr('SCAN SUMMARY'));
      await act(async () =>
        action(tree, tr('Technical details')).props.onPress(),
      );
      await act(async () => action(tree, tr('Raw tag JSON')).props.onPress());
      expect(strings(tree)).toContain(JSON.stringify(tag, null, 2));
      for (const node of tree.root.findAllByType(TouchableOpacity))
        expect(
          StyleSheet.flatten(node.props.style).minHeight,
        ).toBeGreaterThanOrEqual(48);
      const content = tree.root
        .findAllByType(Text)
        .find((node) => node.props.children === '中文 English 日本語');
      expect(StyleSheet.flatten(content.props.style).color).toBe(
        visualColors(scheme === 'dark').text,
      );
      expect(content.props.selectable).toBe(true);
      expect(content.props.allowFontScaling).not.toBe(false);
      await act(async () => tree.unmount());
    }
  },
);

test.each(['en', 'zh-Hant', 'ja'].flatMap((language) => ['light', 'dark'].map((theme) => [language, theme])))('acquired Type5 content and normalized UID copy retain raw data in %s/%s', async (language, theme) => {
  await i18n.changeLanguage(language);
  useColorScheme.mockReturnValue(theme);
  const tag = Object.freeze({id: '6367CA17080104E0', techTypes: ['android.nfc.tech.NfcV'], ndefMessage: null});
  const records = [record('Acquired Type 5 content')];
  const acquisition = {source: 'type5-raw-read', status: 'available', records, evidence: {status: 'limited', cc: {status: 'supported'}, ndef: {status: 'decoded'}, scope: {readBlocks: 3}}};
  const discovery = createTagDiscovery(tag, 'android', acquisition);
  let tree;
  await act(async () => { tree = renderer.create(<TagDetailScreen route={{params: {tag, discovery}}} />); });
  expect(text(tree)).toContain('Acquired Type 5 content');
  expect(text(tree)).toContain('E004010817CA6763');
  expect(discovery.limitations).not.toContain('type5-format-unconfirmed');
  await act(async () => action(tree, tr('Copy {{kind}}', {kind: 'UID'})).props.onPress());
  expect(Clipboard.setString).toHaveBeenCalledWith('E004010817CA6763');
  expect(text(tree)).not.toContain(JSON.stringify(acquisition, null, 2));
  await act(async () => action(tree, tr('Technical details')).props.onPress());
  expect(text(tree)).toContain(tr('Bounded Type 5 read'));
  expect(text(tree)).toContain(JSON.stringify(acquisition, null, 2));
  await act(async () => action(tree, tr('Raw tag JSON')).props.onPress());
  expect(text(tree)).toContain(JSON.stringify(tag, null, 2));
  await act(async () => tree.unmount());
});
