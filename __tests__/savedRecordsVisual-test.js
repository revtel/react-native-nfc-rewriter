import React from 'react';
import {Alert, Platform, Share, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import * as AppContext from '../src/AppContext';
import SavedRecordScreen from '../src/Screens/SavedRecord';
import {createRecordShareLink} from '../src/features/records/shareLink';

jest.mock('../src/AppContext', () => ({Context: require('react').createContext(null)}));
jest.mock('react-native-screens/experimental', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: 'Icon',
}));
jest.mock('../src/Components/SaveRecordModal', () => 'SaveRecordModal');
jest.mock('../src/visual/theme', () => ({
  useVisualTheme: () => ({
    colors: {background: '#FAFBFD', surface: '#FFFFFF', surfaceMuted: '#F0F5FB', text: '#0B1D3B', textMuted: '#506583', accent: '#2878C2', border: '#CCD9E8', danger: '#A52A25'},
    spacing: {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32},
    type: {caption: 12, body: 14, label: 15, hero: 28},
    isDark: false,
  }),
}));

function makeApp(storageCache) {
  return {
    state: {storageCache, storageStatus: 'ready', storageRevision: 7},
    actions: {appendRecord: jest.fn(), removeRecord: jest.fn(), setStorage: jest.fn()},
  };
}

async function renderScreen(app, navigation = {navigate: jest.fn()}) {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <AppContext.Context.Provider value={app}>
        <SavedRecordScreen navigation={navigation} />
      </AppContext.Context.Provider>,
    );
  });
  return {tree, navigation};
}

function action(tree, label) {
  return tree.root.findAll((node) =>
    node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
  )[0];
}

function visibleText(tree) {
  return tree.root.findAllByType(Text).map((node) => node.props.children).flat(Infinity).join(' ');
}

test('empty My Records explains the state and hides Clear All', async () => {
  const {tree} = await renderScreen(makeApp([]));
  expect(visibleText(tree)).toContain('No saved records yet');
  expect(action(tree, 'Clear all records')).toBeUndefined();
  await act(async () => tree.unmount());
});

test('record groups, long names, and actions preserve targets and payloads', async () => {
  const longName = 'A very long saved NDEF record name with a dynamic target and many bytes';
  const record = {name: longName, payload: {tech: 'Ndef', tnf: 1, rtd: 'T', value: 'hello'}};
  const script = {name: 'Flow', payload: {kind: 'nfc-script', version: 1, tech: 'NfcA', name: '', description: '', steps: []}};
  const app = makeApp([script, record]);
  const {tree, navigation} = await renderScreen(app);
  const text = visibleText(tree);
  expect(text).toContain('NFC Scripts');
  expect(text).toContain('NDEF');
  expect(text).toContain(longName);
  const nameNode = tree.root.findAllByType(Text).find((node) => node.props.children === longName);
  expect(nameNode.props.numberOfLines).toBeUndefined();

  await act(async () => action(tree, `Open ${longName}`).props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('NdefWrite', {
    savedRecord: record,
    savedRecordIdx: 1,
    savedRecordRevision: 7,
  });

  await act(async () => action(tree, `Copy ${longName}`).props.onPress());
  const modal = tree.root.findByType('SaveRecordModal');
  expect(modal.props.visible).toBe(true);
  await act(async () => modal.props.onPersistRecord('copy'));
  expect(app.actions.appendRecord).toHaveBeenCalledWith({name: 'copy', payload: record.payload});

  const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({action: 'sharedAction'});
  await act(async () => action(tree, `Share ${longName}`).props.onPress());
  expect(shareSpy).toHaveBeenCalledWith({
    title: 'My NFC Record',
    ...(Platform.OS === 'android'
      ? {message: createRecordShareLink(record)}
      : {url: createRecordShareLink(record)}),
  });
  shareSpy.mockRestore();

  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => action(tree, `Delete ${longName}`).props.onPress());
  expect(app.actions.removeRecord).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenLastCalledWith('DELETE RECORD', expect.stringContaining(longName), expect.any(Array));
  await act(async () => alertSpy.mock.calls.at(-1)[2][0].onPress());
  expect(app.actions.removeRecord).toHaveBeenCalledWith(1, {expectedRecord: record, expectedRevision: 7});

  await act(async () => action(tree, 'Clear all records').props.onPress());
  expect(app.actions.setStorage).not.toHaveBeenCalled();
  await act(async () => alertSpy.mock.calls.at(-1)[2][0].onPress());
  expect(app.actions.setStorage).toHaveBeenCalledWith([], {expectedRevision: 7});
  alertSpy.mockRestore();
  await act(async () => tree.unmount());
});

test.each(['share rejection', 'serialization failure'])('%s shows retry feedback without saving or executing the record', async (failure) => {
  const record = {name: 'Example', payload: {tech: 'Ndef', tnf: 1, rtd: 'T', value: 'hello'}};
  if (failure === 'serialization failure') {
    record.self = record;
  }
  const app = makeApp([record]);
  const {tree, navigation} = await renderScreen(app);
  const shareSpy = jest.spyOn(Share, 'share').mockRejectedValue(new Error('native failure'));
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => action(tree, 'Share Example').props.onPress());
  expect(alertSpy).toHaveBeenCalledWith(
    'Could not share record',
    'Please try sharing this record again.',
  );
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(app.actions.appendRecord).not.toHaveBeenCalled();
  if (failure === 'serialization failure') {
    expect(shareSpy).not.toHaveBeenCalled();
  }
  shareSpy.mockRestore();
  alertSpy.mockRestore();
  await act(async () => tree.unmount());
});

test('failed loading is never rendered as an empty library and Retry handles failure', async () => {
  const app = makeApp([]);
  app.state.storageStatus = 'failed';
  app.actions.initStorage = jest.fn().mockRejectedValue(new Error('PRIVATE'));
  const {tree} = await renderScreen(app);
  expect(visibleText(tree)).toContain('Could not load saved records');
  expect(visibleText(tree)).not.toContain('No saved records yet');
  expect(action(tree, 'Import file').props.disabled).toBe(true);
  expect(action(tree, 'Export all').props.disabled).toBe(true);
  await act(async () => action(tree, 'Retry').props.onPress());
  expect(app.actions.initStorage).toHaveBeenCalledTimes(1);
  expect(visibleText(tree)).not.toContain('PRIVATE');
  await act(async () => tree.unmount());
});

test('unsupported entries remain inert while supported navigation retains the complete library index', async () => {
  const record = {name: 'Supported', payload: {tech: 'Ndef', tnf: 1, rtd: 'T', value: 'hello'}};
  const unknown = {name: 'Future private name', payload: {kind: 'future'}};
  const {tree, navigation} = await renderScreen(makeApp([null, unknown, record]));
  expect(visibleText(tree)).toContain('Other records');
  expect(visibleText(tree)).toContain('Future private name');
  expect(visibleText(tree)).toContain('Record 1');
  expect(action(tree, 'Open Future private name')).toBeUndefined();
  expect(action(tree, 'Share Future private name')).toBeUndefined();
  await act(async () => action(tree, 'Open Supported').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('NdefWrite', {savedRecord: record, savedRecordIdx: 2, savedRecordRevision: 7});
  await act(async () => tree.unmount());
});

test('a stale delete is caught without a false mutation success', async () => {
  const record = {name: 'A', payload: {tech: 'Ndef', tnf: 1, rtd: 'T', value: 'hello'}};
  const app = makeApp([record]);
  app.actions.removeRecord.mockRejectedValue(Object.assign(new Error('PRIVATE'), {code: 'RECORD_STALE'}));
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const {tree} = await renderScreen(app);
  await act(async () => action(tree, 'Delete A').props.onPress());
  await act(async () => alertSpy.mock.calls.at(-1)[2][0].onPress());
  expect(alertSpy.mock.calls.at(-1)).toEqual(['Could not change saved records', 'Saved records changed. Please review the list and try again.']);
  expect(JSON.stringify(alertSpy.mock.calls)).not.toContain('PRIVATE');
  alertSpy.mockRestore();
  await act(async () => tree.unmount());
});
