import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // El Worker no corre en el navegador. Comparte casi todas las globales con el
    // (fetch, crypto, TextEncoder, Response), pero no tiene `document` ni `window`,
    // y las reglas de React no le aplican: ahi no hay componentes que refrescar.
    files: ['src/worker/**/*.ts'],
    languageOptions: {
      globals: globals.worker,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
