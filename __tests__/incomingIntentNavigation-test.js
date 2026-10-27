import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Linking} from 'react-native';
import NfcManager, {NfcEvents} from 'react-native-nfc-manager';
import {
  isIncomingNavigationReady,
  useIncomingIntentNavigation,
} from '../src/features/home/useIncomingIntentNavigation';

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    getBackgroundTag: jest.fn(),
    clearBackgroundTag: jest.fn(),
    setEventListener: jest.fn(),
  },
  NfcEvents: {DiscoverBackgroundTag: 'DiscoverBackgroundTag'},
}));

test('readiness requires completed initialization, not just a mounted navigation container', () => {
  const navigation = {
    isReady: jest.fn(() => false),
    getRootState: jest.fn(() => ({routes: [{name: 'Landing'}]})),
  };
  expect(isIncomingNavigationReady(navigation)).toBe(false);
  navigation.isReady.mockReturnValue(true);
  expect(isIncomingNavigationReady(navigation)).toBe(false);
  navigation.getRootState.mockReturnValue({routes: [{name: 'MainTabs'}]});
  expect(isIncomingNavigationReady(navigation)).toBe(true);
  navigation.getRootState.mockReturnValue({
    routes: [{name: 'MainTabs'}, {name: 'TagDetail'}],
  });
  expect(isIncomingNavigationReady(navigation)).toBe(true);
});

test('single root owner waits for Landing reset, clears consumed cache and removes both subscriptions', async () => {
  const tag = {ndefMessage: [{tnf: 1, type: [85], payload: [4, 97]}]};
  NfcManager.getBackgroundTag
    .mockResolvedValueOnce(tag)
    .mockResolvedValue(null);
  NfcManager.clearBackgroundTag.mockResolvedValue(undefined);
  const remove = jest.fn();
  jest.spyOn(Linking, 'addEventListener').mockReturnValue({remove});
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  let mounted = false;
  let state = {routes: [{name: 'Landing'}]};
  const navigation = {
    navigate: jest.fn(),
    isReady: () => mounted,
    getRootState: () => state,
  };
  let onStateChange;
  function Probe() {
    onStateChange = useIncomingIntentNavigation(navigation);
    return null;
  }
  let tree;
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  mounted = true;
  act(() => onStateChange());
  expect(navigation.navigate).not.toHaveBeenCalled();
  state = {routes: [{name: 'MainTabs'}]};
  act(() => onStateChange());
  expect(navigation.navigate.mock.calls).toEqual([['TagDetail', {tag}]]);
  expect(NfcManager.clearBackgroundTag).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
  expect(NfcManager.setEventListener).toHaveBeenLastCalledWith(
    NfcEvents.DiscoverBackgroundTag,
    null,
  );
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
  expect(NfcManager.getBackgroundTag).toHaveBeenCalledTimes(2);
  expect(Linking.getInitialURL).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
  jest.restoreAllMocks();
});
