/**
 * A máquina de estados da jornada (blueprint §8).
 *
 * Roda contra o Postgres real porque as regras vivem no banco: a transição é uma
 * função, e o gatilho que recusa qualquer outro caminho não existe fora dele.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CORRETORA_ALFA, consultar, encerrarConexao } from '../apoio/ambiente';

interface Oportunidade extends Record<string, unknown> {
  id: string;
  etapa: string;
  dono_conversa: string;
  entrou_na_fila_em: string | null;
  encerrada_em: string | null;
  motivo_encerramento: string | null;
}

let oportunidade: string;
let contato: string;

async function novaOportunidade(): Promise<string> {
  const sufixo = Math.floor(Math.random() * 1e9)
    .toString()
    .padStart(9, '0');

  const [criado] = await consultar<{ id: string }>(
    `select id from public.localizar_ou_criar_contato($1, 'Cliente Sintético', $2, null)`,
    [CORRETORA_ALFA, `${sufixo}00`],
  );
  contato = criado?.id ?? '';

  const [aberta] = await consultar<{ id: string }>(
    `select id from public.abrir_oportunidade($1, $2, null, 'LANDING_PAGE')`,
    [CORRETORA_ALFA, contato],
  );
  return aberta?.id ?? '';
}

async function mover(etapa: string, motivo: string | null = null): Promise<Oportunidade[]> {
  return consultar<Oportunidade>(`select * from public.mover_oportunidade($1, $2, 'TESTE', $3)`, [
    oportunidade,
    etapa,
    motivo,
  ]);
}

beforeEach(async () => {
  oportunidade = await novaOportunidade();
});

afterAll(encerrarConexao);

describe('transições', () => {
  it('a oportunidade nasce em NOVO com qualificação criada', async () => {
    const [linha] = await consultar<Oportunidade>(
      'select etapa, dono_conversa from public.oportunidade where id = $1',
      [oportunidade],
    );
    expect(linha?.etapa).toBe('NOVO');
    expect(linha?.dono_conversa).toBe('AUTOMACAO');

    const qualificacao = await consultar(
      'select intencao from public.qualificacao where oportunidade_id = $1',
      [oportunidade],
    );
    expect(qualificacao).toHaveLength(1);
  });

  it('avança por uma transição declarada', async () => {
    const [movida] = await mover('EM_VALIDACAO');
    expect(movida?.etapa).toBe('EM_VALIDACAO');
  });

  it('recusa transição que pula etapa', async () => {
    await expect(mover('VENDIDA')).rejects.toThrow(/transição inválida/);
  });

  it('recusa voltar de uma etapa terminal', async () => {
    await mover('EM_VALIDACAO');
    await mover('PERDIDA', 'cliente desistiu');

    await expect(mover('EM_VALIDACAO')).rejects.toThrow(/transição inválida/);
  });

  it('grava um evento por transição, com origem e destino', async () => {
    await mover('EM_VALIDACAO');
    await mover('QUALIFICADO');

    const eventos = await consultar<{ de_etapa: string; para_etapa: string; ator: string }>(
      `select de_etapa, para_etapa, ator from public.oportunidade_evento
       where oportunidade_id = $1 and tipo = 'TRANSICAO' order by ocorrido_em`,
      [oportunidade],
    );

    expect(eventos.map((e) => [e.de_etapa, e.para_etapa])).toEqual([
      ['NOVO', 'EM_VALIDACAO'],
      ['EM_VALIDACAO', 'QUALIFICADO'],
    ]);
    expect(eventos[0]?.ator).toBe('TESTE');
  });
});

describe('o caminho único', () => {
  it('recusa alterar a etapa por update direto', async () => {
    // É esta a garantia que faz a máquina de estados valer alguma coisa.
    await expect(
      consultar(`update public.oportunidade set etapa = 'VENDIDA' where id = $1`, [oportunidade]),
    ).rejects.toThrow(/etapa só muda por mover_oportunidade/);
  });

  it('permite alterar outras colunas normalmente', async () => {
    await consultar('update public.oportunidade set prioridade = 42 where id = $1', [oportunidade]);

    const [linha] = await consultar<{ prioridade: number }>(
      'select prioridade from public.oportunidade where id = $1',
      [oportunidade],
    );
    expect(linha?.prioridade).toBe(42);
  });
});

describe('pré-condições da etapa de destino', () => {
  it('ATRIBUIDO exige consultor, porque o SLA comercial começa nele', async () => {
    await mover('EM_VALIDACAO');
    await mover('QUALIFICADO');
    await mover('EM_COTACAO');

    await consultar(
      `insert into public.cotacao (corretora_id, oportunidade_id, seguradora_id, status)
       select $1, $2, id, 'RETORNADA' from public.seguradora limit 1`,
      [CORRETORA_ALFA, oportunidade],
    );
    await mover('COTADO');
    await mover('NA_FILA');

    await expect(mover('ATRIBUIDO')).rejects.toThrow(/exige consultor/);
  });

  it('COTADO exige cotação retornada', async () => {
    await mover('EM_VALIDACAO');
    await mover('QUALIFICADO');
    await mover('EM_COTACAO');

    await expect(mover('COTADO')).rejects.toThrow(/exige cotação retornada/);
  });

  it('encerrar exige motivo', async () => {
    await expect(mover('PERDIDA')).rejects.toThrow(/exige motivo/);
  });
});

describe('efeitos da transição', () => {
  it('NA_FILA marca a entrada na fila', async () => {
    await mover('EM_VALIDACAO');
    await mover('QUALIFICADO');
    await mover('EM_COTACAO');
    await consultar(
      `insert into public.cotacao (corretora_id, oportunidade_id, seguradora_id, status)
       select $1, $2, id, 'RETORNADA' from public.seguradora limit 1`,
      [CORRETORA_ALFA, oportunidade],
    );
    await mover('COTADO');

    const [naFila] = await mover('NA_FILA');
    expect(naFila?.entrou_na_fila_em).not.toBeNull();
  });

  it('a atribuição silencia a automação', async () => {
    // §11.5: sem isso, a régua cobra o cliente enquanto o consultor conversa.
    await consultar(
      `update public.oportunidade
          set consultor_id = (select id from public.usuario where email = 'consultor@alfa.local'),
              atribuido_em = now()
        where id = $1`,
      [oportunidade],
    );
    await mover('EM_VALIDACAO');
    await mover('QUALIFICADO');
    await mover('EM_COTACAO');
    await consultar(
      `insert into public.cotacao (corretora_id, oportunidade_id, seguradora_id, status)
       select $1, $2, id, 'RETORNADA' from public.seguradora limit 1`,
      [CORRETORA_ALFA, oportunidade],
    );
    await mover('COTADO');
    await mover('NA_FILA');

    const [atribuida] = await mover('ATRIBUIDO');
    expect(atribuida?.dono_conversa).toBe('CONSULTOR');
  });

  it('cancela os agendamentos pendentes da etapa anterior', async () => {
    await consultar(
      `insert into public.agendamento
         (corretora_id, oportunidade_id, tipo, executar_em, chave_unicidade)
       values ($1, $2, 'INATIVIDADE_30M', now() + interval '30 minutes', $3)`,
      [CORRETORA_ALFA, oportunidade, `teste:${oportunidade}`],
    );

    await mover('EM_VALIDACAO');

    const [agendamento] = await consultar<{ status: string }>(
      'select status from public.agendamento where oportunidade_id = $1',
      [oportunidade],
    );
    expect(agendamento?.status).toBe('CANCELADO');
  });

  it('enfileira o espelhamento no outbox, na mesma transação', async () => {
    await mover('EM_VALIDACAO');

    const [saida] = await consultar<{ destino: string; operacao: string; status: string }>(
      `select destino, operacao, status from public.integracao_outbox
       where oportunidade_id = $1`,
      [oportunidade],
    );
    expect(saida?.destino).toBe('CRM');
    expect(saida?.operacao).toBe('MOVER_ETAPA');
    expect(saida?.status).toBe('PENDENTE');
  });

  it('encerrar registra data e motivo', async () => {
    const [perdida] = await mover('PERDIDA', 'não quis realizar o seguro');

    expect(perdida?.encerrada_em).not.toBeNull();
    expect(perdida?.motivo_encerramento).toBe('não quis realizar o seguro');
  });
});
