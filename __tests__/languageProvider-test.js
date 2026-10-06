import React from 'react';
import {Alert, AppState, Text, TextInput} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getLocales} from 'react-native-localize';
import {LanguageProvider, LanguageContext} from '../src/i18n/LanguageProvider';
import {i18n, translateText as tr} from '../src/i18n';
import {LANGUAGE_KEY} from '../src/i18n/preferences';

let controls;
let mounts;
function Editor() {
  useTranslation();
  controls = React.useContext(LanguageContext);
  const [value, setValue] = React.useState('');
  React.useEffect(() => {
    mounts++;
  }, []);
  return (
    <>
      <Text>{tr('SCAN TAG')}</Text>
      <TextInput value={value} onChangeText={setValue} />
    </>
  );
}

beforeEach(async () => {
  mounts = 0;
  await AsyncStorage.clear();
  getLocales.mockReturnValue([{languageTag: 'en-US'}]);
  await i18n.changeLanguage('en');
});
afterEach(() => jest.restoreAllMocks());

test('switching updates mounted labels without discarding edits and restores after restart', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <LanguageProvider>
        <Editor />
      </LanguageProvider>,
    );
  });
  await act(async () => {
    tree.root.findByType(TextInput).props.onChangeText('未儲存の内容');
  });
  await act(async () => {
    await controls.selectLanguage('ja');
  });
  expect(tree.root.findByType(Text).props.children).toBe('タグをスキャン');
  expect(tree.root.findByType(TextInput).props.value).toBe('未儲存の内容');
  expect(mounts).toBe(1);
  expect(await AsyncStorage.getItem(LANGUAGE_KEY)).toBe('ja');
  await act(async () => tree.unmount());
  await i18n.changeLanguage('en');
  await act(async () => {
    tree = renderer.create(
      <LanguageProvider>
        <Editor />
      </LanguageProvider>,
    );
  });
  expect(tree.root.findByType(Text).props.children).toBe('タグをスキャン');
  expect(controls.mode).toBe('ja');
  await act(async () => tree.unmount());
});

test('system mode refreshes on foreground while manual mode ignores system changes', async () => {
  let foreground;
  const remove = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((event, callback) => {
      foreground = callback;
      return {remove};
    });
  let tree;
  await act(async () => {
    tree = renderer.create(
      <LanguageProvider>
        <Editor />
      </LanguageProvider>,
    );
  });
  getLocales.mockReturnValue([{languageTag: 'zh-CN'}]);
  await act(async () => foreground('active'));
  expect(tree.root.findByType(Text).props.children).toBe('掃描標籤');
  await act(async () => {
    await controls.selectLanguage('ja');
  });
  await act(async () => foreground('active'));
  expect(tree.root.findByType(Text).props.children).toBe('タグをスキャン');
  await act(async () => {
    await controls.selectLanguage('system');
  });
  expect(tree.root.findByType(Text).props.children).toBe('掃描標籤');
  await act(async () => tree.unmount());
  expect(remove).toHaveBeenCalled();
});

test('failed preference saving keeps current language and reports failure in it', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  AsyncStorage.setItem.mockRejectedValueOnce(new Error('storage'));
  let tree;
  await act(async () => {
    tree = renderer.create(
      <LanguageProvider>
        <Editor />
      </LanguageProvider>,
    );
  });
  await act(async () => {
    await controls.selectLanguage('zh-Hant');
  });
  expect(tree.root.findByType(Text).props.children).toBe('掃描標籤');
  expect(alert).toHaveBeenCalledWith(
    '語言',
    expect.stringContaining('無法儲存'),
  );
  await act(async () => tree.unmount());
});
