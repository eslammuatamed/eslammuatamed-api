// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `src/generated` is the Prisma Client. It is generated, gitignored, and
    // already ships its own `@ts-nocheck` + eslint-disable headers.
    ignores: [
      'eslint.config.mjs',
      'dist',
      'coverage',
      'prisma/migrations',
      'src/generated',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Doc 15 §1/§3: `any` and non-null assertions are banned; floating promises are defects.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Test files exercise typed mocks (jest-mock-extended) and untyped HTTP bodies (supertest).
    // The mock-driven rules produce false positives here — `expect(mock.method)` trips
    // unbound-method, and `mock.calls`/response bodies are `any` by design. typescript-eslint's
    // own guidance is to disable unbound-method in tests (use eslint-plugin-jest's version if
    // ever needed). `no-explicit-any` stays on: specs still never write a literal `any`.
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Non-null assertions are pragmatic in tests (asserting a fixture the test just created).
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
