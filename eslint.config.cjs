/* eslint-env node */
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  {
    files: ['eslint.config.cjs'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
  ...compat.extends('eslint-config-expo'),
  {
    rules: {
      'react-native/no-inline-styles': 'off',
    },
  },
];
