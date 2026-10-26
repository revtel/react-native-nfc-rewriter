import React from 'react';
import {Buffer} from 'buffer';
import {Linking, Text, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import Clipboard from '@react-native-clipboard/clipboard';
import NdefMessage from '../src/Components/NdefMessage';
import {presentNdefRecord} from '../src/features/tag-result-presentation/model';
import {i18n, translateText as tr} from '../src/i18n';

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {setString: jest.fn()},
}));
const bytes = (value) => Array.from(Buffer.from(value, 'utf8'));
const textRecord = (value) =>
  presentNdefRecord({tnf: 1, type: 'T', payload: [0, ...bytes(value)]});
const uriRecord = (value) =>
  presentNdefRecord({tnf: 1, type: [85], payload: [0, ...bytes(value)]});
const action = (tree, label) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.accessibilityLabel === label);
const text = (tree) =>
  tree.root
    .findAllByType(Text)
    .flatMap((node) => [node.props.children].flat(Infinity))
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ');
async function render(presentation, technical = false) {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <NdefMessage presentation={presentation} technical={technical} />,
    );
  });
  return tree;
}
beforeEach(() => {
  jest.clearAllMocks();
  Clipboard.setString.mockReset().mockResolvedValue(undefined);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(async () => {
  await i18n.changeLanguage('en');
  jest.restoreAllMocks();
});

test('empty valid Text remains readable and copies the exact empty string', async () => {
  const tree = await render(textRecord(''));
  expect(text(tree)).toContain('(empty text)');
  expect(action(tree, 'Copy content for record 1')).toBeDefined();
  await act(async () => {
    await action(tree, 'Copy content for record 1').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenCalledWith('');
  expect(Linking.openURL).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('long URI copies full target, opens only after full display and only on explicit Open link', async () => {
  const uri = 'https://example.com/' + 'target'.repeat(100);
  const p = uriRecord(uri);
  const tree = await render(p);
  expect(action(tree, 'Open link for record 1')).toBeUndefined();
  expect(
    tree.root.findAllByType(Text).find((node) => node.props.children === uri)
      .props.numberOfLines,
  ).toBe(6);
  await act(async () => {
    await action(tree, 'Copy content for record 1').props.onPress();
  });
  expect(Clipboard.setString).toHaveBeenCalledWith(uri);
  await act(async () =>
    action(tree, 'Full content for record 1').props.onPress(),
  );
  expect(
    tree.root.findAllByType(Text).find((node) => node.props.children === uri)
      .props.numberOfLines,
  ).toBeUndefined();
  expect(Linking.openURL).not.toHaveBeenCalled();
  await act(async () => {
    await action(tree, 'Open link for record 1').props.onPress();
  });
  expect(Linking.openURL).toHaveBeenCalledWith(uri);
  await act(async () =>
    action(tree, 'Full content for record 1').props.onPress(),
  );
  expect(action(tree, 'Open link for record 1')).toBeUndefined();
  await act(async () => tree.unmount());
});

test('short URI has no truncation at any width and technical mode never mounts content actions', async () => {
  const uri = 'https://example.com/unchanged?x=1&y=2';
  const p = uriRecord(uri);
  const tree = await render(p);
  const target = tree.root
    .findAllByType(Text)
    .find((node) => node.props.children === uri);
  expect(target.props.numberOfLines).toBeUndefined();
  expect(action(tree, 'Open link for record 1')).toBeDefined();
  await act(async () =>
    tree.update(<NdefMessage presentation={p} technical />),
  );
  expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  expect(text(tree)).toContain('Payload byte count');
  expect(text(tree)).not.toContain(uri);
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Clipboard.setString).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test.each(['en', 'zh-Hant', 'ja'])(
  'copy/open failures are localized without losing target evidence: %s',
  async (language) => {
    await i18n.changeLanguage(language);
    const uri = 'https://example.com/';
    const tree = await render(uriRecord(uri));
    Clipboard.setString.mockRejectedValueOnce(new Error('clipboard denied'));
    await act(async () => {
      await action(
        tree,
        tr('Copy content for record {{number}}', {number: 1}),
      ).props.onPress();
    });
    expect(text(tree)).toContain(tr('Could not copy. Try again.'));
    Linking.openURL.mockRejectedValueOnce(new Error('no handler'));
    await act(async () => {
      await action(
        tree,
        tr('Open link for record {{number}}', {number: 1}),
      ).props.onPress();
    });
    expect(text(tree)).toContain(
      tr('Could not open this link. You can still copy the target.'),
    );
    expect(text(tree)).toContain(uri);
    await act(async () => tree.unmount());
  },
);
