// jest.setup.js
import 'react-native-gesture-handler/jestSetup';

// Mock react-native-nfc-manager
jest.mock('react-native-nfc-manager', () => ({
  NfcTech: {},
  start: jest.fn(),
  cancel: jest.fn(),
  registerTagEvent: jest.fn(),
  unregisterTagEvent: jest.fn(),
  setEventListener: jest.fn(),
}));

// Mock react-native-device-info
jest.mock('react-native-device-info', () => ({
  getVersion: () => '0.4.1',
  getBuildNumber: () => '1',
}));

// Mock async storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve('')),
}));