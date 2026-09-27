import React from 'react';
import {ScrollView, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import CustomTransceiveScreen from '../src/Screens/CustomTransceive';
import CommandItem from '../src/Components/CustomCommandItem';

jest.mock('react-native-nfc-manager', () => ({NfcTech: {NfcA: 'NfcA', NfcV: 'NfcV', IsoDep: 'IsoDep'}}));
jest.mock('../src/NfcProxy', () => ({__esModule: true, default: {customTransceiveNfcA: jest.fn(), customTransceiveNfcV: jest.fn(), customTransceiveIsoDep: jest.fn()}}));
jest.mock('react-native-screens/experimental', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => ({__esModule: true, default: 'Icon'}));
jest.mock('react-native-paper', () => ({Button: 'Button'}));
jest.mock('../src/Components/ScreenHeader', () => 'ScreenHeader');
jest.mock('../src/Components/CustomTransceiveModal', () => 'CustomTransceiveModal');
jest.mock('../src/visual/theme', () => ({
  useVisualTheme: () => ({
    colors: {background: '#FAFBFD', surface: '#FFFFFF', surfaceMuted: '#F0F5FB', text: '#0B1D3B', textMuted: '#506583', accent: '#2878C2', border: '#CCD9E8', technical: '#152B4D', danger: '#A52A25'},
    spacing: {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32},
    type: {caption: 12, body: 14, label: 15, hero: 28},
  }),
}));

async function render(component) {
  let tree;
  await act(async () => { tree = renderer.create(component); });
  return tree;
}

test('command rows show readable response bytes and labeled editable actions', async () => {
  const callbacks = {onMoveUp: jest.fn(), onMoveDown: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn()};
  const tree = await render(<CommandItem cmd={{type: 'command', payload: [0x30, 0xff]}} resp={[0x90, 0x00]} {...callbacks} />);
  const actions = tree.root.findAll((node) => node.props.accessibilityRole === 'button');
  const labels = [...new Set(actions.map((node) => node.props.accessibilityLabel))];
  expect(labels).toEqual(['UP', 'DOWN', 'EDIT', 'DELETE']);
  const texts = tree.root.findAllByType(Text).map((node) => node.props.children);
  expect(texts).toContain('30 FF');
  expect(texts).toContain('90 00');
  for (const [label, callback] of [['UP', callbacks.onMoveUp], ['DOWN', callbacks.onMoveDown], ['EDIT', callbacks.onEdit], ['DELETE', callbacks.onDelete]]) {
    await act(async () => actions.find((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function').props.onPress());
    expect(callback).toHaveBeenCalledTimes(1);
  }
  await act(async () => tree.unmount());
});

test('read-only command rows hide editing actions', async () => {
  const tree = await render(<CommandItem cmd={{type: 'delay', payload: '100'}} readOnly />);
  expect(tree.root.findAll((node) => node.props.accessibilityRole === 'button')).toHaveLength(0);
  expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain('100');
  await act(async () => tree.unmount());
});

test('Custom Transceive keeps Add and Execute controls and scrollable command list', async () => {
  const tree = await render(<CustomTransceiveScreen route={{params: {nfcTech: 'NfcA'}}} navigation={{goBack: jest.fn()}} />);
  expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  const buttons = tree.root.findAllByType('Button');
  expect(buttons.find((node) => node.props.accessibilityLabel === 'Add command')).toBeDefined();
  expect(buttons.find((node) => node.props.accessibilityLabel === 'Execute commands').props.disabled).toBe(true);
  await act(async () => tree.unmount());
});

test('read-only saved workflow retains command data and Execute but hides Add', async () => {
  const savedRecord = {name: 'Example', payload: {tech: 'NfcA', value: [{type: 'command', payload: [0x30, 0x00]}]}};
  const tree = await render(<CustomTransceiveScreen route={{params: {savedRecord, readOnly: true}}} navigation={{goBack: jest.fn()}} />);
  const buttons = tree.root.findAllByType('Button');
  expect(buttons.find((node) => node.props.accessibilityLabel === 'Add command')).toBeUndefined();
  expect(buttons.find((node) => node.props.accessibilityLabel === 'Execute commands').props.disabled).toBe(false);
  expect(tree.root.findByType(CommandItem).props.readOnly).toBe(true);
  expect(tree.root.findByType(CommandItem).props.cmd).toEqual(savedRecord.payload.value[0]);
  await act(async () => tree.unmount());
});
