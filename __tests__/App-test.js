/**
 * @format
 */

import 'react-native';
import React from 'react';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/AppNavigator', () => 'AppNavigator');

import App from '../src/App';

// Note: test renderer must be required after react-native.
import renderer, {act} from 'react-test-renderer';

it('renders correctly', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  await act(async () => {
    tree.unmount();
  });
});
