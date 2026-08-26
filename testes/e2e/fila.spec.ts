import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { USUARIOS, entrar } from './apoio';
import { clienteSintetico, encerrarConexao, limparCorretora, porNaFila } from './apoio-dados';

/**
 * O caminho do consultor, no navegador (blueprint §9.4 e §9.5).
 *
 * Verificar as partes não é verificar o todo: a consulta pode estar certa, o
 * DTO pode estar certo e a tela ainda assim não mostrar cliente nenhum. Este
 * arquivo percorre o que o consultor percorre — entra, vê a fila com contexto,
 * puxa o próximo e o encontra em "meus atendimentos".
 */

let cliente = clienteSintetico(1);

/** Espera a resposta da Server Action, que é quando a fila muda de estado. */
async function atenderProximo(pagina: Page): Promise<void> {
  const resposta = pagina.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/app/fila'),
  );
  await pagina.getByRole('button', { name: 'Atender próximo cliente' }).click();
  await resposta;
}

test.beforeEach(async () => {
  await limparCorretora();
});

test.afterAll(async () => {
  await limparCorretora();
  await encerrarConexao();
});

test.describe('a fila do consultor', () => {
  test('mostra o contexto do cliente, não "novo lead"', async ({ page }) => {
    cliente = clienteSintetico(2);
    await porNaFila(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto('/app/fila');

    // Cada linha aqui existe porque a operação real a lê antes de ligar.
    await expect(page.getByRole('heading', { name: cliente.nome })).toBeVisible();
    await expect(page.getByText('Chevrolet Tracker Premier 2024')).toBeVisible();
    await expect(page.getByText('Quente')).toBeVisible();
    await expect(page.getByText('Roubo e furto')).toBeVisible();
    await expect(page.getByText('Confirmar CEP')).toBeVisible();
    await expect(page.getByText('É o próximo a ser atendido.')).toBeVisible();
  });

  test('a temperatura é medidor, não cápsula colorida', async ({ page }) => {
    cliente = clienteSintetico(3);
    await porNaFila(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto('/app/fila');

    // Design system §10: nível, forma e cor codificando o mesmo dado.
    await expect(page.locator('.medidor-traco[data-aceso]')).toHaveCount(3);
  });

  test('puxar o próximo tira da fila e põe em meus atendimentos', async ({ page }) => {
    cliente = clienteSintetico(4);
    await porNaFila(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto('/app/fila');
    await atenderProximo(page);

    await expect(page.getByText('Nenhum cliente aguardando.')).toBeVisible();

    await page.goto('/app/atendimentos');
    await expect(page.getByRole('heading', { name: cliente.nome })).toBeVisible();
    await expect(page.getByText('Atribuído a você.')).toBeVisible();
  });

  test('a fila vazia diz o que vai preenchê-la', async ({ page }) => {
    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto('/app/fila');

    await expect(page.getByText('Nenhum cliente aguardando.')).toBeVisible();
    await expect(page.getByText(/Assim que um lead for qualificado/)).toBeVisible();
  });

  test('sem ninguém na fila, o aviso é claro em vez de silêncio', async ({ page }) => {
    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto('/app/fila');
    await atenderProximo(page);

    await expect(page.getByText('Nenhum cliente disponível para você agora.')).toBeVisible();
  });

  test('a fila de uma corretora não aparece para a outra', async ({ page }) => {
    cliente = clienteSintetico(5);
    await porNaFila(cliente);

    await entrar(page, USUARIOS.consultorBeta);
    await page.goto('/app/fila');

    await expect(page.getByText('Nenhum cliente aguardando.')).toBeVisible();
    await expect(page.getByRole('heading', { name: cliente.nome })).toHaveCount(0);
  });
});

test.describe('o início do consultor', () => {
  test('os números são os da operação, não traços', async ({ page }) => {
    cliente = clienteSintetico(6);
    await porNaFila(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto('/app/inicio');

    const aguardando = page.locator('.placa', { hasText: 'aguardando atendimento' });
    await expect(aguardando.locator('.placa-valor')).toHaveText('1');

    const quentes = page.locator('.placa', { hasText: 'clientes quentes' });
    await expect(quentes.locator('.placa-valor')).toHaveText('1');
  });

  test('o atendimento assumido aparece nos meus números', async ({ page }) => {
    cliente = clienteSintetico(7);
    await porNaFila(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto('/app/fila');
    await atenderProximo(page);

    await page.goto('/app/inicio');
    const meus = page.locator('.placa', { hasText: 'atendimentos meus em aberto' });
    await expect(meus.locator('.placa-valor')).toHaveText('1');
  });
});
