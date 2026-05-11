import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular({ jit: true, tsconfig: './tsconfig.spec.json' })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/test-setup.ts',
        'src/app/app.config.ts',
        'src/app/app.routes.ts',
        // Guards and interceptors — covered by E2E/integration tests
        'src/app/core/**/*.guard.ts',
        'src/app/core/**/interceptors/**',
        // Page components — stub shells covered by Playwright E2E
        'src/app/pages/**',
        // Layout components — structure/nav, covered by Playwright E2E
        'src/app/layout/**',
        // Presentation-only UI components — no logic, covered by Playwright E2E
        'src/app/shared/ui/**',
        'src/app/shared/brand/**',
        'src/app/shared/icons/**',
        'src/app/shared/charts/**',
      ],
      thresholds: {
        lines: 45,
      },
    },
  },
});
