import { defineConfig } from 'vitest/config';

/**
 * Testes de integração contra o Postgres real do Supabase local.
 * Separados do portão rápido porque exigem Docker no ar (blueprint §20.6).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['testes/**/*.test.ts'],
    setupFiles: ['testes/apoio/carregar-env.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
