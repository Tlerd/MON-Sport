// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.{js,mjs,ts}',
      'apps/api/prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // apps/api: NestJS decorators dua vao method injection khong dung `this`
    // theo kieu class thuan, tat rule nay o day de khop pattern chuan cua Nest.
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      // Module cua Nest thuong la class rong chi mang decorator @Module()/@Global().
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // DTO Zod: class rong + interface cung ten merge field vao (ky thuat giong
    // nestjs-zod createZodDto) — day la cach lay static `schema` cho
    // ZodValidationPipe ma van co kieu du lieu day du cho @Body(), khong phai
    // loi that.
    files: ['apps/api/src/**/dto/*.dto.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: ['packages/shared/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  eslintConfigPrettier,
);
