import { expect, test } from '@playwright/test';
import { USUARIOS, entrar } from './apoio';

/**
 * Segundo fator (blueprint §4.4).
 *
 * A obrigatoriedade fica desligada em desenvolvimento, então estes testes
 * verificam o que vale nos dois modos: o consultor nunca é interrompido, e a
 * tela de cadastro funciona para quem chegar nela.
 *
 * O caminho com obrigatoriedade ligada é coberto por `src/seguranca/mfa.test.ts`,
 * que exercita todos os ramos da decisão sem depender do ambiente.
 */

test.describe('segundo fator', () => {
  test('o consultor entra sem ser interrompido', async ({ page }) => {
    await entrar(page, USUARIOS.consultorAlfa);
    await expect(page).toHaveURL('/app/inicio');
  });

  test('a tela de cadastro exige sessão', async ({ page }) => {
    await page.goto('/mfa/cadastrar');
    await expect(page).toHaveURL('/entrar');
  });

  test('quem tem sessão vê o código para o aplicativo autenticador', async ({ page }) => {
    await entrar(page, USUARIOS.gestorAlfa);
    await page.goto('/mfa/cadastrar');

    await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible();
    // O QR vem como SVG do próprio servidor de Auth; nada externo é carregado.
    await expect(page.locator('.qr svg')).toBeVisible();
    await expect(page.getByLabel('Código do aplicativo')).toBeVisible();
  });

  test('oferece o segredo em texto para quem não consegue ler o código', async ({ page }) => {
    await entrar(page, USUARIOS.gestorAlfa);
    await page.goto('/mfa/cadastrar');

    await page.getByText('Não consigo ler o código').click();
    await expect(page.locator('.codigo-manual')).not.toBeEmpty();
  });

  test('código errado devolve mensagem e não encerra a sessão', async ({ page }) => {
    await entrar(page, USUARIOS.gestorAlfa);
    await page.goto('/mfa/cadastrar');

    await page.getByLabel('Código do aplicativo').fill('000000');
    const resposta = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/mfa/cadastrar'),
    );
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await resposta;

    await expect(page.locator('form').getByRole('alert')).toHaveText('Código inválido.');
  });

  test('sem fator cadastrado, verificar leva de volta ao cadastro', async ({ page }) => {
    await entrar(page, USUARIOS.gestorAlfa);
    await page.goto('/mfa/verificar');

    await expect(page).toHaveURL('/mfa/cadastrar');
  });
});
