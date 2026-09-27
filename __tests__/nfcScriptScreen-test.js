import React from 'react';
import {Text} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import NfcProxy from '../src/NfcProxy';
import HexBytePad from '../src/Components/HexBytePad';
import NfcScriptEditorScreen, {StepList, TraceView} from '../src/Screens/NfcScriptEditor';
import NfcScriptHelpScreen from '../src/Screens/NfcScriptHelp';
import {executeScript} from '../src/features/nfc-script/interpreter';
import {newScript} from '../src/features/nfc-script/model';

jest.mock('../src/NfcProxy', () => ({runNfcScript: jest.fn()}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: 'Icon',
}));
jest.mock('../src/Components/ScreenHeader', () => 'ScreenHeader');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({bottom: 0}),
}));

function button(tree, label) {
  return tree.root
    .findAllByType(Button)
    .find((node) => node.props.children === label);
}

function text(tree) {
  return tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .filter((part) => typeof part === 'string' || typeof part === 'number')
    .join(' ');
}

test('nested card editor creates a branch', async () => {
  const onChange = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(<StepList steps={[]} onChange={onChange} />);
  });
  await act(async () => {
    button(tree, '+ ADD STEP').props.onPress();
  });
  await act(async () => {
    button(tree, 'if').props.onPress();
  });
  expect(onChange.mock.calls[0][0][0]).toMatchObject({
    type: 'if',
    then: [],
    else: [],
  });
  tree.unmount();
});

test('long command and response bytes remain fully selectable in trace', async () => {
  const bytes = Array.from({length: 64}, (_, index) => index);
  let tree;
  await act(async () => {
    tree = renderer.create(
      <TraceView result={{
        success: true,
        trace: [{location: '0', type: 'transceive', command: bytes, response: {raw: bytes}}],
      }} />,
    );
  });
  const technicalLines = tree.root.findAllByType(Text).filter((node) =>
    node.props.selectable && node.props.children?.[0] === '→ ',
  );
  expect(technicalLines).toHaveLength(1);
  expect(technicalLines[0].props.selectable).toBe(true);
  expect(technicalLines[0].props.numberOfLines).toBeUndefined();
  expect(technicalLines[0].props.children.join('')).toContain('3F');
  await act(async () => tree.unmount());
});

test('saved script is not run on open and shows trace only after explicit run', async () => {
  const savedRecord = {
    name: 'read card',
    payload: {
      ...newScript('IsoDep'),
      steps: [{type: 'transceive', template: '00 A4 04 00'}],
    },
  };
  NfcProxy.runNfcScript.mockResolvedValue({
    success: true,
    error: null,
    trace: [
      {
        location: '0',
        type: 'transceive',
        command: [0, 0xa4, 4, 0],
        response: {raw: [0x90, 0], data: [], sw: 0x9000},
      },
    ],
  });
  let tree;
  await act(async () => {
    tree = renderer.create(
      <NfcScriptEditorScreen
        route={{params: {savedRecord}}}
        navigation={{goBack: jest.fn()}}
      />,
    );
  });
  expect(NfcProxy.runNfcScript).not.toHaveBeenCalled();
  expect(text(tree)).toContain('Technology');
  await act(async () => {
    await button(tree, 'RUN').props.onPress();
  });
  expect(NfcProxy.runNfcScript).toHaveBeenCalledWith(savedRecord.payload);
  expect(text(tree).replace(/\s+/g, ' ')).toContain('SW: 9000');
  tree.unmount();
});

test('editor opens the dedicated help screen without running NFC', async () => {
  NfcProxy.runNfcScript.mockClear();
  const navigation = {goBack: jest.fn(), navigate: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(
      <NfcScriptEditorScreen
        route={{params: {nfcTech: 'NfcA'}}}
        navigation={navigation}
      />,
    );
  });
  await act(async () => {
    tree.root.findAll((node) => !!node.props.accessibilityLabel)
      .find((node) => node.props.accessibilityLabel === 'Help: examples and formats')
      .props.onPress();
  });
  expect(navigation.navigate).toHaveBeenCalledWith('NfcScriptHelp', {
    tech: 'NfcA',
  });
  expect(NfcProxy.runNfcScript).not.toHaveBeenCalled();
  tree.unmount();
});

test('help screen shows a complete capture-to-command example and format reference', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<NfcScriptHelpScreen route={{params: {tech: 'IsoDep'}}} />);
  });
  expect(text(tree)).toContain('1. TRANSCEIVE — read the fixed location');
  expect(text(tree)).toContain('Variable name:  targetPage');
  expect(text(tree)).toContain('30 ${targetPage:u8}');
  expect(text(tree)).toContain('30 10');
  expect(text(tree)).toContain('${payload:bytes}');
  expect(text(tree)).toContain('sw: 0x9000');
  tree.unmount();
});

test('documented pointer example resolves captured tag data into next command', async () => {
  const transceive = jest
    .fn()
    .mockResolvedValueOnce([4, 0x10, ...Array(14).fill(0)])
    .mockResolvedValueOnce(Array(16).fill(0));
  const result = await executeScript(
    {
      ...newScript('NfcA'),
      steps: [
        {type: 'transceive', template: '30 04'},
        {
          type: 'capture',
          name: 'targetPage',
          source: 'data',
          offset: 1,
          format: 'u8',
        },
        {type: 'transceive', template: '30 ${targetPage:u8}'},
      ],
    },
    {transceive},
  );
  expect(result.success).toBe(true);
  expect(result.variables.targetPage).toBe(16);
  expect(transceive.mock.calls).toEqual([[[0x30, 0x04]], [[0x30, 0x10]]]);
});

test('builder mode appends a typed variable segment without cursor control', async () => {
  const onChange = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(
      <StepList
        steps={[
          {type: 'transceive', template: '30 04'},
          {
            type: 'capture',
            name: 'targetPage',
            source: 'data',
            offset: 1,
            format: 'u8',
          },
          {type: 'transceive', template: '30 00'},
        ]}
        onChange={onChange}
      />,
    );
  });
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .filter((node) => node.props.children === 'BUILDER')[1]
      .props.onPress();
  });
  await act(async () => {
    button(tree, 'CHOOSE VARIABLE')
      .props.onPress();
  });
  expect(text(tree)).toContain('targetPage · number');
  await act(async () => {
    button(tree, 'targetPage · number').props.onPress();
  });
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .filter((node) => node.props.children === 'u16le')
      .at(-1)
      .props.onPress();
  });
  await act(async () => {
    button(tree, 'ADD VARIABLE').props.onPress();
  });
  expect(onChange.mock.calls.at(-1)[0][2].template).toBe(
    '30 00 ${targetPage:u16le}',
  );
  tree.unmount();
});

test('variable picker keeps branch variables inside their own path', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <StepList
        steps={[
          {type: 'set', name: 'outer', expression: '1'},
          {
            type: 'if',
            left: '1',
            operator: '==',
            right: '1',
            then: [
              {type: 'set', name: 'inner', expression: '2'},
              {type: 'transceive', template: ''},
            ],
            else: [],
          },
          {type: 'transceive', template: ''},
        ]}
        onChange={jest.fn()}
      />,
    );
  });
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .filter((node) => node.props.children === 'BUILDER')[0]
      .props.onPress();
  });
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .filter((node) => node.props.children === 'CHOOSE VARIABLE')[0]
      .props.onPress();
  });
  expect(button(tree, 'outer · number')).toBeDefined();
  expect(button(tree, 'inner · number')).toBeDefined();
  await act(async () => {
    button(tree, 'CANCEL').props.onPress();
  });
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .filter((node) => node.props.children === 'BUILDER')[1]
      .props.onPress();
  });
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .filter((node) => node.props.children === 'CHOOSE VARIABLE')[1]
      .props.onPress();
  });
  expect(button(tree, 'outer · number')).toBeDefined();
  expect(button(tree, 'inner · number')).toBeUndefined();
  tree.unmount();
});

test('builder mode uses the shared hex modal to append literal bytes', async () => {
  const onChange = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(
      <StepList
        steps={[{type: 'transceive', template: '30'}]}
        onChange={onChange}
      />,
    );
  });
  await act(async () => {
    button(tree, 'BUILDER').props.onPress();
  });
  await act(async () => {
    button(tree, 'ADD HEX BYTES').props.onPress();
  });
  await act(async () => {
    tree.root.findByType(HexBytePad).props.onByte(0x04);
  });
  await act(async () => {
    button(tree, 'ADD BYTES').props.onPress();
  });
  expect(onChange.mock.calls.at(-1)[0][0].template).toBe('30 04');
  tree.unmount();
});

test('builder mode does not discard an invalid text command', async () => {
  const onChange = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(
      <StepList
        steps={[{type: 'transceive', template: '30 0'}]}
        onChange={onChange}
      />,
    );
  });
  await act(async () => {
    button(tree, 'BUILDER').props.onPress();
  });
  expect(text(tree)).toContain('Fix command syntax in TEXT mode');
  expect(onChange).not.toHaveBeenCalled();
  tree.unmount();
});
