/* global jest */
jest.mock('react-native-localize', () =>
  require('react-native-localize/mock/jest'),
);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
