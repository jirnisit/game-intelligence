import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import stylistic from '@stylistic/eslint-plugin'
import tailwindcss from 'eslint-plugin-tailwindcss'
import { fileURLToPath } from 'node:url'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    rules: {
      'vue/jsx-uses-vars': 'error',
      // Props are typed by defineComponent<Props>; runtime declarations are name arrays.
      'vue/require-prop-types': 'off',
      // Every component declares Props, including components without props.
      '@typescript-eslint/no-empty-object-type': ['error', { allowWithName: '^Props$' }],
    },
  },
  {
    files: ['*.{mjs,ts}', 'tests/**'],
    languageOptions: { globals: globals.node },
  },
  stylistic.configs.customize({ indent: 2, quotes: 'single', semi: false, jsx: true }),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,jsx}'],
    plugins: { tailwindcss },
    settings: {
      tailwindcss: {
        cssConfigPath: fileURLToPath(new URL('./src/app/styles/base.css', import.meta.url)),
        attributes: ['class', 'className'],
        functions: ['clsx'],
        parseKeyFunctions: ['clsx'],
      },
    },
    rules: {
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/jsx-quotes': ['error', 'prefer-single'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/jsx-max-props-per-line': ['error', { maximum: 1, when: 'always' }],
      '@stylistic/jsx-first-prop-new-line': ['error', 'multiline-multiprop'],
      // Unlike printWidth, max-len reports long lines; it does not reflow expressions.
      '@stylistic/max-len': [
        'error',
        {
          code: 120,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        {
          blankLine: 'always',
          prev: '*',
          next: ['function', 'class', 'interface', 'type', 'export', 'return'],
        },
        { blankLine: 'always', prev: ['function', 'class', 'interface', 'type'], next: '*' },
      ],
      'one-var': ['error', 'never'],
      'tailwindcss/classnames-order': 'error',
      'tailwindcss/enforces-canonical-classname': 'error',
    },
  },
)
