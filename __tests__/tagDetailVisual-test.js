import React from 'react';
import {Platform, ScrollView, Text, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import TagDetailScreen from '../src/Screens/TagDetail';

jest.mock('react-native-screens/experimental', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('../src/Components/NdefMessage', () => 'NdefMessage');
jest.mock('../src/Utils/getTechList', () => ({
  getTechList: (tag) => (tag.techTypes || []).map((tech) => tech.replace(/android\.nfc\.tech\./, '')),
}));
jest.mock('../src/visual/theme', () => ({
  useVisualTheme: () => ({
    colors: {background: '#FAFBFD', surface: '#FFFFFF', surfaceMuted: '#F0F5FB', text: '#0B1D3B', textMuted: '#506583', accent: '#2878C2', border: '#CCD9E8', technical: '#152B4D'},
    spacing: {sm: 8, md: 12, lg: 16, xl: 24, xxl: 32},
    type: {caption: 12, body: 14, label: 15, hero: 28},
  }),
}));

async function render(tag) {
  let tree;
  await act(async () => { tree = renderer.create(<TagDetailScreen route={{params: {tag}}} />); });
  return tree;
}

test('Tag Detail presents selectable long UID and raw data in grouped scrollable sections', async () => {
  const tag = {
    id: 'AABBCCDDEEFF00112233445566778899',
    techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.Ndef'],
    metadata: {longValue: 'AB'.repeat(100)},
    ndefMessage: [{tnf: 1, type: [0x54], payload: [0]}],
  };
  const tree = await render(tag);
  expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  const text = tree.root.findAllByType(Text).map((node) => node.props.children);
  for (const label of ['UID', 'TECHNOLOGIES', 'NDEF', 'TAG OBJECT', 'NfcA', 'Ndef']) {
    expect(text).toContain(label);
  }
  expect(tree.root.findAllByType('NdefMessage')).toHaveLength(1);
  expect(tree.root.findAllByType(Text).find((node) => node.props.children === tag.id).props.selectable).toBe(true);
  expect(tree.root.findAllByType(Text).find((node) => node.props.children === JSON.stringify(tag, null, 2)).props.selectable).toBe(true);
  await act(async () => tree.unmount());
});

test('Tag Detail makes unavailable native records explicit without calling the tag empty', async () => {
  const tree = await render({id: '01', techTypes: [], ndefMessage: []});
  expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain('No NDEF records were supplied by this scan.');
  expect(tree.root.findAllByType('NdefMessage')).toHaveLength(0);
  await act(async () => tree.unmount());
});

test('IDm-only discovery retains selectable native data and every NDEF record', async () => {
  const tag = {tech: 'felica', idm: '0102030405060708', ndefMessage: [{tnf: 1, type: [84], payload: [0]}, {tnf: 2, type: [1], payload: [2]}]};
  const tree = await render(tag);
  const text = tree.root.findAllByType(Text);
  expect(text.map((node) => node.props.children)).toContain('IDm');
  expect(text.find((node) => node.props.children === tag.idm).props.selectable).toBe(true);
  expect(tree.root.findAllByType('NdefMessage')).toHaveLength(2);
  await act(async () => tree.unmount());
});

test('missing metadata stays usable, raw malformed records remain reachable', async () => {
  const tree = await render({ndefMessage: [null, {unexpected: 'raw'}]});
  expect(tree.root.findAllByType('NdefMessage')).toHaveLength(0);
  expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain(JSON.stringify({unexpected: 'raw'}, null, 2));
  await act(async () => tree.unmount());
  const missing = await render({});
  expect(missing.root.findAllByType(Text).map((node) => node.props.children)).toContain('NDEF data was not available in this scan. Its absence does not identify the cause.');
  await act(async () => missing.unmount());
});

test('NFC-V inspector recommendation only navigates and preserves compatibility uncertainty', async () => {
  const navigation = {navigate: jest.fn()};
  const tag = {tech: 'iso15693', id: 'E004010203040506'};
  let tree;
  await act(async () => { tree = renderer.create(<TagDetailScreen navigation={navigation} route={{params: {tag}}} />); });
  expect(navigation.navigate).not.toHaveBeenCalled();
  const tool = tree.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === 'ISO 15693 / NFC-V Inspector');
  await act(async () => tool.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('Type5MemoryScan', undefined);
  const text = tree.root.findAllByType(Text).map((node) => node.props.children);
  expect(text).toContain('Type 5 formatting is unconfirmed. The inspector checks available CC evidence.');
  if (Platform.OS === 'ios') {
    expect(text).toContain('iOS discovery is limited by the app’s configured ISO-DEP application identifiers and FeliCa system codes.');
  }
  await act(async () => tree.unmount());
});
