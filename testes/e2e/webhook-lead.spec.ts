import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * A porta de entrada do lead (blueprint §10.4).
 *
 * Um webhook é uma porta aberta na internet: a assinatura é conferida antes de
 * qualquer processamento, e o tenant vem do canal, nunca do corpo.
 */

const SEGREDO = process.env['WEBHOOK_SEGREDO_MIDIA'] ?? 'segredo-local-midia';
const CAMINHO = '/api/webhooks/lead';

function assinar(corpo: string): string {
  return createHmac('sha256', SEGREDO).update(corpo, 'utf8').digest('hex');
}

let contador = 0;
const SEMENTE = Math.floor(Math.random() * 1_000_000);

/** Telefone sintético e único por execução (AGENTS.md, invariante 10). */
function telefone(): string {
  contador += 1;
  return `+5511${String(900_000_000 + SEMENTE * 100 + contador)}`;
}

async function postar(
  request: APIRequestContext,
  corpo: Record<string, unknown>,
  assinatura?: string,
): Promise<APIResponse> {
  const texto = JSON.stringify(corpo);
  return request.post(CAMINHO, {
    headers: {
      'content-type': 'application/json',
      'x-venitus-assinatura': assinatura ?? assinar(texto),
    },
    data: texto,
  });
}

test.describe('assinatura', () => {
  test('recusa requisição sem assinatura', async ({ request }) => {
    const resposta = await request.post(CAMINHO, {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ canal: 'lp-alfa', nome: 'Sem Assinatura' }),
    });

    expect(resposta.status()).toBe(401);
  });

  test('recusa assinatura de outro corpo', async ({ request }) => {
    const resposta = await postar(
      request,
      { canal: 'lp-alfa', nome: 'Assinatura Trocada', telefone: telefone() },
      assinar('{"outro":"corpo"}'),
    );

    expect(resposta.status()).toBe(401);
  });

  test('a recusa não conta o que houve de errado', async ({ request }) => {
    // Detalhar ajudaria quem está tentando adivinhar.
    const resposta = await postar(request, { canal: 'lp-alfa', nome: 'X' }, 'assinatura-inventada');
    const corpo = (await resposta.json()) as { erro: string };

    expect(corpo.erro).toBe('Assinatura inválida.');
  });
});

test.describe('corpo', () => {
  test('recusa JSON malformado', async ({ request }) => {
    // Corpo em bytes: dado como string com tipo JSON, o cliente de teste remonta
    // o conteúdo e a assinatura deixa de bater — o teste falharia por um motivo
    // que não é o que ele afirma verificar.
    const texto = '{ isto não é json';
    const resposta = await request.post(CAMINHO, {
      headers: { 'content-type': 'application/json', 'x-venitus-assinatura': assinar(texto) },
      data: Buffer.from(texto, 'utf8'),
    });

    expect(resposta.status()).toBe(400);
  });

  test('recusa lead sem canal', async ({ request }) => {
    const resposta = await postar(request, { nome: 'Sem Canal', telefone: telefone() });

    expect(resposta.status()).toBe(400);
  });
});

test.describe('entrada', () => {
  test('lead com canal conhecido é recebido', async ({ request }) => {
    // Nome com acento de propósito: cliente brasileiro tem acento no nome, e a
    // assinatura precisa bater sobre o corpo em UTF-8.
    const resposta = await postar(request, {
      canal: 'lp-alfa',
      nome: 'Cliente Sintético Açaí',
      telefone: telefone(),
    });

    expect(resposta.status()).toBe(201);
    expect(await resposta.json()).toEqual({ situacao: 'RECEBIDO' });
  });

  test('canal desconhecido vai para quarentena, não vira erro', async ({ request }) => {
    // Devolver erro faria a origem reenviar para sempre o que nunca terá dono.
    const resposta = await postar(request, {
      canal: 'canal-que-ninguem-cadastrou',
      nome: 'Sem Dono',
      telefone: telefone(),
    });

    expect(resposta.status()).toBe(202);
    expect(await resposta.json()).toEqual({ situacao: 'EM_QUARENTENA' });
  });

  test('a corretora do corpo é ignorada', async ({ request }) => {
    // O tenant vem do canal (§6.8). Se viesse do corpo, qualquer um postaria
    // lead na corretora que quisesse.
    const resposta = await postar(request, {
      canal: 'lp-alfa',
      nome: 'Tentativa de Tenant',
      telefone: telefone(),
      corretora_id: '00000000-0000-4000-8000-00000000000b',
    });

    expect(resposta.status()).toBe(201);
  });
});
