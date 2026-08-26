/**
 * A fila como o consultor a alcança (blueprint §9.4 e §9.5).
 *
 * `distribuir_proxima(uuid)` recebe o consultor por parâmetro e só é alcançável
 * por `service_role`. A porta que a tela usa é outra: `assumir_proxima_da_fila()`
 * não recebe nada e resolve a identidade por `auth.uid()`. Este arquivo cobra
 * as duas coisas — que a porta funcione, e que ela não deixe ninguém assumir
 * trabalho no lugar de outra pessoa.
 *
 * A consulta da tela também é exercitada aqui, com o mesmo `select` que
 * `dados/consultas/fila.ts` monta: é o que prova que os relacionamentos
 * aninhados e os filtros existem de verdade no PostgREST.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CORRETORA_ALFA,
  CORRETORA_BETA,
  USUARIOS,
  chamarComoUsuario,
  consultar,
  encerrarConexao,
  entrar,
  lerComoUsuario,
} from '../apoio/ambiente';

/** O mesmo recorte de `dados/consultas/fila.ts`, sem espaço em branco. */
const SELECAO = [
  'id',
  'entrou_na_fila_em',
  'contato(nome)',
  'qualificacao(intencao,completude,preocupacao_principal)',
  'risco_veiculo(marca,modelo,ano_modelo)',
  'cotacao(status)',
  'pendencia(descricao,prazo)',
].join(',');

const CAMINHO_DA_FILA =
  `oportunidade?select=${SELECAO}` +
  '&etapa=eq.NA_FILA&consultor_id=is.null&pendencia.status=eq.ABERTA' +
  '&order=prioridade.desc,entrou_na_fila_em.asc';

let contador = 0;
const SEMENTE = Math.floor(Math.random() * 1_000_000);

function telefone(): string {
  contador += 1;
  return `+5511${String(600_000_000 + SEMENTE * 100 + contador)}`;
}

interface Cenario {
  readonly corretora?: string;
  readonly prioridade?: number;
  readonly nome?: string;
  readonly comContexto?: boolean;
}

/** O contexto de §9.5: temperatura, veículo e a pendência que o consultor cita. */
async function darContexto(corretora: string, oportunidade: string): Promise<void> {
  await consultar(
    // `abrir_oportunidade` já cria a qualificação inicial; aqui ela é
    // atualizada para o cenário quente e completo.
    `update public.qualificacao
        set intencao = 'QUENTE', completude = 'COMPLETO', preocupacao_principal = 'ROUBO_FURTO'
      where oportunidade_id = $1`,
    [oportunidade],
  );
  await consultar(
    `insert into public.risco_veiculo (corretora_id, oportunidade_id, marca, modelo, ano_modelo)
     values ($1, $2, 'Chevrolet', 'Tracker Premier', 2024)`,
    [corretora, oportunidade],
  );
  await consultar(
    `insert into public.pendencia (corretora_id, oportunidade_id, tipo, descricao, prazo)
     values ($1, $2, 'DADO_CADASTRAL', 'Confirmar CEP', now() + interval '1 day')`,
    [corretora, oportunidade],
  );
}

async function mover(oportunidade: string, etapas: readonly string[]): Promise<void> {
  for (const etapa of etapas) {
    await consultar(
      `select public.mover_oportunidade($1, $2::public.etapa_oportunidade, 'TESTE')`,
      [oportunidade, etapa],
    );
  }
}

/** Uma oportunidade parada na fila, pelo caminho que a máquina de estados exige. */
async function naFila(cenario: Cenario = {}): Promise<string> {
  const { corretora = CORRETORA_ALFA, prioridade = 0, nome = 'Cliente da Tela' } = cenario;

  const [contato] = await consultar<{ id: string }>(
    `select id from public.localizar_ou_criar_contato($1, $2, null, $3)`,
    [corretora, nome, telefone()],
  );
  const [aberta] = await consultar<{ id: string }>(
    `select id from public.abrir_oportunidade($1, $2, null, 'LANDING_PAGE')`,
    [corretora, contato?.id],
  );
  const id = aberta?.id ?? '';

  // `COTADO` exige cotação retornada, e a fila humana só recebe quem já foi
  // cotado (§8.2): o caminho passa por cada etapa em vez de saltar para o fim.
  await mover(id, ['EM_VALIDACAO', 'QUALIFICADO', 'EM_COTACAO']);
  await consultar(
    `insert into public.cotacao (corretora_id, oportunidade_id, seguradora_id, status)
     select $1, $2, id, 'RETORNADA' from public.seguradora limit 1`,
    [corretora, id],
  );
  await mover(id, ['COTADO', 'NA_FILA']);

  await consultar('update public.oportunidade set prioridade = $2 where id = $1', [id, prioridade]);

  if (cenario.comContexto === true) {
    await darContexto(corretora, id);
  }

  return id;
}

/**
 * Zera a fila e a carga dos dois consultores.
 *
 * Pela função de transição, não por `update`: o gatilho recusa mudança de etapa
 * por qualquer outro caminho, inclusive vinda de teste.
 */
beforeEach(async () => {
  await consultar(
    `select public.mover_oportunidade(o.id, 'PERDIDA', 'TESTE', 'limpeza de teste')
     from public.oportunidade o
     where o.corretora_id in ($1, $2)
       and not public.etapa_e_terminal(o.etapa)`,
    [CORRETORA_ALFA, CORRETORA_BETA],
  );
});

afterAll(encerrarConexao);

describe('a porta que a tela usa', () => {
  it('entrega a próxima ao consultor que pediu', async () => {
    const oportunidade = await naFila();
    const token = await entrar(USUARIOS.consultorAlfa);

    const resposta = await chamarComoUsuario(token, 'assumir_proxima_da_fila');

    expect(resposta.status).toBe(200);
    expect(resposta.linhas[0]?.['id']).toBe(oportunidade);
  });

  it('a atribuição inicia o SLA e silencia a automação', async () => {
    await naFila();
    await chamarComoUsuario(await entrar(USUARIOS.consultorAlfa), 'assumir_proxima_da_fila');

    const [linha] = await consultar<{
      etapa: string;
      dono_conversa: string;
      atribuido_em: string | null;
      consultor_id: string | null;
    }>(
      `select o.etapa, o.dono_conversa, o.atribuido_em, o.consultor_id
       from public.oportunidade o
       join public.usuario u on u.id = o.consultor_id
       where u.email = $1 and o.etapa = 'ATRIBUIDO'`,
      [USUARIOS.consultorAlfa],
    );

    expect(linha?.dono_conversa).toBe('CONSULTOR');
    expect(linha?.atribuido_em).not.toBeNull();
  });

  it('a ordem da fila é respeitada, não a de chegada do pedido', async () => {
    await naFila({ prioridade: 5, nome: 'Cliente Frio' });
    const quente = await naFila({ prioridade: 50, nome: 'Cliente Quente' });

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      'assumir_proxima_da_fila',
    );

    expect(resposta.linhas[0]?.['id']).toBe(quente);
  });

  it('consultor de outra corretora não alcança esta fila', async () => {
    await naFila({ corretora: CORRETORA_ALFA });

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorBeta),
      'assumir_proxima_da_fila',
    );

    // Composto nulo: o PostgREST devolve um objeto de campos nulos, não `null`.
    expect(resposta.linhas[0]?.['id'] ?? null).toBeNull();
  });

  it('gestor não recebe da fila do consultor', async () => {
    await naFila();

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.gestorAlfa),
      'assumir_proxima_da_fila',
    );

    expect(resposta.linhas[0]?.['id'] ?? null).toBeNull();
  });

  it('fila vazia não é erro', async () => {
    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      'assumir_proxima_da_fila',
    );

    expect(resposta.status).toBe(200);
    expect(resposta.linhas[0]?.['id'] ?? null).toBeNull();
  });

  it('quem não entrou não assume nada', async () => {
    await naFila();
    const resposta = await chamarComoUsuario(null, 'assumir_proxima_da_fila');

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });

  it('a porta com parâmetro continua fechada para quem entrou', async () => {
    // Liberá-la deixaria um consultor distribuir trabalho para outra pessoa.
    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      'distribuir_proxima',
      { p_consultor: '00000000-0000-4000-8000-0000000000f5' },
    );

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });
});

describe('a consulta que a tela monta', () => {
  it('traz o contexto de §9.5 junto com a oportunidade', async () => {
    await naFila({ comContexto: true, nome: 'Marina Sintética' });

    const resposta = await lerComoUsuario(await entrar(USUARIOS.consultorAlfa), CAMINHO_DA_FILA);

    expect(resposta.status).toBe(200);
    const linha = resposta.linhas[0];
    expect((linha?.['contato'] as { nome?: string } | null)?.nome).toBe('Marina Sintética');
    expect((linha?.['qualificacao'] as { intencao?: string } | null)?.intencao).toBe('QUENTE');
    expect((linha?.['risco_veiculo'] as { modelo?: string } | null)?.modelo).toBe(
      'Tracker Premier',
    );
    expect(linha?.['pendencia']).toHaveLength(1);
  });

  it('a fila de uma corretora não aparece na outra', async () => {
    await naFila({ corretora: CORRETORA_BETA, nome: 'Cliente da Beta' });

    const daAlfa = await lerComoUsuario(await entrar(USUARIOS.consultorAlfa), CAMINHO_DA_FILA);
    const daBeta = await lerComoUsuario(await entrar(USUARIOS.consultorBeta), CAMINHO_DA_FILA);

    expect(daAlfa.linhas).toHaveLength(0);
    expect(daBeta.linhas).toHaveLength(1);
  });

  it('quem já foi atribuído sai da fila', async () => {
    await naFila();
    const token = await entrar(USUARIOS.consultorAlfa);
    await chamarComoUsuario(token, 'assumir_proxima_da_fila');

    expect((await lerComoUsuario(token, CAMINHO_DA_FILA)).linhas).toHaveLength(0);
  });

  it('pendência resolvida não aparece no cartão', async () => {
    // O filtro é sobre a relação aninhada; sem ele o consultor cobraria algo
    // que o cliente já resolveu.
    const oportunidade = await naFila({ comContexto: true });
    await consultar(
      `update public.pendencia set status = 'RESOLVIDA', resolvida_em = now()
       where oportunidade_id = $1`,
      [oportunidade],
    );

    const resposta = await lerComoUsuario(await entrar(USUARIOS.consultorAlfa), CAMINHO_DA_FILA);

    expect(resposta.linhas[0]?.['pendencia']).toHaveLength(0);
  });
});
