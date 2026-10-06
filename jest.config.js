module.exports = {
  preset: 'react-native',
  watchman: false,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-nfc-manager)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  setupFiles: ['react-native-gesture-handler/jestSetup.js'],
  moduleNameMapper: {
    '\\.(gif|jpe?g|png)$': '<rootDir>/__mocks__/fileMock.js',
  },
};
