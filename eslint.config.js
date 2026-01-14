import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/__tests__/**',
    ],
  },
  {
    rules: {
      // Allow any for flexibility in SDK code
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow unused vars with underscore prefix
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow require() for React Native dynamic imports
      '@typescript-eslint/no-require-imports': 'off',
      // Allow this aliasing (common pattern)
      '@typescript-eslint/no-this-alias': 'off',
      // Allow console for debugging
      'no-console': 'off',
    },
  }
);
