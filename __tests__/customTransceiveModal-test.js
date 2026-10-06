import React from 'react';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import CustomTransceiveModal from '../src/Components/CustomTransceiveModal';
import HexBytePad from '../src/Components/HexBytePad';

function button(tree, label) {
  return tree.root
    .findAllByType(Button)
    .find((node) => node.props.children === label);
}

test('shared hex keypad combines two digits into one byte', async () => {
  const onByte = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(<HexBytePad onByte={onByte} />);
  });
  await act(async () => {
    button(tree, 'A').props.onPress();
  });
  await act(async () => {
    button(tree, 'F').props.onPress();
  });
  expect(onByte).toHaveBeenCalledWith(0xaf);
  tree.unmount();
});

test('shared hex modal can append bytes to a Flow Script command', async () => {
  const onInsertBytes = jest.fn();
  const setVisible = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(
      <CustomTransceiveModal
        visible
        setVisible={setVisible}
        onInsertBytes={onInsertBytes}
      />,
    );
  });
  expect(button(tree, 'ADD BYTES').props.disabled).toBe(true);
  await act(async () => {
    tree.root.findByType(HexBytePad).props.onByte(0x30);
    tree.root.findByType(HexBytePad).props.onByte(0x04);
  });
  await act(async () => {
    button(tree, 'ADD BYTES').props.onPress();
  });
  expect(onInsertBytes).toHaveBeenCalledWith([0x30, 0x04]);
  expect(setVisible).toHaveBeenCalledWith(false);
  tree.unmount();
});

test('shared hex modal preserves legacy Custom Transceive command output', async () => {
  const editCommand = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(
      <CustomTransceiveModal
        visible
        setVisible={jest.fn()}
        editCommand={editCommand}
      />,
    );
  });
  await act(async () => {
    tree.root.findByType(HexBytePad).props.onByte(0x30);
  });
  await act(async () => {
    button(tree, 'Add').props.onPress();
  });
  expect(editCommand).toHaveBeenCalledWith({
    type: 'command',
    payload: [0x30],
  });
  tree.unmount();
});

test('localized command labels never change command payload types', async () => {
  const {i18n, translateText: tr} = require('../src/i18n');
  const editCommand = jest.fn();
  for (const language of ['zh-Hant', 'ja']) {
    let tree;
    await act(async () => {
      await i18n.changeLanguage(language);
      tree = renderer.create(<CustomTransceiveModal visible setVisible={() => {}} editCommand={editCommand} />);
    });
    await act(async () => tree.root.findByType(HexBytePad).props.onByte(0x30));
    await act(async () => button(tree, tr('Add')).props.onPress());
    expect(editCommand).toHaveBeenLastCalledWith({type: 'command', payload: [0x30]});
    await act(async () => tree.unmount());
  }
  await act(async () => i18n.changeLanguage('en'));
});
