/**
 * Fila comercial e distribuição (blueprint §9.4).
 *
 * O consultor só é atribuído quando a vez chega na fila humana — é esse o
 * momento em que começa o SLA comercial. Antes disso o SLA é da automação.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CORRETORA_ALFA, consultar, encerrarConexao } from '../apoio/ambiente';

const CONSULTOR_ALFA = 'consultor@alfa.local';
const CONSULTOR_BETA = 'consultor@beta.local';

let contador = 0;
const SEMENTE = Math.floor(Math.random() * 1_000_000);

function telefone(): string {
  contador += 1;
  return `+5511${String(900_000_000 + SEMENTE * 100 + contador)}`;
}

async function idDoConsultor(email: string): Promise<string> {
  const [linha] = await consultar<{ id: string }>(
    'select id from public.usuario where email = $1',
    [email],
  );
  return linha?.id ?? '';
}

/** Cria uma oportunidade já na fila, com a prioridade pedida. */
async function naFila(prioridade: number): Promise<string> {
  const [contato] = await consultar<{ id: string }>(
    `select id from public.localizar_ou_criar_contato($1, 'Cliente da Fila', null, $2)`,
    [CORRETORA_ALFA, telefone()],
  );
  const [oportunidade] = await consultar<{ id: string }>(
    `select id from public.abrir_oportunidade($1, $2, null, 'LANDING_PAGE')`,
    [CORRETORA_ALFA, contato?.id],
  );
  const id = oportunidade?.id ?? '';

  await consultar(`select public.mover_oportunidade($1, 'EM_VALIDACAO', 'TESTE')`, [id]);
  await consultar(`select public.mover_oportunidade($1, 'QUALIFICADO', 'TESTE')`, [id]);
  await consultar(`select public.mover_oportunidade($1, 'EM_COTACAO', 'TESTE')`, [id]);
  await consultar(
    `insert into public.cotacao (corretora_id, oportunidade_id, seguradora_id, status)
     select $1, $2, id, 'RETORNADA' from public.seguradora limit 1`,
    [CORRETORA_ALFA, id],
  );
  await consultar(`select public.mover_oportunidade($1, 'COTADO', 'TESTE')`, [id]);
  await consultar(`select public.mover_oportunidade($1, 'NA_FILA', 'TESTE')`, [id]);
  await consultar('update public.oportunidade set prioridade = $2 where id = $1', [id, prioridade]);

  return id;
}

async function distribuir(email: string): Promise<string | null> {
  const [linha] = await consultar<{ id: string | null }>(
    'select * from public.distribuir_proxima($1)',
    [await idDoConsultor(email)],
  );
  return linha?.id ?? null;
}

/**
 * Zera a fila e a carga do consultor antes de cada teste.
 *
 * A carga entra na limpeza porque a capacidade conta oportunidades em aberto:
 * sem isso, as atribuições de um teste contariam contra o limite do seguinte.
 *
 * Pela função de transição, não por `update`: o gatilho recusa mudança de etapa
 * por qualquer outro caminho — inclusive vinda de teste.
 */
beforeEach(async () => {
  await consultar(
    `select public.mover_oportunidade(o.id, 'PERDIDA', 'TESTE', 'limpeza de teste')
     from public.oportunidade o
     where o.corretora_id = $1
       and not public.etapa_e_terminal(o.etapa)
       and (o.etapa = 'NA_FILA' or o.consultor_id = (
         select u.id from public.usuario u where u.email = $2
       ))`,
    [CORRETORA_ALFA, CONSULTOR_ALFA],
  );
});

afterAll(encerrarConexao);

describe('ordem da fila', () => {
  it('entrega primeiro a de maior prioridade', async () => {
    const baixa = await naFila(10);
    const alta = await naFila(90);

    expect(await distribuir(CONSULTOR_ALFA)).toBe(alta);
    expect(await distribuir(CONSULTOR_ALFA)).toBe(baixa);
  });

  it('entre iguais, entrega a que espera há mais tempo', async () => {
    const primeira = await naFila(50);
    await consultar(
      `update public.oportunidade set entrou_na_fila_em = now() - interval '2 hours' where id = $1`,
      [primeira],
    );
    await naFila(50);

    expect(await distribuir(CONSULTOR_ALFA)).toBe(primeira);
  });
});

describe('atribuição', () => {
  it('a mesma oportunidade não é entregue duas vezes', async () => {
    const unica = await naFila(50);

    expect(await distribuir(CONSULTOR_ALFA)).toBe(unica);
    expect(await distribuir(CONSULTOR_ALFA)).toBeNull();
  });

  it('a atribuição inicia o SLA e silencia a automação', async () => {
    await naFila(50);
    const atribuida = await distribuir(CONSULTOR_ALFA);

    const [linha] = await consultar<{
      etapa: string;
      atribuido_em: string | null;
      dono_conversa: string;
    }>('select etapa, atribuido_em, dono_conversa from public.oportunidade where id = $1', [
      atribuida,
    ]);

    expect(linha?.etapa).toBe('ATRIBUIDO');
    expect(linha?.atribuido_em).not.toBeNull();
    expect(linha?.dono_conversa).toBe('CONSULTOR');
  });

  it('consultor de outra corretora não alcança esta fila', async () => {
    await naFila(50);
    expect(await distribuir(CONSULTOR_BETA)).toBeNull();
  });

  it('respeita a capacidade do consultor', async () => {
    await naFila(50);
    await naFila(50);
    await consultar('update public.usuario set capacidade_atendimento = 1 where email = $1', [
      CONSULTOR_ALFA,
    ]);

    const primeira = await distribuir(CONSULTOR_ALFA);
    const segunda = await distribuir(CONSULTOR_ALFA);

    await consultar('update public.usuario set capacidade_atendimento = 20 where email = $1', [
      CONSULTOR_ALFA,
    ]);

    expect(primeira).not.toBeNull();
    expect(segunda).toBeNull();
  });

  it('capacidade zero significa sem limite, não fila parada', async () => {
    // É o padrão de quem ainda não configurou.
    await naFila(50);
    await consultar('update public.usuario set capacidade_atendimento = 0 where email = $1', [
      CONSULTOR_ALFA,
    ]);

    const entregue = await distribuir(CONSULTOR_ALFA);

    await consultar('update public.usuario set capacidade_atendimento = 20 where email = $1', [
      CONSULTOR_ALFA,
    ]);

    expect(entregue).not.toBeNull();
  });

  it('fila vazia devolve nada, sem erro', async () => {
    expect(await distribuir(CONSULTOR_ALFA)).toBeNull();
  });

  it('gestor não recebe da fila do consultor', async () => {
    await naFila(50);
    expect(await distribuir('gestor@alfa.local')).toBeNull();
  });
});
