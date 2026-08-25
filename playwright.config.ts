import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de ponta a ponta.
 *
 * Blueprint §21.5: poucos e estáveis, sobre os caminhos que não podem quebrar.
 * O login é o primeiro deles — foi entregue quebrado uma vez por não existir
 * verificação automática do formulário.
 */
export default defineConfig({
  testDir: './testes/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env['CI'] !== undefined,
  retries: process.env['CI'] !== undefined ? 1 : 0,
  reporter: process.env['CI'] !== undefined ? 'line' : [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },

  projects: [
    // Perfil de celular: é como o consultor usa o produto (§5.4).
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/entrar',
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 120_000,
  },
});
