import React from 'react';
import renderer, {act} from 'react-test-renderer';

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {isEnabled: jest.fn(), setEventListener: jest.fn()},
  NfcEvents: {StateChanged: 'StateChanged'},
}));
jest.mock('react-native-paper', () => ({
  Appbar: {Header: 'AppbarHeader', BackAction: 'AppbarBackAction'},
  List: {Section: 'ListSection', Item: 'ListItem', Subheader: 'ListSubheader'},
  TextInput: 'TextInput',
  Button: 'Button',
}));

import SettingsScreen from '../src/Screens/Settings';

it('dismisses Settings through the root stack back action', async () => {
  const navigation = {goBack: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<SettingsScreen navigation={navigation} />);
  });

  await act(async () => {
    tree.root.findByType('AppbarBackAction').props.onPress();
  });
  expect(navigation.goBack).toHaveBeenCalledTimes(1);

  await act(async () => tree.unmount());
});
