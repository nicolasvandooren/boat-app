import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// The official Airbnb configs and eslint-plugin-jsx-a11y do not support ESLint 10 (see CLAUDE.md).
// These are the Airbnb rules that are about correctness rather than formatting; Prettier formats.
const airbnbEssentials = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  curly: ['error', 'multi-line'],
  'consistent-return': 'error',
  'default-case-last': 'error',
  'no-console': 'error',
  'no-else-return': ['error', { allowElseIf: false }],
  'no-nested-ternary': 'error',
  'no-param-reassign': ['error', { props: true }],
  'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
  'object-shorthand': ['error', 'always'],
  'prefer-const': 'error',
  'prefer-destructuring': ['error', { object: true, array: false }],
  'prefer-template': 'error',
}

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.configs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...airbnbEssentials,
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
])
