import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './test'),
    },
  },
  test: {
    root: __dirname,
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, './test/setup.ts')],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next', 'e2e', '../backend/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/components/ui/**',
        'src/types/**',
      ],
      thresholds: {
        statements: 35,
        branches: 30,
        functions: 25,
        lines: 35,
      },
    },
  },
});
