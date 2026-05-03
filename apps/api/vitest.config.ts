import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.e2e.spec.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.controller.ts',
        'src/**/*.repository.ts',
        'src/**/*.guard.ts',
        'src/**/*.decorator.ts',
        'src/**/*.dto.ts',
        'src/**/*.d.ts',
        'src/**/strategies/**',
        'src/common/types/**',
        'src/common/filters/**',
        'src/config/**',
        'src/health/**',
        'src/mail/**',
        'src/prisma/**',
      ],
      thresholds: {
        lines: 70,
      },
    },
  },
});
