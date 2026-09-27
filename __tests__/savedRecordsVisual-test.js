import React from 'react';
import {Alert, Share, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import * as AppContext from '../src/AppContext';
import SavedRecordScreen from '../src/Screens/SavedRecord';

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
    state: {storageCache},
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
  const record = {name: longName, payload: {tech: 'Ndef', value: {text: 'hello'}}};
  const script = {name: 'Flow', payload: {kind: 'nfc-script', tech: 'NfcA', steps: []}};
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
    url: `com.revteltech.nfcopenrewriter://share?data=${encodeURIComponent(JSON.stringify(record))}`,
  });
  shareSpy.mockRestore();

  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => action(tree, `Delete ${longName}`).props.onPress());
  expect(app.actions.removeRecord).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenLastCalledWith('DELETE RECORD', expect.stringContaining(longName), expect.any(Array));
  await act(async () => alertSpy.mock.calls.at(-1)[2][0].onPress());
  expect(app.actions.removeRecord).toHaveBeenCalledWith(1);

  await act(async () => action(tree, 'Clear all records').props.onPress());
  expect(app.actions.setStorage).not.toHaveBeenCalled();
  await act(async () => alertSpy.mock.calls.at(-1)[2][0].onPress());
  expect(app.actions.setStorage).toHaveBeenCalledWith([]);
  alertSpy.mockRestore();
  await act(async () => tree.unmount());
});
