import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Testes de integração contra o Postgres real do Supabase local.
 * Separados do portão rápido porque exigem Docker no ar (blueprint §20.6).
 */
export default defineConfig({
  resolve: {
    // O teste do worker importa os adaptadores por `@/`, como a aplicação.
    tsconfigPaths: true,

    alias: {
      // `cliente-admin.ts` marca a si mesmo com `server-only`, que lança ao ser
      // importado fora de um Server Component. O worker roda no servidor e o
      // teste dele também, então aqui vale o mesmo arquivo que a condição
      // `react-server` escolheria — o próprio `empty.js` do pacote.
      //
      // Declarar a condição no `resolve` global seria mais elegante e quebra o
      // `pg`, que troca de entrada conforme ela. Já tentado.
      'server-only': fileURLToPath(new URL('node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['testes/**/*.test.ts'],
    setupFiles: ['testes/apoio/carregar-env.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
