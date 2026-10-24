import React from 'react';
import {ScrollView, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import CustomTransceiveScreen from '../src/Screens/CustomTransceive';
import CommandItem from '../src/Components/CustomCommandItem';
import DraggableFlatList from 'react-native-draggable-flatlist';
import NfcProxy from '../src/NfcProxy';

jest.mock('react-native-draggable-flatlist', () => {
  const {ScrollView: MockScrollView, View} = require('react-native');
  return {
    __esModule: true,
    default: ({data, renderItem, keyExtractor, ListHeaderComponent, ListEmptyComponent}) => (
      <MockScrollView>
        {ListHeaderComponent}
        {data.length === 0 && ListEmptyComponent}
        {data.map((item, index) => (
          <View key={keyExtractor(item)}>
            {renderItem({item, getIndex: () => index, drag: jest.fn(), isActive: false})}
          </View>
        ))}
      </MockScrollView>
    ),
  };
});
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
  const callbacks = {onMoveUp: jest.fn(), onMoveDown: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn(), onDrag: jest.fn()};
  const tree = await render(<CommandItem cmd={{type: 'command', payload: [0x30, 0xff]}} resp={[0x90, 0x00]} {...callbacks} />);
  const actions = tree.root.findAll((node) => node.props.accessibilityRole === 'button');
  const labels = [...new Set(actions.map((node) => node.props.accessibilityLabel))];
  expect(labels).toEqual(['Reorder command', 'EDIT', 'DELETE']);
  const texts = tree.root.findAllByType(Text).map((node) => node.props.children);
  expect(texts).toContain('30 FF');
  expect(texts).toContain('90 00');
  for (const [label, callback] of [['EDIT', callbacks.onEdit], ['DELETE', callbacks.onDelete]]) {
    await act(async () => actions.find((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function').props.onPress());
    expect(callback).toHaveBeenCalledTimes(1);
  }
  const handle = actions.find((node) => node.props.accessibilityLabel === 'Reorder command');
  await act(async () => handle.props.onLongPress());
  expect(callbacks.onDrag).toHaveBeenCalledTimes(1);
  await act(async () => handle.props.onAccessibilityAction({nativeEvent: {actionName: 'moveUp'}}));
  expect(callbacks.onMoveUp).toHaveBeenCalledTimes(1);
  await act(async () => handle.props.onAccessibilityAction({nativeEvent: {actionName: 'moveDown'}}));
  expect(callbacks.onMoveDown).toHaveBeenCalledTimes(1);
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

test('long command lists and responses keep execution controls outside scrolling content', async () => {
  const commands = Array.from({length: 40}, (_, index) => ({
    type: 'command',
    payload: [0x30, index],
  }));
  const responses = commands.map(() => Array(256).fill(0xaa));
  NfcProxy.customTransceiveNfcA.mockResolvedValue([true, responses]);
  const tree = await render(
    <CustomTransceiveScreen
      route={{params: {savedRecord: {payload: {tech: 'NfcA', value: commands}}}}}
      navigation={{goBack: jest.fn()}}
    />,
  );
  const execute = () => tree.root.findAllByType('Button').find(
    (node) => node.props.accessibilityLabel === 'Execute commands',
  );
  const scroll = tree.root.findAllByType(ScrollView).find(
    (node) => !node.props.horizontal,
  );
  expect(scroll.findAllByType(CommandItem)).toHaveLength(40);
  expect(scroll.findAllByType('Button')).toHaveLength(0);
  expect(execute().props.disabled).toBe(false);

  await act(async () => execute().props.onPress());
  expect(NfcProxy.customTransceiveNfcA.mock.calls.at(-1)[0]).toEqual(commands);
  expect(scroll.findAllByType(CommandItem).map((node) => node.props.resp)).toEqual(responses);
  expect(scroll.findAllByType('Button')).toHaveLength(0);
  await act(async () => tree.unmount());
});

test('long read-only configurations keep custom Execute outside scrolling content', async () => {
  const onExecute = jest.fn();
  const savedRecord = {
    payload: {tech: 'NfcA', value: []},
    parameters: Array.from({length: 30}, (_, index) => ({name: `Parameter ${index}`})),
    description: 'Long workflow description. '.repeat(100),
    onExecute,
  };
  const tree = await render(
    <CustomTransceiveScreen
      route={{params: {savedRecord, readOnly: true}}}
      navigation={{goBack: jest.fn()}}
    />,
  );
  const scroll = tree.root.findByType(ScrollView);
  const execute = tree.root.findAllByType('Button').find(
    (node) => node.props.accessibilityLabel === 'Execute commands',
  );
  expect(scroll.findAllByType('Button')).toHaveLength(30);
  expect(scroll.findAllByType('Button')).not.toContain(execute);
  expect(execute.props.disabled).toBe(false);
  await act(async () => execute.props.onPress());
  expect(onExecute).toHaveBeenCalledTimes(1);
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


test('drag reorder changes execution and saved order and clears stale responses', async () => {
  const commands = [
    {type: 'command', payload: [0x30]},
    {type: 'delay', payload: 100},
    {type: 'command', payload: [0x30]},
  ];
  const savedRecord = {name: 'Reorder', payload: {tech: 'NfcA', value: commands}};
  NfcProxy.customTransceiveNfcA.mockResolvedValue([true, [[0xaa], [], [0xbb]]]);
  const tree = await render(<CustomTransceiveScreen route={{params: {savedRecord}}} navigation={{goBack: jest.fn()}} />);
  const list = () => tree.root.findByType(DraggableFlatList);
  const originalKeys = commands.map(list().props.keyExtractor);
  expect(new Set(originalKeys).size).toBe(3);
  const execute = () => tree.root.findAllByType('Button').find((node) => node.props.accessibilityLabel === 'Execute commands');
  await act(async () => execute().props.onPress());
  expect(tree.root.findAllByType(CommandItem)[0].props.resp).toEqual([0xaa]);
  await act(async () => list().props.onDragEnd({from: 0, to: 2}));
  const reordered = [commands[1], commands[2], commands[0]];
  expect(list().props.data).toEqual(reordered);
  expect(list().props.data.map(list().props.keyExtractor)).toEqual([originalKeys[1], originalKeys[2], originalKeys[0]]);
  expect(tree.root.findAllByType(CommandItem).every((node) => node.props.resp === undefined)).toBe(true);
  expect(tree.root.findByType('ScreenHeader').props.getRecordPayload().value).toEqual(reordered);
  await act(async () => execute().props.onPress());
  expect(NfcProxy.customTransceiveNfcA.mock.calls.at(-1)[0]).toEqual(reordered);
  await act(async () => list().props.onDragEnd({from: 1, to: 1}));
  expect(tree.root.findAllByType(CommandItem)[0].props.resp).toEqual([0xaa]);
  await act(async () => tree.unmount());
});
