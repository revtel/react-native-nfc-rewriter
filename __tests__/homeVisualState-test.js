import React from 'react';
import {Linking, Text} from 'react-native';
import {Button} from 'react-native-paper';
import renderer, {act} from 'react-test-renderer';
import HomeScreen from '../src/Screens/Home';
import NfcProxy from '../src/NfcProxy';
import {useNfcAvailability} from '../src/features/home/useNfcAvailability';
import {useTagExplore} from '../src/features/home/useTagExplore';
import {i18n, translateText as tr} from '../src/i18n';

jest.mock('../src/NfcProxy', () => ({
  __esModule: true,
  default: {goToNfcSetting: jest.fn()},
}));
jest.mock('../src/features/home/useNfcAvailability', () => ({
  useNfcAvailability: jest.fn(),
}));
jest.mock('../src/features/home/useTagExplore', () => ({
  useTagExplore: jest.fn(),
}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    getBackgroundTag: jest.fn(async () => null),
    setEventListener: jest.fn(),
  },
  NfcEvents: {DiscoverBackgroundTag: 'DiscoverBackgroundTag'},
}));
jest.mock('react-native-screens/experimental', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-paper', () => ({
  Button: 'Button',
  IconButton: 'IconButton',
}));

const visibleText = (tree) =>
  tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .join(' ');
const button = (tree, label) =>
  tree.root.findAllByType(Button).find((node) => node.props.children === label);
async function render(navigation = {navigate: jest.fn()}) {
  let tree;
  await act(async () => {
    tree = renderer.create(<HomeScreen navigation={navigation} />);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  useNfcAvailability.mockReturnValue({enabled: true, refresh: jest.fn()});
  useTagExplore.mockReturnValue({
    explore: jest.fn(),
    exploring: false,
    cancel: jest.fn(),
  });
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  await i18n.changeLanguage('en');
  jest.restoreAllMocks();
});

test('NFC recovery keeps settings and check-again actions with no scan path', async () => {
  const refresh = jest.fn();
  useNfcAvailability.mockReturnValue({enabled: false, refresh});
  const tree = await render();
  expect(visibleText(tree)).toContain('NFC is not enabled');
  expect(button(tree, 'SCAN NFC TAG')).toBeUndefined();
  expect(button(tree, 'Explore Tag')).toBeUndefined();
  await act(async () => button(tree, 'GO TO NFC SETTINGS').props.onPress());
  await act(async () => button(tree, 'CHECK AGAIN').props.onPress());
  expect(NfcProxy.goToNfcSetting).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test('checking NFC availability shows status without a scan control', async () => {
  useNfcAvailability.mockReturnValue({enabled: null, refresh: jest.fn()});
  const tree = await render();
  expect(visibleText(tree)).toContain('Checking NFC status…');
  expect(tree.root.findAllByType(Button)).toHaveLength(0);
  await act(async () => tree.unmount());
});

test('the only primary scan action invokes exploration', async () => {
  const explore = jest.fn();
  useTagExplore.mockReturnValue({explore, exploring: false, cancel: jest.fn()});
  const tree = await render();
  const primary = button(tree, 'SCAN NFC TAG');
  expect(tree.root.findAllByType(Button)).toHaveLength(1);
  expect(primary.props.mode).toBe('contained');
  expect(primary.props.icon).toBe('nfc');
  expect(primary.props.accessibilityLabel).toBe('SCAN NFC TAG');
  expect(primary.props.loading).toBe(false);
  expect(button(tree, 'Explore Tag')).toBeUndefined();
  await act(async () => {
    await primary.props.onPress();
  });
  expect(explore).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test.each(['en', 'zh-Hant', 'ja'])(
  'scan label stays stable while loading and cancellation is localized: %s',
  async (language) => {
    await i18n.changeLanguage(language);
    const navigation = {navigate: jest.fn()};
    const explore = jest.fn();
    const cancel = jest.fn();
    useTagExplore.mockReturnValue({explore, exploring: false, cancel});
    const tree = await render(navigation);
    expect(button(tree, tr('SCAN NFC TAG')).props.accessibilityLabel).toBe(
      tr('SCAN NFC TAG'),
    );
    expect(visibleText(tree)).toContain(
      tr('NDEF is not required. Displays available tag identity and content.'),
    );
    expect(visibleText(tree)).toContain(
      tr(
        'Hold your device near an NFC tag to see its identity and available content.',
      ),
    );
    useTagExplore.mockReturnValue({explore, exploring: true, cancel});
    await act(async () => tree.update(<HomeScreen navigation={navigation} />));
    const primary = button(tree, tr('SCAN NFC TAG'));
    expect(primary.props.accessibilityLabel).toBe(tr('SCAN NFC TAG'));
    expect(primary.props.loading).toBe(true);
    expect(primary.props.disabled).toBe(true);
    expect(
      tree.root
        .findAllByType(Button)
        .filter((node) => node.props.mode === 'contained'),
    ).toHaveLength(1);
    expect(button(tree, tr('Explore Tag'))).toBeUndefined();
    const cancelButton = button(tree, tr('CANCEL'));
    expect(cancelButton.props.accessibilityLabel).toBe(tr('Cancel tag scan'));
    await act(async () => cancelButton.props.onPress());
    expect(cancel).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  },
);
