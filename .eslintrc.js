module.exports = {
  root: true,
  extends: '@react-native-community',
  rules: {
    'one-var': 'off',
    'no-multi-assign': 'off',
    'no-nested-ternary': 'off',
    'no-unused-vars': 'off',
    'global-require': 'off',

    'import/no-extraneous-dependencies': 'off',
    'import/first': 'off',

    'react-native/no-inline-styles': 'off',
    'react-native/no-unused-styles': 'warn',
    'react-native/split-platform-components': 'off',
    'react-native/no-raw-text': 'off',
  },
};
