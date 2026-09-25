import React from 'react';
import {Text} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import NfcProxy from '../src/NfcProxy';
import NfcScriptEditorScreen, {StepList} from '../src/Screens/NfcScriptEditor';
import {newScript} from '../src/features/nfc-script/model';

jest.mock('../src/NfcProxy', () => ({runNfcScript: jest.fn()}));
jest.mock('../src/Components/ScreenHeader', () => 'ScreenHeader');

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
