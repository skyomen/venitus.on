/**
 * O que o consultor muda enquanto atende.
 *
 * Nenhuma tabela de domínio aceita `update` de `authenticated`: toda escrita
 * passa por função `security definer` que confere o dono por `auth.uid()`. É
 * essa conferência que este arquivo cobra — inclusive pelo caminho torto, com
 * um id de outra corretora colado na requisição.
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

let contador = 0;
const SEMENTE = Math.floor(Math.random() * 1_000_000);

function telefone(): string {
  contador += 1;
  return `+5511${String(400_000_000 + SEMENTE * 100 + contador)}`;
}

async function idDoUsuario(email: string): Promise<string> {
  const [linha] = await consultar<{ id: string }>(
    'select id from public.usuario where email = $1',
    [email],
  );
  return linha?.id ?? '';
}

interface Cenario {
  readonly corretora?: string;
  readonly consultor?: string | null;
}

interface Atendimento {
  readonly oportunidade: string;
  readonly pendencia: string;
  readonly opcao: string;
}

/** As duas opções que a seguradora retornou, para o consultor comparar. */
async function darOpcoes(corretora: string, oportunidade: string): Promise<string> {
  const [cotacao] = await consultar<{ id: string }>(
    `insert into public.cotacao (corretora_id, oportunidade_id, seguradora_id, status)
     select $1, $2, id, 'RETORNADA' from public.seguradora limit 1
     returning id`,
    [corretora, oportunidade],
  );
  const [opcao] = await consultar<{ id: string }>(
    `insert into public.cotacao_opcao (corretora_id, cotacao_id, nome_plano, premio, franquia)
     values ($1, $2, 'Compreensiva', 2400.00, 3500.00),
            ($1, $2, 'Essencial', 1800.00, 4200.00)
     returning id`,
    [corretora, cotacao?.id],
  );

  return opcao?.id ?? '';
}

async function mover(oportunidade: string, etapas: readonly string[]): Promise<void> {
  for (const etapa of etapas) {
    await consultar(
      `select public.mover_oportunidade($1, $2::public.etapa_oportunidade, 'TESTE')`,
      [oportunidade, etapa],
    );
  }
}

async function atribuir(oportunidade: string, consultor: string): Promise<void> {
  await consultar(
    `update public.oportunidade set consultor_id = $2, atribuido_em = now() where id = $1`,
    [oportunidade, await idDoUsuario(consultor)],
  );
  await mover(oportunidade, ['ATRIBUIDO']);
}

/** Uma oportunidade em atendimento, com pendência aberta e duas opções de plano. */
async function emAtendimento(cenario: Cenario = {}): Promise<Atendimento> {
  const { corretora = CORRETORA_ALFA, consultor = USUARIOS.consultorAlfa } = cenario;

  const [contato] = await consultar<{ id: string }>(
    `select id from public.localizar_ou_criar_contato($1, 'Cliente do Atendimento', null, $2)`,
    [corretora, telefone()],
  );
  const [aberta] = await consultar<{ id: string }>(
    `select id from public.abrir_oportunidade($1, $2, null, 'LANDING_PAGE')`,
    [corretora, contato?.id],
  );
  const oportunidade = aberta?.id ?? '';

  // O caminho é o que a máquina de estados permite (§8.2).
  await mover(oportunidade, ['EM_VALIDACAO', 'QUALIFICADO', 'EM_COTACAO']);
  const opcao = await darOpcoes(corretora, oportunidade);
  await mover(oportunidade, ['COTADO', 'NA_FILA']);

  if (consultor !== null) {
    await atribuir(oportunidade, consultor);
  }

  const [pendencia] = await consultar<{ id: string }>(
    `insert into public.pendencia (corretora_id, oportunidade_id, tipo, descricao, prazo)
     values ($1, $2, 'DOCUMENTO', 'Enviar CNH', now() + interval '2 days')
     returning id`,
    [corretora, oportunidade],
  );

  return { oportunidade, pendencia: pendencia?.id ?? '', opcao };
}

beforeEach(async () => {
  await consultar(
    `select public.mover_oportunidade(o.id, 'PERDIDA', 'TESTE', 'limpeza de teste')
     from public.oportunidade o
     where o.corretora_id in ($1, $2) and not public.etapa_e_terminal(o.etapa)`,
    [CORRETORA_ALFA, CORRETORA_BETA],
  );
});

afterAll(encerrarConexao);

describe('resolver pendência', () => {
  it('o consultor resolve a pendência do próprio atendimento', async () => {
    const { pendencia } = await emAtendimento();

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      'resolver_pendencia',
      { p_pendencia: pendencia },
    );

    expect(resposta.status).toBe(200);
    expect(resposta.linhas[0]?.['status']).toBe('RESOLVIDA');
    expect(resposta.linhas[0]?.['resolvida_em']).not.toBeNull();
  });

  it('a resolução entra na linha do tempo', async () => {
    // É o que impede o consultor de repetir o que já foi feito.
    const { oportunidade, pendencia } = await emAtendimento();
    await chamarComoUsuario(await entrar(USUARIOS.consultorAlfa), 'resolver_pendencia', {
      p_pendencia: pendencia,
    });

    const eventos = await consultar(
      `select tipo from public.oportunidade_evento
       where oportunidade_id = $1 and tipo = 'PENDENCIA_RESOLVIDA'`,
      [oportunidade],
    );
    expect(eventos).toHaveLength(1);
  });

  it('resolver duas vezes não gera dois eventos', async () => {
    // O consultor toca duas vezes no botão do celular com frequência.
    const { oportunidade, pendencia } = await emAtendimento();
    const token = await entrar(USUARIOS.consultorAlfa);

    await chamarComoUsuario(token, 'resolver_pendencia', { p_pendencia: pendencia });
    const segunda = await chamarComoUsuario(token, 'resolver_pendencia', {
      p_pendencia: pendencia,
    });

    expect(segunda.status).toBe(200);
    const eventos = await consultar(
      `select id from public.oportunidade_evento
       where oportunidade_id = $1 and tipo = 'PENDENCIA_RESOLVIDA'`,
      [oportunidade],
    );
    expect(eventos).toHaveLength(1);
  });

  it('o gestor da corretora também resolve', async () => {
    const { pendencia } = await emAtendimento();

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.gestorAlfa),
      'resolver_pendencia',
      { p_pendencia: pendencia },
    );

    expect(resposta.status).toBe(200);
  });

  it('consultor de outra corretora não resolve, mesmo com o id na mão', async () => {
    const { pendencia } = await emAtendimento();

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorBeta),
      'resolver_pendencia',
      { p_pendencia: pendencia },
    );

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });

  it('consultor da mesma corretora não mexe no atendimento de outro', async () => {
    // A oportunidade ficou sem dono: nenhum consultor é responsável por ela.
    const { pendencia } = await emAtendimento({ consultor: null });

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      'resolver_pendencia',
      { p_pendencia: pendencia },
    );

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });

  it('pendência que não existe é erro, não silêncio', async () => {
    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      'resolver_pendencia',
      { p_pendencia: '00000000-0000-4000-8000-999999999999' },
    );

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });
});

describe('plano de interesse', () => {
  it('grava a opção que o cliente escolheu', async () => {
    const { oportunidade, opcao } = await emAtendimento();

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      'marcar_plano_de_interesse',
      { p_oportunidade: oportunidade, p_opcao: opcao },
    );

    expect(resposta.status).toBe(200);
    expect(resposta.linhas[0]?.['opcao_interesse_id']).toBe(opcao);
  });

  it('nulo limpa a escolha: o cliente muda de ideia', async () => {
    const { oportunidade, opcao } = await emAtendimento();
    const token = await entrar(USUARIOS.consultorAlfa);

    await chamarComoUsuario(token, 'marcar_plano_de_interesse', {
      p_oportunidade: oportunidade,
      p_opcao: opcao,
    });
    const limpou = await chamarComoUsuario(token, 'marcar_plano_de_interesse', {
      p_oportunidade: oportunidade,
      p_opcao: null,
    });

    expect(limpou.linhas[0]?.['opcao_interesse_id']).toBeNull();
  });

  it('opção de outra oportunidade é recusada', async () => {
    // Sem essa checagem, um id colado na requisição gravaria um plano que o
    // cliente nunca viu — e a RLS não pegaria, porque quem grava é a função.
    const alvo = await emAtendimento();
    const outra = await emAtendimento();

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      'marcar_plano_de_interesse',
      { p_oportunidade: alvo.oportunidade, p_opcao: outra.opcao },
    );

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });

  it('consultor de outra corretora não escolhe por ninguém', async () => {
    const { oportunidade, opcao } = await emAtendimento();

    const resposta = await chamarComoUsuario(
      await entrar(USUARIOS.consultorBeta),
      'marcar_plano_de_interesse',
      { p_oportunidade: oportunidade, p_opcao: opcao },
    );

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });

  it('quem não entrou não escolhe nada', async () => {
    const { oportunidade, opcao } = await emAtendimento();

    const resposta = await chamarComoUsuario(null, 'marcar_plano_de_interesse', {
      p_oportunidade: oportunidade,
      p_opcao: opcao,
    });

    expect(resposta.status).toBeGreaterThanOrEqual(400);
  });

  it('a escolha entra na linha do tempo', async () => {
    const { oportunidade, opcao } = await emAtendimento();
    await chamarComoUsuario(await entrar(USUARIOS.consultorAlfa), 'marcar_plano_de_interesse', {
      p_oportunidade: oportunidade,
      p_opcao: opcao,
    });

    const eventos = await consultar(
      `select tipo from public.oportunidade_evento
       where oportunidade_id = $1 and tipo = 'PLANO_DE_INTERESSE'`,
      [oportunidade],
    );
    expect(eventos).toHaveLength(1);
  });
});

describe('a consulta do atendimento', () => {
  const SELECAO = [
    'id',
    'etapa',
    'opcao_interesse_id',
    'contato(nome)',
    'qualificacao(intencao,completude,preocupacao_principal)',
    'risco_veiculo(marca,modelo,ano_modelo)',
    'cotacao(status,seguradora(nome),cotacao_opcao(id,nome_plano,premio,franquia))',
    'pendencia(id,tipo,descricao,prazo,status)',
    'oportunidade_evento(id,tipo,de_etapa,para_etapa,ator,motivo,ocorrido_em)',
  ].join(',');

  it('traz as cinco relações de uma vez', async () => {
    const { oportunidade } = await emAtendimento();

    const resposta = await lerComoUsuario(
      await entrar(USUARIOS.consultorAlfa),
      `oportunidade?id=eq.${oportunidade}&select=${SELECAO}`,
    );

    expect(resposta.status).toBe(200);
    const linha = resposta.linhas[0];
    expect((linha?.['contato'] as { nome?: string })?.nome).toBe('Cliente do Atendimento');
    expect(linha?.['pendencia']).toHaveLength(1);
    expect(linha?.['oportunidade_evento']).not.toHaveLength(0);

    const cotacoes = linha?.['cotacao'] as { cotacao_opcao?: unknown[] }[];
    expect(cotacoes[0]?.cotacao_opcao).toHaveLength(2);
  });

  it('o atendimento de outra corretora não é encontrado', async () => {
    // 404 e não "sem permissão": dizer que ela existe já é dizer algo.
    const { oportunidade } = await emAtendimento();

    const resposta = await lerComoUsuario(
      await entrar(USUARIOS.consultorBeta),
      `oportunidade?id=eq.${oportunidade}&select=${SELECAO}`,
    );

    expect(resposta.linhas).toHaveLength(0);
  });

  it('o plano escolhido acompanha a oportunidade na lista', async () => {
    const { oportunidade, opcao } = await emAtendimento();
    const token = await entrar(USUARIOS.consultorAlfa);
    await chamarComoUsuario(token, 'marcar_plano_de_interesse', {
      p_oportunidade: oportunidade,
      p_opcao: opcao,
    });

    // A relação direta é `opcao_interesse_id → cotacao_opcao`, e é ela que a
    // lista de atendimentos usa para mostrar o plano no cartão.
    const resposta = await lerComoUsuario(
      token,
      `oportunidade?id=eq.${oportunidade}&select=id,cotacao_opcao(nome_plano)`,
    );

    expect((resposta.linhas[0]?.['cotacao_opcao'] as { nome_plano?: string })?.nome_plano).toBe(
      'Compreensiva',
    );
  });
});
