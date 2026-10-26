import React from 'react';
import {Linking} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import HomeScreen from '../src/Screens/Home';
import NfcProxy from '../src/NfcProxy';
import NfcManager from 'react-native-nfc-manager';
import {createTagDiscovery} from '../src/features/tag-discovery/model';

// Keep the Home availability/action/exploration hooks real. Mock only transport,
// availability and passive native startup (plus native presentation surfaces).
jest.mock('../src/NfcProxy', () => ({
  __esModule: true,
  default: {
    isEnabled: jest.fn(),
    exploreTag: jest.fn(),
    readTag: jest.fn(),
    goToNfcSetting: jest.fn(),
  },
}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    getBackgroundTag: jest.fn(),
    setEventListener: jest.fn(),
    cancelTechnologyRequest: jest.fn(),
  },
  NfcEvents: {
    DiscoverBackgroundTag: 'DiscoverBackgroundTag',
    StateChanged: 'StateChanged',
  },
}));
jest.mock('react-native-screens/experimental', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: 'Icon',
}));

const button = (tree, label) =>
  tree.root.findAllByType(Button).find((node) => node.props.children === label);
function pending() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return {promise, resolve};
}
async function setup() {
  const listeners = new Map();
  const navigation = {
    navigate: jest.fn(),
    isFocused: () => true,
    addListener: jest.fn((name, callback) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
      return () => listeners.get(name).delete(callback);
    }),
  };
  let tree;
  await act(async () => {
    tree = renderer.create(<HomeScreen navigation={navigation} />);
  });
  return {tree, navigation};
}
function result(withNdef) {
  const tag = {
    id: '04AABBCCDDEEFF',
    techTypes: ['android.nfc.tech.NfcA'],
    nativeObservation: 'keep-original',
  };
  if (withNdef)
    tag.ndefMessage = [{tnf: 1, type: [84], id: '', payload: [0, 120]}];
  return {tag, discovery: createTagDiscovery(tag, 'android')};
}
beforeEach(() => {
  jest.clearAllMocks();
  NfcProxy.isEnabled.mockResolvedValue(true);
  NfcManager.getBackgroundTag.mockResolvedValue(null);
  NfcManager.cancelTechnologyRequest.mockResolvedValue(undefined);
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(Linking, 'addEventListener').mockReturnValue({remove: jest.fn()});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test.each([true, false])(
  'the single action forwards the complete discovery result with native NDEF present=%s',
  async (withNdef) => {
    const complete = result(withNdef);
    NfcProxy.exploreTag.mockResolvedValueOnce(complete);
    const {tree, navigation} = await setup();
    expect(NfcProxy.exploreTag).not.toHaveBeenCalled();
    expect(NfcProxy.readTag).not.toHaveBeenCalled();
    await act(async () => {
      await button(tree, 'SCAN NFC TAG').props.onPress();
    });
    expect(NfcProxy.exploreTag).toHaveBeenCalledTimes(1);
    expect(NfcProxy.readTag).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('TagDetail', complete);
    const delivered = navigation.navigate.mock.calls[0][1];
    expect(delivered).toBe(complete);
    expect(delivered.tag).toBe(complete.tag);
    expect(delivered.discovery).toBe(complete.discovery);
    expect(delivered.tag).not.toHaveProperty('ndefStatus');
    expect(delivered.discovery.ndef.status).toBe(
      withNdef ? 'available' : 'unknown',
    );
    expect(
      Object.prototype.hasOwnProperty.call(delivered.tag, 'ndefMessage'),
    ).toBe(withNdef);
    await act(async () => tree.unmount());
  },
);

test('same-tick duplicate presses start exactly one real exploration flow', async () => {
  const deferred = pending();
  NfcProxy.exploreTag.mockReturnValueOnce(deferred.promise);
  const {tree, navigation} = await setup();
  const press = button(tree, 'SCAN NFC TAG').props.onPress;
  let first;
  await act(async () => {
    first = press();
    await press();
  });
  expect(NfcProxy.exploreTag).toHaveBeenCalledTimes(1);
  expect(NfcProxy.readTag).not.toHaveBeenCalled();
  expect(button(tree, 'SCAN NFC TAG').props.loading).toBe(true);
  expect(button(tree, 'SCAN NFC TAG').props.disabled).toBe(true);
  expect(button(tree, 'SCAN NFC TAG').props.accessibilityLabel).toBe(
    'SCAN NFC TAG',
  );
  await act(async () => {
    deferred.resolve(null);
    await first;
  });
  expect(button(tree, 'SCAN NFC TAG').props.disabled).toBe(false);
  expect(navigation.navigate).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('cancel suppresses a late result and permits a fresh scan after the request settles', async () => {
  const deferred = pending();
  NfcProxy.exploreTag.mockReturnValueOnce(deferred.promise);
  const {tree, navigation} = await setup();
  let first;
  await act(async () => {
    first = button(tree, 'SCAN NFC TAG').props.onPress();
  });
  const {shouldContinue} = NfcProxy.exploreTag.mock.calls[0][0];
  expect(shouldContinue()).toBe(true);
  expect(button(tree, 'CANCEL').props.accessibilityLabel).toBe(
    'Cancel tag scan',
  );
  await act(async () => button(tree, 'CANCEL').props.onPress());
  expect(shouldContinue()).toBe(false);
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  await act(async () => {
    await button(tree, 'SCAN NFC TAG').props.onPress();
  });
  expect(NfcProxy.exploreTag).toHaveBeenCalledTimes(1);
  await act(async () => {
    deferred.resolve(result(false));
    await first;
  });
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(button(tree, 'SCAN NFC TAG').props.loading).toBe(false);
  expect(button(tree, 'SCAN NFC TAG').props.disabled).toBe(false);
  const fresh = result(true);
  NfcProxy.exploreTag.mockResolvedValueOnce(fresh);
  await act(async () => {
    await button(tree, 'SCAN NFC TAG').props.onPress();
  });
  expect(NfcProxy.exploreTag).toHaveBeenCalledTimes(2);
  expect(NfcProxy.readTag).not.toHaveBeenCalled();
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith('TagDetail', fresh);
  await act(async () => tree.unmount());
});
