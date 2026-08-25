/**
 * Réguas de follow-up no banco (blueprint §11.3).
 *
 * A regra que mais importa: quando o cliente responde, todos os agendamentos
 * pendentes daquela oportunidade são cancelados na mesma transação que registra
 * a resposta. Sem isso o cliente recebe cobrança depois de já ter respondido — o
 * defeito mais visível que uma régua pode ter.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CORRETORA_ALFA, consultar, encerrarConexao } from '../apoio/ambiente';

let contador = 0;
const SEMENTE = Math.floor(Math.random() * 1_000_000);
let oportunidade: string;

function telefone(): string {
  contador += 1;
  return `+5511${String(900_000_000 + SEMENTE * 100 + contador)}`;
}

async function novaOportunidade(): Promise<string> {
  const [contato] = await consultar<{ id: string }>(
    `select id from public.localizar_ou_criar_contato($1, 'Cliente da Régua', null, $2)`,
    [CORRETORA_ALFA, telefone()],
  );
  const [aberta] = await consultar<{ id: string }>(
    `select id from public.abrir_oportunidade($1, $2, null, 'LANDING_PAGE')`,
    [CORRETORA_ALFA, contato?.id],
  );
  return aberta?.id ?? '';
}

async function agendar(tipo: string, quando: string): Promise<string | null> {
  const [linha] = await consultar<{ id: string; status: string }>(
    `select * from public.agendar_passo($1, $2, now() + $3::interval, $4)`,
    [oportunidade, tipo, quando, `TESTE:${oportunidade}:${tipo}`],
  );
  return linha?.id ?? null;
}

async function statusDos(): Promise<string[]> {
  const linhas = await consultar<{ status: string }>(
    'select status from public.agendamento where oportunidade_id = $1 order by tipo',
    [oportunidade],
  );
  return linhas.map((l) => l.status);
}

beforeEach(async () => {
  oportunidade = await novaOportunidade();
});

afterAll(encerrarConexao);

describe('agendar_passo', () => {
  it('cria o agendamento pendente', async () => {
    await agendar('INATIVIDADE_1', '30 minutes');
    expect(await statusDos()).toEqual(['PENDENTE']);
  });

  it('o mesmo passo não é agendado duas vezes', async () => {
    // O worker reexecuta, então isso acontece de verdade.
    const primeiro = await agendar('INATIVIDADE_1', '30 minutes');
    const segundo = await agendar('INATIVIDADE_1', '30 minutes');

    expect(segundo).toBe(primeiro);
    expect(await statusDos()).toHaveLength(1);
  });

  it('recusa agendar para oportunidade que não existe', async () => {
    await expect(
      consultar(
        `select public.agendar_passo('00000000-0000-4000-8000-999999999999', 'X', now(), 'k')`,
      ),
    ).rejects.toThrow(/não encontrada/);
  });
});

describe('o cliente responde', () => {
  it('cancela toda a régua pendente', async () => {
    await agendar('INATIVIDADE_1', '30 minutes');
    await agendar('INATIVIDADE_2', '2 hours');

    const [resultado] = await consultar<{ registrar_resposta_do_cliente: number }>(
      'select public.registrar_resposta_do_cliente($1)',
      [oportunidade],
    );

    expect(resultado?.registrar_resposta_do_cliente).toBe(2);
    expect(await statusDos()).toEqual(['CANCELADO', 'CANCELADO']);
  });

  it('marca quando o cliente falou, que é o que abre a janela de 24 h', async () => {
    await consultar('select public.registrar_resposta_do_cliente($1)', [oportunidade]);

    const [linha] = await consultar<{ ultima_mensagem_cliente_em: string | null }>(
      'select ultima_mensagem_cliente_em from public.oportunidade where id = $1',
      [oportunidade],
    );
    expect(linha?.ultima_mensagem_cliente_em).not.toBeNull();
  });

  it('registra a resposta na linha do tempo', async () => {
    await consultar('select public.registrar_resposta_do_cliente($1)', [oportunidade]);

    const eventos = await consultar(
      `select tipo from public.oportunidade_evento
       where oportunidade_id = $1 and tipo = 'RESPOSTA_DO_CLIENTE'`,
      [oportunidade],
    );
    expect(eventos).toHaveLength(1);
  });

  it('não mexe em agendamento já executado', async () => {
    await agendar('INATIVIDADE_1', '30 minutes');
    await consultar(
      `update public.agendamento set status = 'EXECUTADO' where oportunidade_id = $1`,
      [oportunidade],
    );

    await consultar('select public.registrar_resposta_do_cliente($1)', [oportunidade]);

    expect(await statusDos()).toEqual(['EXECUTADO']);
  });

  it('responder sem régua pendente não é erro', async () => {
    const [resultado] = await consultar<{ registrar_resposta_do_cliente: number }>(
      'select public.registrar_resposta_do_cliente($1)',
      [oportunidade],
    );
    expect(resultado?.registrar_resposta_do_cliente).toBe(0);
  });
});

describe('reserva pelo worker', () => {
  it('reserva apenas o que já venceu', async () => {
    await agendar('VENCIDO', '-10 minutes');
    await agendar('FUTURO', '2 hours');

    const reservados = await consultar<{ tipo: string }>(
      'select tipo from public.reservar_agendamentos(50)',
    );

    expect(reservados.map((r) => r.tipo)).toContain('VENCIDO');
    expect(reservados.map((r) => r.tipo)).not.toContain('FUTURO');
  });

  it('conta a tentativa ao reservar', async () => {
    // É o contador que permite desistir de um passo que falha sempre.
    await agendar('VENCIDO_2', '-10 minutes');
    await consultar('select * from public.reservar_agendamentos(50)');

    const [linha] = await consultar<{ tentativas: number }>(
      `select tentativas from public.agendamento
       where oportunidade_id = $1 and tipo = 'VENCIDO_2'`,
      [oportunidade],
    );
    expect(linha?.tentativas).toBe(1);
  });
});
