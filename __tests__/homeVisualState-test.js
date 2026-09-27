import React from 'react';
import {Text} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import HomeScreen from '../src/Screens/Home';
import NfcProxy from '../src/NfcProxy';
import {useNfcAvailability} from '../src/features/home/useNfcAvailability';
import {useTagScan} from '../src/features/home/useTagScan';

jest.mock('../src/NfcProxy', () => ({
  __esModule: true,
  default: {goToNfcSetting: jest.fn()},
}));
jest.mock('../src/features/home/useNfcAvailability', () => ({useNfcAvailability: jest.fn()}));
jest.mock('../src/features/home/useTagScan', () => ({useTagScan: jest.fn()}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {getBackgroundTag: jest.fn(async () => null), setEventListener: jest.fn()},
  NfcEvents: {DiscoverBackgroundTag: 'DiscoverBackgroundTag'},
}));
jest.mock('react-native-screens/experimental', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-paper', () => ({Button: 'Button', IconButton: 'IconButton'}));

function visibleText(tree) {
  return tree.root.findAllByType(Text).map((node) => node.props.children).flat(Infinity).join(' ');
}

function button(tree, label) {
  return tree.root.findAllByType(Button).find((node) => node.props.children === label);
}

test('NFC recovery is prominent and keeps its original actions', async () => {
  const refresh = jest.fn();
  useNfcAvailability.mockReturnValue({enabled: false, refresh});
  useTagScan.mockReturnValue(jest.fn());
  let tree;
  await act(async () => {
    tree = renderer.create(<HomeScreen navigation={{navigate: jest.fn()}} />);
  });
  expect(visibleText(tree)).toContain('NFC is not enabled');
  expect(button(tree, 'GO TO NFC SETTINGS')).toBeDefined();
  expect(button(tree, 'CHECK AGAIN')).toBeDefined();
  await act(async () => button(tree, 'GO TO NFC SETTINGS').props.onPress());
  await act(async () => button(tree, 'CHECK AGAIN').props.onPress());
  expect(NfcProxy.goToNfcSetting).toHaveBeenCalled();
  expect(refresh).toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('scan remains the primary action when NFC is enabled', async () => {
  const scan = jest.fn();
  useNfcAvailability.mockReturnValue({enabled: true, refresh: jest.fn()});
  useTagScan.mockReturnValue(scan);
  let tree;
  await act(async () => {
    tree = renderer.create(<HomeScreen navigation={{navigate: jest.fn()}} />);
  });
  expect(visibleText(tree)).toContain('NFC is enabled');
  await act(async () => button(tree, 'SCAN NFC TAG').props.onPress());
  expect(scan).toHaveBeenCalled();
  await act(async () => tree.unmount());
});
