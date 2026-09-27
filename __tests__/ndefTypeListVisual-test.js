import React from 'react';
import {ScrollView, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import NdefTypeListScreen from '../src/Screens/NdefTypeList';
import {NDEF_FORMAT_GROUPS} from '../src/features/ndef-write/formatChoices';

jest.mock('react-native-screens/experimental', () => ({SafeAreaView: 'SafeAreaView'}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: 'Icon',
}));
jest.mock('../src/visual/theme', () => ({
  useVisualTheme: () => ({
    colors: {background: '#FAFBFD', surfaceMuted: '#F0F5FB', text: '#0B1D3B', textMuted: '#506583', accent: '#2878C2', border: '#CCD9E8'},
    spacing: {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32},
    type: {body: 14, label: 15, hero: 28},
    isDark: false,
  }),
}));

test('Write NDEF keeps every format destination and is scrollable', async () => {
  const navigation = {navigate: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<NdefTypeListScreen navigation={navigation} />);
  });

  expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  const labels = tree.root.findAllByType(Text).map((node) => node.props.children);
  expect(labels).toContain('Well Known');
  expect(labels).toContain('MIME');
  expect(labels).toContain('WRITE NDEF');

  const rows = tree.root.findAll((node) =>
    node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
  );
  expect(new Set(rows.map((node) => node.props.accessibilityLabel)).size).toBe(7);
  for (const choice of NDEF_FORMAT_GROUPS.flatMap((group) => group.choices)) {
    const row = rows.find((node) => node.props.accessibilityLabel.startsWith(`${choice.title}.`));
    expect(row).toBeDefined();
    await act(async () => row.props.onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith('NdefWrite', choice.params);
  }
  await act(async () => tree.unmount());
});
