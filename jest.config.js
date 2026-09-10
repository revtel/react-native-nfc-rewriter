module.exports = {
  preset: 'react-native',
  watchman: false,
  setupFiles: ['react-native-gesture-handler/jestSetup.js'],
  moduleNameMapper: {
    '\\.(gif|jpe?g|png)$': '<rootDir>/__mocks__/fileMock.js',
  },
};
