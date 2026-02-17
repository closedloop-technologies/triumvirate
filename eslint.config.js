import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';

export default [
    js.configs.recommended,
    {
        ignores: ['node_modules/', 'dist/', 'coverage/', '.github/', 'bin/', 'baml_client/'],
    },
    {
        files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                AbortSignal: 'readonly',
                AbortController: 'readonly',
                fetch: 'readonly',
                global: 'readonly',
            },
        },
        plugins: {
            import: importPlugin,
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'no-constant-condition': ['error', { checkLoops: false }],
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsparser,
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                NodeJS: 'readonly',
                AbortSignal: 'readonly',
                AbortController: 'readonly',
                fetch: 'readonly',
                global: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            import: importPlugin,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            'no-console': 'off',
            'no-constant-condition': ['error', { checkLoops: false }],
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
        },
    },
    {
        files: ['test/**/*.ts', 'test/**/*.tsx'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    prettier,
];
