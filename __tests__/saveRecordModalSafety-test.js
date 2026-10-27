import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Modal} from 'react-native';
import SaveRecordModal from '../src/Components/SaveRecordModal';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => ({__esModule: true, default: 'Icon'}));
jest.mock('react-native-paper', () => ({Button: 'SaveButton', TextInput: 'NameInput', Appbar: {Header: 'Header', Content: 'Content', Action: 'CloseAction'}}));
jest.mock('../src/visual/theme', () => ({useVisualTheme: () => ({colors: {background: '#fff', surface: '#eee', text: '#111'}})}));

test('a save rejection remains handled and same-tick taps cannot append duplicates', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let reject;
  const persist = jest.fn(() => new Promise((_, fail) => { reject = fail; }));
  const close = jest.fn();
  let tree;
  try {
    await act(async () => { tree = renderer.create(<SaveRecordModal visible onClose={close} onPersistRecord={persist} />); });
    await act(async () => tree.root.findByType('NameInput').props.onChangeText('new name'));
    const save = tree.root.findByType('SaveButton').props.onPress;
    await act(async () => {
      const first = save();
      const second = save();
      tree.root.findByType(Modal).props.onRequestClose();
      expect(close).not.toHaveBeenCalled();
      expect(persist).toHaveBeenCalledTimes(1);
      reject(new Error('PRIVATE-storage-marker'));
      await Promise.all([first, second]);
    });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(alert.mock.calls)).not.toContain('PRIVATE-storage-marker');
    expect(tree.root.findByType('NameInput').props.value).toBe('new name');
    expect(tree.root.findByType('SaveButton').props.loading).toBe(false);
    await act(async () => tree.root.findByType(Modal).props.onRequestClose());
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree.unmount());
    alert.mockRestore();
  }
});
