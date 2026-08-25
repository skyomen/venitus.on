import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve os aliases de `tsconfig.json` (`@/*`) nativamente.
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'testes/**/*.test.ts'],
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

        // Pontos de entrada do framework: só composição, sem lógica.
        // Lógica que aparecer aqui é sinal de que ela está no lugar errado.
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',

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
