import { FlatCompat } from '@eslint/eslintrc';
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  { ignores: ['.next/**', 'node_modules/**'] },
  ...compat.extends('next/core-web-vitals'),
  { rules: { '@next/next/no-img-element': 'off', 'react-hooks/exhaustive-deps': 'off', 'react/no-unescaped-entities': 'off', '@next/next/no-html-link-for-pages': 'off' } },
];
