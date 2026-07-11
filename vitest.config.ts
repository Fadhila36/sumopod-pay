import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'test/unit/**/*.test.ts',
      'test/integration/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/express.ts',
        'src/nest.ts',
        'src/dto/**',
        'src/interfaces/**',
        'src/webhook/nest/sumopod.module.ts',
        'src/webhook/nest/sumopod.service.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    setupFiles: ['./test/setup.ts'],
  },
});
