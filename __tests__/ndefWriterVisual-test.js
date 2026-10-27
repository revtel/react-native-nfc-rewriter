import React from 'react';
import {ScrollView} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import NdefWriteScreen from '../src/Screens/NdefWrite';
import RtdTextWriter from '../src/Components/RtdTextWriter';
import RtdUriWriter from '../src/Components/RtdUriWriter';
import RtdUriShortcutWriter from '../src/Components/RtdUriShortcutWriter';
import WifiSimpleWriter from '../src/Components/WifiSimpleWriter';
import VCardWriter from '../src/Components/VCardWriter';

const mockWrite = jest.fn();
jest.mock('react-native-nfc-manager', () => ({
  NfcTech: {Ndef: 'Ndef'},
  Ndef: {TNF_WELL_KNOWN: 1, TNF_MIME_MEDIA: 2, RTD_TEXT: 'T', RTD_URI: 'U', MIME_WFA_WSC: 'application/vnd.wfa.wsc'},
}));
jest.mock('../src/features/ndef-write/useNdefWriter', () => ({
  useNdefWriter: () => mockWrite,
}));
jest.mock('react-native-screens/experimental', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('../src/Components/ScreenHeader', () => 'ScreenHeader');
jest.mock('react-native-paper', () => {
  const Menu = ({children}) => children;
  Menu.Item = 'MenuItem';
  return {Button: 'Button', TextInput: 'TextInput', Menu};
});
jest.mock('../src/visual/theme', () => ({
  useVisualTheme: () => ({
    colors: {background: '#FAFBFD', surface: '#FFFFFF', text: '#0B1D3B', textMuted: '#506583', accent: '#2878C2', border: '#CCD9E8'},
    spacing: {sm: 8, lg: 16, xl: 24, xxl: 32},
    type: {caption: 12, body: 14, label: 15, hero: 28},
  }),
}));

async function render(component) {
  let tree;
  await act(async () => { tree = renderer.create(component); });
  return tree;
}

afterEach(() => mockWrite.mockClear());

test('NDEF detail routes all writer forms through a scrollable themed shell', async () => {
  const cases = [
    [{ndefType: 'TEXT'}, RtdTextWriter],
    [{ndefType: 'URI'}, RtdUriWriter],
    [{ndefType: 'URI', scheme: 'tel:'}, RtdUriShortcutWriter],
    [{ndefType: 'URI', scheme: 'sms:'}, RtdUriShortcutWriter],
    [{ndefType: 'URI', scheme: 'mailto:'}, RtdUriShortcutWriter],
    [{ndefType: 'WIFI_SIMPLE'}, WifiSimpleWriter],
    [{ndefType: 'VCARD'}, VCardWriter],
  ];
  for (const [params, Component] of cases) {
    const tree = await render(<NdefWriteScreen route={{params}} navigation={{goBack: jest.fn()}} />);
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
    expect(tree.root.findAllByType(Component)).toHaveLength(1);
    await act(async () => tree.unmount());
  }
});

test.each([
  [RtdTextWriter, {value: 'Saved text'}, 'Text', 'Saved text', 'Saved text'],
  [RtdUriWriter, {value: {value: 'example.com', prefix: 'https://'}}, 'URI', 'example.com', 'https://example.com'],
  [RtdUriShortcutWriter, {scheme: 'tel:', value: {value: '1234'}}, 'Number', '1234', 'tel:1234'],
  [WifiSimpleWriter, {value: {ssid: 'Lab', networkKey: 'secret'}}, 'SSID', 'Lab', {ssid: 'Lab', networkKey: 'secret'}],
  [VCardWriter, {value: {name: 'Ada', tel: '1234'}}, 'Name', 'Ada', {name: 'Ada', org: '', tel: '1234', email: ''}],
])('%s retains saved values and write payload', async (Component, props, label, value, expected) => {
  const tree = await render(<Component {...props} />);
  const field = tree.root.findAllByType('TextInput').find((node) => node.props.label === label);
  expect(field.props.value).toBe(value);
  const action = tree.root.findAllByType('Button').find((node) => node.props.accessibilityLabel === 'Write record to NFC tag');
  expect(action).toBeDefined();
  await act(async () => action.props.onPress());
  expect(mockWrite).toHaveBeenLastCalledWith(expected);
  await act(async () => tree.unmount());
});

test('saved NDEF editor forwards the captured library revision', async () => {
  const tree = await render(<NdefWriteScreen route={{params: {ndefType: 'TEXT', savedRecordIdx: 4, savedRecordRevision: 17}}} navigation={{goBack: jest.fn()}} />);
  expect(tree.root.findByType('ScreenHeader').props).toMatchObject({savedRecordIdx: 4, savedRecordRevision: 17});
  await act(async () => tree.unmount());
});
