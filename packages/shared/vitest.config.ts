import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // NodeNext tsconfig requires .js extensions in imports, but Vitest processes
      // TypeScript directly via Vite and needs to find the .ts source files instead.
      { find: /^(\.{1,2}\/.+)\.js$/, replacement: '$1' },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      thresholds: { lines: 80 },
    },
  },
});
