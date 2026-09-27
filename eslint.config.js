import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['**/dist/', '**/node_modules/', 'examples/*/assets/', 'coverage/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['*.config.{js,ts}', 'examples/*/*.config.{js,ts}', 'packages/vite-plugin/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  // last, so Prettier owns formatting
  prettier,
)
