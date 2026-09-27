import React from 'react';
import {ScrollView, Text} from 'react-native';
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

test('Tag Detail makes missing NDEF explicit', async () => {
  const tree = await render({id: '01', techTypes: [], ndefMessage: []});
  expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain('No NDEF message');
  expect(tree.root.findAllByType('NdefMessage')).toHaveLength(0);
  await act(async () => tree.unmount());
});
