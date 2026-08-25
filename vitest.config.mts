import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve os aliases de `tsconfig.json` (`@/*`) nativamente.
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],

      // Exclusões da seção 20.6 do blueprint.
      // Cada entrada precisa de justificativa escrita. Nada de `c8 ignore` espalhado no código.
      exclude: [
        // Testes não medem a si mesmos.
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',

        // Pontos de entrada do framework: rotas, layouts e Server Actions.
        // São composição e orquestração; a decisão que eles tomam vive em
        // `seguranca/autorizacao.ts`, `seguranca/perfil.ts` e `seguranca/credenciais.ts`,
        // que são puros e cobertos. Lógica que aparecer aqui está no lugar errado.
        'src/app/**',

        // Guard de rota. Ele delega inteiramente a `decidirRota`, que é testada
        // em todos os ramos. Além disso não é segurança (§4.1, V13) — quem barra
        // é o layout de cada área e a RLS.
        'src/proxy.ts',

        // Adaptadores de infraestrutura: ligam o Supabase ao cookie do Next e ao
        // ambiente, e não decidem nada. A fronteira que eles protegem é
        // verificada por `npm run bundle`, pelos testes de isolamento contra o
        // Postgres real e pelo E2E do webhook.
        'src/dados/cliente-servidor.ts',
        'src/dados/cliente-admin.ts',

        // Chamada ao Auth mais redirecionamento. Toda a decisão está em
        // `perfil.ts` e `autorizacao.ts`.
        'src/seguranca/sessao.ts',

        // Server Actions são pontos de entrada onde quer que morem: leem cookie,
        // chamam serviço e redirecionam. A decisão que elas tomam vive em módulos
        // puros e cobertos — `design/tema.ts`, `seguranca/credenciais.ts`.
        'src/**/acoes.ts',

        // Tipos gerados a partir do schema do banco.
        'src/dados/tipos-gerados.ts',
      ],

      thresholds: {
        lines: 98,
        branches: 98,
        functions: 98,
        statements: 98,
      },
    },
  },
});
