import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // Base configuration for all files
  js.configs.recommended,
  
  // TypeScript-specific configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2016,
        sourceType: 'module'
      },
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        module: 'readonly',
        
        // Browser/runtime globals that may be polyfilled
        performance: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AbortController: 'readonly',
        
        // Test framework globals
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
        
        // TypeScript globals
        NodeJS: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // TypeScript rules - more lenient for framework code
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // Allow any for framework flexibility
      '@typescript-eslint/no-namespace': 'off', // Allow namespaces for declarations
      '@typescript-eslint/no-empty-object-type': 'off', // Allow empty interfaces
      
      // General JavaScript rules - relaxed for this codebase
      'no-console': 'off', // Allow console.log
      'no-unused-vars': 'off', // Handled by TypeScript rule
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': 'warn',
      'curly': 'off', // Disable curly brace requirement
      'no-undef': 'off', // TypeScript handles this better
      'no-case-declarations': 'off', // Allow declarations in case blocks
      'no-constant-binary-expression': 'off' // Disable for polyfill logic
    }
  },
  
  // Ignore configuration
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.js', // Ignore JS files in root (like this config)
      '**/*.d.ts',
      'test/fixtures/**'
    ]
  }
];