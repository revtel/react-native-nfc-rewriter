import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import * as AppContext from '../src/AppContext';
import ScreenHeader from '../src/Components/ScreenHeader';
import {showToast} from '../src/Components/Toast';

jest.mock('../src/AppContext', () => ({Context: require('react').createContext(null)}));
jest.mock('../src/Components/SaveRecordModal', () => 'SaveRecordModal');
jest.mock('../src/Components/Toast', () => ({showToast: jest.fn()}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => ({__esModule: true, default: 'Icon'}));
jest.mock('react-native-paper', () => ({Appbar: {Header: 'Header', BackAction: 'BackAction', Content: 'Content', Action: 'HeaderAction'}}));
jest.mock('../src/visual/theme', () => ({useVisualTheme: () => ({colors: {surface: '#fff', text: '#111', accent: '#357'}})}));

let alert;
beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());

async function setup(updateRecordSnapshot, storageStatus = 'ready', savedRecordRevision = 1) {
  const savedRecord = {name: 'existing', payload: {tech: 'Ndef', value: 'old'}};
  const app = {state: {storageStatus}, actions: {updateRecordSnapshot, appendRecord: jest.fn()}};
  let tree;
  await act(async () => {
    tree = renderer.create(
      <AppContext.Context.Provider value={app}>
        <ScreenHeader navigation={{goBack: jest.fn()}} savedRecord={savedRecord} savedRecordIdx={1} savedRecordRevision={savedRecordRevision} getRecordPayload={() => ({tech: 'Ndef', value: 'new'})} />
      </AppContext.Context.Provider>,
    );
  });
  return {tree, savedRecord, app};
}
function confirmOverride(tree) {
  tree.root.findByType('HeaderAction').props.onPress();
  return alert.mock.calls[0][2].find((button) => button.text === 'YES').onPress;
}

test('override toast waits for verified success and supplies the original record identity', async () => {
  let finish;
  const update = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
  const {tree, savedRecord} = await setup(update);
  const confirm = confirmOverride(tree);
  await act(async () => {
    const pending = confirm();
    expect(showToast).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(1, {name: 'existing', payload: {tech: 'Ndef', value: 'new'}}, {expectedRecord: savedRecord, expectedRevision: 1});
    finish({records: [{}, {name: 'existing', payload: {tech: 'Ndef', value: 'new'}}], revision: 2});
    await pending;
  });
  expect(showToast).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test.each(['RECORD_STALE', 'STORAGE_WRITE_UNCERTAIN'])(
  'override %s is handled without false success or leaking native details', async (code) => {
    const update = jest.fn().mockRejectedValue(Object.assign(new Error('PRIVATE-payload'), {code}));
    const {tree} = await setup(update);
    const confirm = confirmOverride(tree);
    await act(async () => { await confirm(); });
    expect(showToast).not.toHaveBeenCalled();
    expect(alert.mock.calls.at(-1)[0]).toBe('Could not save record');
    expect(JSON.stringify(alert.mock.calls)).not.toContain('PRIVATE-payload');
    await act(async () => tree.unmount());
  },
);

test('same-tick override confirmations invoke only one mutation', async () => {
  let finish;
  const update = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
  const {tree} = await setup(update);
  const confirm = confirmOverride(tree);
  await act(async () => {
    const first = confirm();
    const second = confirm();
    expect(update).toHaveBeenCalledTimes(1);
    finish({records: [{}, {name: 'existing', payload: {tech: 'Ndef', value: 'new'}}], revision: 2});
    await Promise.all([first, second]);
  });
  expect(showToast).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test('a verified update refreshes this editor identity for a subsequent save', async () => {
  const persisted = {name: 'existing', payload: {tech: 'Ndef', value: 'new'}};
  const update = jest.fn()
    .mockResolvedValueOnce({records: [{}, persisted], revision: 2})
    .mockResolvedValueOnce({records: [{}, persisted], revision: 3});
  const {tree} = await setup(update);
  await act(async () => { await confirmOverride(tree)(); });
  await act(async () => { await confirmOverride(tree)(); });
  expect(update).toHaveBeenCalledTimes(2);
  expect(update.mock.calls[1][2]).toEqual({
    expectedRecord: persisted,
    expectedRevision: 2,
  });
  await act(async () => tree.unmount());
});

test('failed record storage blocks saving with reload guidance', async () => {
  const update = jest.fn();
  const {tree} = await setup(update, 'failed');
  const confirm = confirmOverride(tree);
  await act(async () => { await confirm(); });
  expect(update).not.toHaveBeenCalled();
  expect(showToast).not.toHaveBeenCalled();
  expect(alert.mock.calls.at(-1)[1]).toContain('Reload');
  await act(async () => tree.unmount());
});

test('an older index-only route cannot overwrite an indistinguishable duplicate', async () => {
  const update = jest.fn();
  const {tree} = await setup(update, 'ready', null);
  await act(async () => { await confirmOverride(tree)(); });
  expect(update).not.toHaveBeenCalled();
  expect(showToast).not.toHaveBeenCalled();
  expect(alert.mock.calls.at(-1)[1]).toContain('Reopen');
  await act(async () => tree.unmount());
});
