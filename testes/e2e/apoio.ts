import type { Page } from '@playwright/test';

export const SENHA = 'Venitus@Local123';

export const USUARIOS = {
  admin: 'admin@venitus.local',
  gestorAlfa: 'gestor@alfa.local',
  consultorAlfa: 'consultor@alfa.local',
  gestorBeta: 'gestor@beta.local',
  consultorBeta: 'consultor@beta.local',
} as const;

/**
 * Entra pelo formulário e espera a resposta da Server Action, que é quando o
 * cookie de sessão chega.
 *
 * `networkidle` não serve: em desenvolvimento o websocket do HMR nunca deixa a
 * rede ociosa, e a espera estoura o tempo.
 */
export async function entrar(pagina: Page, email: string, senha: string = SENHA): Promise<void> {
  await pagina.goto('/entrar');
  await pagina.getByLabel('E-mail').fill(email);
  await pagina.getByLabel('Senha').fill(senha);

  const resposta = pagina.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/entrar'),
  );
  await pagina.getByRole('button', { name: 'Entrar' }).click();
  await resposta;
}
