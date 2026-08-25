import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { USUARIOS, entrar } from './apoio';

/**
 * Tema claro e escuro (design system §03).
 *
 * O tema é resolvido no servidor: aplicá-lo no cliente faria a página abrir no
 * tema errado e piscar ao corrigir. Estes testes verificam justamente isso — o
 * documento já chega marcado.
 */

/** Sai de `sistema` para `claro`, esperando a resposta do servidor. */
async function escolherClaro(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Sistema/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
}

async function somaDoFundo(page: Page): Promise<number> {
  const cor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const canais = cor.match(/\d+/g)?.map(Number) ?? [];
  return (canais[0] ?? 0) + (canais[1] ?? 0) + (canais[2] ?? 0);
}

test.describe('tema', () => {
  test('sem escolha, o documento não é marcado e o sistema decide', async ({ page }) => {
    await entrar(page, USUARIOS.consultorAlfa);

    await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.+/);
    await expect(page.getByRole('button', { name: /Sistema/ })).toBeVisible();
  });

  test('o ciclo passa por claro, escuro e volta a sistema', async ({ page }) => {
    // Com um interruptor de dois estados, quem alternasse uma vez nunca mais
    // voltaria a acompanhar o aparelho.
    await entrar(page, USUARIOS.consultorAlfa);

    await escolherClaro(page);

    await page.getByRole('button', { name: /Claro/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');

    await page.getByRole('button', { name: /Escuro/ }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.+/);
  });

  test('a escolha sobrevive à navegação', async ({ page }) => {
    await entrar(page, USUARIOS.consultorAlfa);
    // A escolha vai ao servidor; navegar antes da resposta testaria a corrida.
    await escolherClaro(page);

    await page.goto('/app/inicio');
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  });

  test('o claro é claro e o escuro é escuro, de verdade', async ({ page }) => {
    await entrar(page, USUARIOS.consultorAlfa);

    await escolherClaro(page);
    expect(await somaDoFundo(page)).toBeGreaterThan(600);

    await page.getByRole('button', { name: /Claro/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
    expect(await somaDoFundo(page)).toBeLessThan(200);
  });

  test('a preferência sobrevive ao logout — ela é do aparelho, não do acesso', async ({ page }) => {
    await entrar(page, USUARIOS.consultorAlfa);
    await escolherClaro(page);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL('/entrar');
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  });
});
