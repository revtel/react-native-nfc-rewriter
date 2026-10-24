import React from 'react';
import renderer, {act} from 'react-test-renderer';
import NfcManager from 'react-native-nfc-manager';
import NfcProxy from '../src/NfcProxy';
import {useTagExplore} from '../src/features/home/useTagExplore';

jest.mock('../src/NfcProxy', () => ({__esModule: true, default: {exploreTag: jest.fn()}}));
jest.mock('react-native-nfc-manager', () => ({__esModule: true, default: {cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined)}}));

let exposed;
function Harness({navigation}) {
  exposed = useTagExplore(navigation);
  return null;
}
function pending() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return {promise, resolve};
}
async function setup() {
  const listeners = {};
  const navigation = {
    navigate: jest.fn(), isFocused: () => true,
    addListener: jest.fn((name, callback) => { listeners[name] = callback; return jest.fn(); }),
  };
  let tree;
  await act(async () => { tree = renderer.create(<Harness navigation={navigation} />); });
  return {tree, navigation, listeners};
}
beforeEach(() => jest.clearAllMocks());

test('duplicate taps start one request and success forwards the full discovery result', async () => {
  const deferred = pending();
  NfcProxy.exploreTag.mockReturnValue(deferred.promise);
  const {tree, navigation} = await setup();
  let first;
  await act(async () => { first = exposed.explore(); });
  expect(exposed.exploring).toBe(true);
  await act(async () => { await exposed.explore(); });
  expect(NfcProxy.exploreTag).toHaveBeenCalledTimes(1);
  const result = {tag: {id: '123'}, discovery: {source: 'native-discovery'}};
  await act(async () => { deferred.resolve(result); await first; });
  expect(navigation.navigate).toHaveBeenCalledWith('TagDetail', result);
  expect(exposed.exploring).toBe(false);
  await act(async () => tree.unmount());
});

test.each(['blur', 'unmount', 'cancel'])('%s stops continuation and blocks late navigation', async (reason) => {
  const deferred = pending();
  NfcProxy.exploreTag.mockReturnValue(deferred.promise);
  const {tree, navigation, listeners} = await setup();
  let request;
  await act(async () => { request = exposed.explore(); });
  const {shouldContinue} = NfcProxy.exploreTag.mock.calls[0][0];
  expect(shouldContinue()).toBe(true);
  await act(async () => {
    if (reason === 'blur') { listeners.blur(); }
    else if (reason === 'unmount') { tree.unmount(); }
    else { exposed.cancel(); }
  });
  expect(shouldContinue()).toBe(false);
  expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  if (reason === 'blur') {
    await act(async () => listeners.focus());
    expect(shouldContinue()).toBe(false);
  }
  await act(async () => { deferred.resolve({tag: {id: 'late'}}); await request; });
  expect(navigation.navigate).not.toHaveBeenCalled();
  if (reason !== 'unmount') { await act(async () => tree.unmount()); }
});

test('native cancellation leaves Home usable without navigation', async () => {
  NfcProxy.exploreTag.mockResolvedValue(null);
  const {tree, navigation} = await setup();
  await act(async () => { await exposed.explore(); });
  expect(exposed.exploring).toBe(false);
  expect(navigation.navigate).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
