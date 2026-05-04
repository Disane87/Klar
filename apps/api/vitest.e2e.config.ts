import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.spec.ts'],
    setupFiles: ['./test/e2e-setup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30000,
  },
});
