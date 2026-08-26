import { expect, test } from '@playwright/test';
import { USUARIOS, entrar } from './apoio';
import { clienteSintetico, emAtendimento, encerrarConexao, limparCorretora } from './apoio-dados';

/**
 * A tela onde o consultor trabalha (blueprint §9.5).
 *
 * O que o teste percorre é o que a operação percorre: abrir o atendimento pelo
 * cartão, ler o contexto, resolver a pendência que trava e marcar o plano que
 * o cliente quer — vendo a linha do tempo registrar cada passo.
 */

test.beforeEach(async () => {
  await limparCorretora();
});

test.afterAll(async () => {
  await limparCorretora();
  await encerrarConexao();
});

test.describe('o atendimento', () => {
  test('abre pelo cartão de "meus atendimentos"', async ({ page }) => {
    const cliente = clienteSintetico(11);
    await emAtendimento(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto('/app/atendimentos');
    await page.getByRole('link', { name: 'Abrir atendimento' }).click();

    await expect(page.getByRole('heading', { name: cliente.nome, level: 1 })).toBeVisible();
    await expect(page.getByText('Em atendimento', { exact: true })).toBeVisible();
  });

  test('mostra pendências, opções e histórico', async ({ page }) => {
    const cliente = clienteSintetico(12);
    const oportunidade = await emAtendimento(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto(`/app/atendimento/${oportunidade}`);

    // Pelo marcador de estado: o nome também aparece dentro do botão, para
    // leitor de tela, e é bom que apareça.
    const pendencias = page.locator('.lista-pendencias .estado-texto');
    await expect(pendencias.filter({ hasText: 'Confirmar CEP' })).toBeVisible();

    // Da mais barata para a mais cara: é a ordem da conversa.
    const opcoes = page.locator('.lista-opcoes > li');
    await expect(opcoes.first()).toContainText('Essencial');
    await expect(page.getByText('R$ 1.800,00')).toBeVisible();
    await expect(page.getByText('R$ 2.400,00')).toBeVisible();
    await expect(page.getByText('De Na fila para Em atendimento')).toBeVisible();
  });

  test('resolver a pendência tira o botão e registra no histórico', async ({ page }) => {
    const cliente = clienteSintetico(13);
    const oportunidade = await emAtendimento(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto(`/app/atendimento/${oportunidade}`);

    const resposta = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/app/atendimento'),
    );
    await page.getByRole('button', { name: /Resolver/ }).click();
    await resposta;

    await expect(page.getByRole('button', { name: /Resolver/ })).toHaveCount(0);
    await expect(page.locator('.lista-pendencias').getByText('Resolvida')).toBeVisible();
    await expect(page.getByText('Pendência resolvida')).toBeVisible();
  });

  test('marcar o plano preenche a linha de §9.5 no cartão', async ({ page }) => {
    const cliente = clienteSintetico(14);
    const oportunidade = await emAtendimento(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto(`/app/atendimento/${oportunidade}`);

    const resposta = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/app/atendimento'),
    );
    await page.getByRole('button', { name: /É este o plano Essencial/ }).click();
    await resposta;

    await expect(page.getByText('Plano de interesse do cliente')).toBeVisible();
    await expect(page.getByText('Plano de interesse', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Desmarcar/ })).toBeVisible();
  });

  test('desmarcar devolve a escolha ao estado anterior', async ({ page }) => {
    const cliente = clienteSintetico(15);
    const oportunidade = await emAtendimento(cliente);

    await entrar(page, USUARIOS.consultorAlfa);
    await page.goto(`/app/atendimento/${oportunidade}`);

    for (const nome of [/É este o plano Essencial/, /Desmarcar/]) {
      const resposta = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/app/atendimento'),
      );
      await page.getByRole('button', { name: nome }).click();
      await resposta;
    }

    await expect(page.getByText('Plano de interesse do cliente')).toHaveCount(0);
  });

  test('o atendimento de outra corretora não existe para quem pede', async ({ page }) => {
    // 404 e não "sem permissão": dizer que ela existe já é dizer algo.
    const oportunidade = await emAtendimento(clienteSintetico(16));

    await entrar(page, USUARIOS.consultorBeta);
    const resposta = await page.goto(`/app/atendimento/${oportunidade}`);

    expect(resposta?.status()).toBe(404);
  });
});
