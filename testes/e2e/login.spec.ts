import { expect, test } from '@playwright/test';
import { USUARIOS, entrar } from './apoio';

const CONSULTOR = USUARIOS.consultorAlfa;
const GESTOR = USUARIOS.gestorAlfa;
const ADMIN = USUARIOS.admin;

test.describe('login', () => {
  test('o consultor entra e cai na própria área', async ({ page }) => {
    await entrar(page, CONSULTOR);

    await expect(page).toHaveURL('/app/inicio');
    await expect(page.getByRole('banner').getByText(CONSULTOR)).toBeVisible();
  });

  test('o gestor entra e cai na própria área', async ({ page }) => {
    await entrar(page, GESTOR);
    await expect(page).toHaveURL('/gestor/inicio');
  });

  test('o administrador entra e cai na própria área', async ({ page }) => {
    await entrar(page, ADMIN);
    await expect(page).toHaveURL('/admin/inicio');
  });

  test('senha errada devolve mensagem genérica e não sai da tela', async ({ page }) => {
    await entrar(page, CONSULTOR, 'senha-que-nao-e-a-certa');

    await expect(page.locator('form').getByRole('alert')).toHaveText('Credenciais inválidas.');
    await expect(page).toHaveURL('/entrar');
  });

  test('e-mail inexistente devolve a mesma mensagem, sem revelar nada', async ({ page }) => {
    // Blueprint §4.1 (V12): distinguir os casos daria um oráculo de e-mails válidos.
    await entrar(page, 'ninguem@alfa.local');
    await expect(page.locator('form').getByRole('alert')).toHaveText('Credenciais inválidas.');
  });
});

test.describe('isolamento entre áreas', () => {
  test('o consultor não alcança a área do administrador', async ({ page }) => {
    await entrar(page, CONSULTOR);
    await page.goto('/admin/inicio');

    await expect(page).toHaveURL('/sem-permissao');
  });

  test('o consultor não alcança a área do gestor', async ({ page }) => {
    await entrar(page, CONSULTOR);
    await page.goto('/gestor/inicio');

    await expect(page).toHaveURL('/sem-permissao');
  });

  test('o gestor não alcança a área do consultor', async ({ page }) => {
    await entrar(page, GESTOR);
    await page.goto('/app/inicio');

    await expect(page).toHaveURL('/sem-permissao');
  });

  test('quem já entrou não fica preso na tela de login', async ({ page }) => {
    await entrar(page, CONSULTOR);
    await page.goto('/entrar');

    await expect(page).toHaveURL('/app/inicio');
  });
});

test.describe('sessão', () => {
  test('a sessão sobrevive ao recarregar', async ({ page }) => {
    await entrar(page, CONSULTOR);
    await page.reload();

    await expect(page).toHaveURL('/app/inicio');
  });

  test('o cookie de sessão é inacessível ao JavaScript', async ({ page }) => {
    // Blueprint §4.1 (V1): a sessão vive em cookie HttpOnly.
    await entrar(page, CONSULTOR);

    const visivelAoScript = await page.evaluate(() => document.cookie);
    expect(visivelAoScript).not.toContain('auth-token');
  });

  test('sair encerra a sessão de verdade', async ({ page }) => {
    await entrar(page, CONSULTOR);
    await page.getByRole('button', { name: 'Sair' }).click();

    await expect(page).toHaveURL('/entrar');

    await page.goto('/app/inicio');
    await expect(page).toHaveURL('/entrar');
  });
});

test.describe('vazamento no cliente', () => {
  test('a página autenticada não carrega chave de banco', async ({ page }) => {
    await entrar(page, CONSULTOR);

    const html = await page.content();
    expect(html).not.toContain('service_role');
    // A chave anônima é do servidor; ela não tem por que aparecer no cliente (§4.1 V2).
    expect(html).not.toContain('SUPABASE_ANON_KEY');
    expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\./);
  });

  test('o modo de dados ativo aparece na tela', async ({ page }) => {
    await entrar(page, CONSULTOR);
    await expect(page.getByRole('status')).toContainText('sintéticos');
  });
});
