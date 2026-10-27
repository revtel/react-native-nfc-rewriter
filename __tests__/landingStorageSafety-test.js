import React from 'react';
import renderer, {act} from 'react-test-renderer';
import * as AppContext from '../src/AppContext';
import NfcProxy from '../src/NfcProxy';
import Landing from '../src/Screens/Landing';

jest.mock('../src/AppContext', () => ({Context: require('react').createContext(null)}));
jest.mock('../src/NfcProxy', () => ({__esModule: true, default: {init: jest.fn()}}));
jest.mock('../src/visual/theme', () => ({useVisualTheme: () => ({colors: {background: '#fff', text: '#111', accent: '#357'}})}));

beforeEach(() => {
  jest.useFakeTimers();
  NfcProxy.init.mockReset().mockResolvedValue(true);
});
afterEach(() => jest.useRealTimers());

async function renderLanding(app) {
  const navigation = {reset: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<AppContext.Context.Provider value={app}><Landing navigation={navigation} /></AppContext.Context.Provider>);
  });
  return {tree, navigation};
}
async function finishSplash() {
  await act(async () => { jest.advanceTimersByTime(1000); });
  await act(async () => { jest.advanceTimersByTime(500); });
}

test('failed record loading does not reject startup or disable unrelated NFC reading', async () => {
  const app = {state: {storageStatus: 'failed'}, actions: {initStorage: jest.fn().mockRejectedValue(new Error('private data'))}};
  const {tree, navigation} = await renderLanding(app);
  await finishSplash();
  expect(app.actions.initStorage).toHaveBeenCalledTimes(1);
  expect(NfcProxy.init).toHaveBeenCalledTimes(1);
  expect(navigation.reset).toHaveBeenCalledWith({index: 0, routes: [{name: 'MainTabs'}]});
  expect(app.state.storageStatus).toBe('failed');
  await act(async () => tree.unmount());
});

test('NFC initialization rejection offers a retry instead of an indefinite spinner', async () => {
  NfcProxy.init.mockRejectedValueOnce(new Error('native init')).mockResolvedValueOnce(true);
  const app = {state: {storageStatus: 'ready'}, actions: {initStorage: jest.fn().mockResolvedValue([])}};
  const {tree, navigation} = await renderLanding(app);
  await finishSplash();
  expect(navigation.reset).not.toHaveBeenCalled();
  expect(NfcProxy.init).toHaveBeenCalledTimes(1);
  const retry = tree.root.findAll((node) => node.props.accessibilityLabel === 'Retry' && typeof node.props.onPress === 'function')[0];
  expect(retry).toBeDefined();
  expect(retry.props.accessibilityLabel).toBe('Retry');
  await act(async () => retry.props.onPress());
  expect(NfcProxy.init).toHaveBeenCalledTimes(2);
  expect(navigation.reset).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test('unmount during splash prevents delayed initialization and navigation', async () => {
  const app = {actions: {initStorage: jest.fn()}};
  const {tree, navigation} = await renderLanding(app);
  await act(async () => tree.unmount());
  await finishSplash();
  expect(app.actions.initStorage).not.toHaveBeenCalled();
  expect(NfcProxy.init).not.toHaveBeenCalled();
  expect(navigation.reset).not.toHaveBeenCalled();
});
