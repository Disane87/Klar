import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      // TODO: Re-enable threshold when more modules have coverage (Phase 2+)
      // thresholds: {
      //   lines: 80,
      // },
    },
  },
});
