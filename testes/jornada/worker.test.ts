/**
 * O worker inteiro, contra o Postgres real.
 *
 * Os testes de unidade provam cada decisão isolada; este prova o caminho que a
 * operação percorre: um passo vencido é reservado, o portão decide, a mensagem
 * sai pelo conector, a régua avança no banco e o cliente que responde cancela o
 * que sobrou.
 *
 * É aqui que os adaptadores são verificados — `repositorio.ts` e
 * `conectores.ts` estão fora da cobertura de unidade justamente porque só
 * teriam valor exercitados contra o banco de verdade.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarClienteAdmin } from '@/dados/cliente-admin';
import { criarCrmStub } from '@/conectores/crm/stub';
import { criarWhatsappQueEntrega, criarWhatsappStub } from '@/conectores/whatsapp/stub';
import type { CanalWhatsapp } from '@/conectores/whatsapp/contrato';
import { drenar } from '@/worker/drenar';
import type { Balanco } from '@/worker/drenar';
import { criarEspelho, criarMensageiro } from '@/worker/supabase/conectores';
import { criarRepositorio } from '@/worker/supabase/repositorio';
import { consultar, encerrarConexao } from '../apoio/ambiente';

/**
 * Corretoras próprias, criadas por este arquivo.
 *
 * As do seed atendem das 8 às 18, e o teste precisa rodar a qualquer hora: a
 * aberta tem janela o dia inteiro, e a fechada não tem nenhuma — é assim que se
 * exercita `FORA_DO_HORARIO` sem depender do relógio de quem roda.
 */
const ABERTA = '00000000-0000-4000-8000-00000000000c';
const FECHADA = '00000000-0000-4000-8000-00000000000d';

let contador = 0;
const SEMENTE = Math.floor(Math.random() * 1_000_000);

/** Identificador único por execução: sem isso o teste acha o dado da rodada anterior. */
function telefone(): string {
  contador += 1;
  return `+5511${String(700_000_000 + SEMENTE * 100 + contador)}`;
}

function tique(canal: CanalWhatsapp = criarWhatsappQueEntrega()): Promise<Balanco> {
  return drenar({
    repositorio: criarRepositorio(criarClienteAdmin()),
    mensageiro: criarMensageiro(canal),
    espelho: criarEspelho(criarCrmStub()),
    relogio: { agora: () => new Date() },
  });
}

interface Cenario {
  readonly corretora?: string;
  readonly consentimento?: boolean;
  /** Abre a janela de 24 h, marcando que o cliente falou agora. */
  readonly clienteFalou?: boolean;
}

async function novaOportunidade(cenario: Cenario = {}): Promise<string> {
  const corretora = cenario.corretora ?? ABERTA;

  const [contato] = await consultar<{ id: string }>(
    `select id from public.localizar_ou_criar_contato($1, 'Cliente Sintético do Worker', null, $2)`,
    [corretora, telefone()],
  );

  if (cenario.consentimento !== false) {
    await consultar(
      `update public.contato set consentimento_em = now(), consentimento_origem = 'TESTE'
       where id = $1`,
      [contato?.id],
    );
  }

  const [aberta] = await consultar<{ id: string }>(
    `select id from public.abrir_oportunidade($1, $2, null, 'LANDING_PAGE')`,
    [corretora, contato?.id],
  );
  const oportunidade = aberta?.id ?? '';

  if (cenario.clienteFalou === true) {
    // Cancela a régua pendente junto, então vem antes de qualquer agendamento.
    await consultar('select public.registrar_resposta_do_cliente($1)', [oportunidade]);
  }

  return oportunidade;
}

async function agendar(oportunidade: string, tipo: string, regua: string, quando = '-1 minute') {
  await consultar(`select public.agendar_passo($1, $2, now() + $3::interval, $4, $5::jsonb)`, [
    oportunidade,
    tipo,
    quando,
    `${regua}:${oportunidade}:${tipo}`,
    JSON.stringify({ regua }),
  ]);
}

interface LinhaAgendamento extends Record<string, unknown> {
  tipo: string;
  status: string;
  motivo: string | null;
  vencido: boolean;
}

async function agendamentosDe(oportunidade: string): Promise<LinhaAgendamento[]> {
  return consultar<LinhaAgendamento>(
    `select tipo, status, motivo, executar_em <= now() as vencido
     from public.agendamento where oportunidade_id = $1 order by tipo`,
    [oportunidade],
  );
}

async function etapaDe(oportunidade: string) {
  const [linha] = await consultar<{ etapa: string; motivo_encerramento: string | null }>(
    'select etapa, motivo_encerramento from public.oportunidade where id = $1',
    [oportunidade],
  );
  return linha;
}

/**
 * A reserva é global por natureza — é uma fila só, para todos os tenants.
 * Cancelar o que os outros arquivos deixaram para trás mantém cada asserção
 * falando apenas do que este arquivo criou.
 */
async function limparFilaAlheia(): Promise<void> {
  await consultar(
    `update public.agendamento set status = 'CANCELADO', motivo = 'limpeza de teste'
      where status = 'PENDENTE'
        and corretora_id not in ($1, $2)`,
    [ABERTA, FECHADA],
  );
  await consultar(
    `update public.integracao_outbox set status = 'ENTREGUE', entregue_em = now()
      where status in ('PENDENTE', 'FALHOU')
        and corretora_id not in ($1, $2)`,
    [ABERTA, FECHADA],
  );
}

beforeAll(async () => {
  await consultar(
    `insert into public.corretora (id, nome, documento, plano_id, fuso_horario)
     select $1, 'Corretora do Worker', '99888777000155', p.id, 'America/Sao_Paulo'
     from public.plano p limit 1
     on conflict (id) do nothing`,
    [ABERTA],
  );
  await consultar(
    `insert into public.corretora (id, nome, documento, plano_id, fuso_horario)
     select $1, 'Corretora Fechada', '99888777000156', p.id, 'America/Sao_Paulo'
     from public.plano p limit 1
     on conflict (id) do nothing`,
    [FECHADA],
  );

  // Janela o dia inteiro, todos os dias: o teste roda a qualquer hora.
  await consultar(
    `insert into public.horario_atendimento (corretora_id, dia_semana, inicio, fim)
     select $1, d, time '00:00', time '23:59' from generate_series(0, 6) as d
     on conflict do nothing`,
    [ABERTA],
  );

  // A régua de abertura é toda de template. Dois aprovados para ela andar, e um
  // cadastrado sem aprovação — que é o caso real de §11.4, e não "template que
  // ninguém cadastrou".
  await consultar(
    `insert into public.template_mensagem (corretora_id, codigo, canal, corpo, aprovado_em)
     values ($1, '01_primeiro_contato', 'WHATSAPP', 'Olá, {{1}}!', now()),
            ($1, '05_primeiro_contato', 'WHATSAPP', 'Olá, {{1}}! Última tentativa.', now()),
            ($1, '03_primeiro_contato', 'WHATSAPP', 'Olá, {{1}}!', null)
     on conflict (corretora_id, codigo) do nothing`,
    [ABERTA],
  );
});

afterAll(encerrarConexao);

describe('contexto_do_disparo', () => {
  it('reúne o que o portão de envio precisa, numa consulta só', async () => {
    const oportunidade = await novaOportunidade({ clienteFalou: true });

    const [linha] = await consultar<{ contexto_do_disparo: Record<string, unknown> }>(
      'select public.contexto_do_disparo($1) as contexto_do_disparo',
      [oportunidade],
    );
    const contexto = linha?.contexto_do_disparo ?? {};

    expect(contexto['dono_conversa']).toBe('AUTOMACAO');
    expect(contexto['consentimento']).toBe(true);
    expect(contexto['etapa']).toBe('NOVO');
    expect(contexto['ultima_mensagem_cliente_em']).not.toBeNull();
    expect(contexto['janelas_do_dia']).toEqual([[0, 1439]]);
    expect(contexto['primeiro_nome']).toBe('Cliente');
  });

  it('a corretora sem horário cadastrado não tem janela nenhuma', async () => {
    const oportunidade = await novaOportunidade({ corretora: FECHADA });

    const [linha] = await consultar<{ contexto_do_disparo: Record<string, unknown> }>(
      'select public.contexto_do_disparo($1) as contexto_do_disparo',
      [oportunidade],
    );

    expect(linha?.contexto_do_disparo['janelas_do_dia']).toEqual([]);
  });

  it('oportunidade que não existe devolve nada', async () => {
    const [linha] = await consultar<{ contexto_do_disparo: unknown }>(
      `select public.contexto_do_disparo('00000000-0000-4000-8000-999999999999')
         as contexto_do_disparo`,
    );
    expect(linha?.contexto_do_disparo).toBeNull();
  });

  it('a pendência aberta mais urgente entra no contexto', async () => {
    const oportunidade = await novaOportunidade();
    await consultar(
      `insert into public.pendencia (corretora_id, oportunidade_id, tipo, descricao, prazo)
       values ($1, $2, 'DOCUMENTO', 'CNH do condutor', now() + interval '1 day'),
              ($1, $2, 'PAGAMENTO', 'boleto em aberto', null)`,
      [ABERTA, oportunidade],
    );

    const [linha] = await consultar<{ contexto_do_disparo: Record<string, unknown> }>(
      'select public.contexto_do_disparo($1) as contexto_do_disparo',
      [oportunidade],
    );

    // Quem tem data marcada aperta mais que quem não tem.
    expect(linha?.contexto_do_disparo['pendencia']).toEqual({
      tipo: 'DOCUMENTO',
      descricao: 'CNH do condutor',
    });
  });
});

describe('a régua anda', () => {
  it('dispara o passo vencido e agenda o próximo', async () => {
    const oportunidade = await novaOportunidade({ clienteFalou: true });
    await agendar(oportunidade, 'INATIVIDADE_1', 'INATIVIDADE');
    await limparFilaAlheia();

    const balanco = await tique();
    expect(balanco.falhas).toBe(0);

    expect(await agendamentosDe(oportunidade)).toEqual([
      { tipo: 'INATIVIDADE_1', status: 'EXECUTADO', motivo: null, vencido: true },
      { tipo: 'INATIVIDADE_2', status: 'PENDENTE', motivo: null, vencido: false },
    ]);
  });

  it('o fim da régua encerra a oportunidade com motivo', async () => {
    const oportunidade = await novaOportunidade({ clienteFalou: true });
    await agendar(oportunidade, 'INATIVIDADE_3', 'INATIVIDADE');
    await limparFilaAlheia();

    await tique();

    expect(await etapaDe(oportunidade)).toEqual({
      etapa: 'PERDIDA',
      motivo_encerramento: 'Parou de responder durante o atendimento',
    });
  });

  it('a régua de abertura termina sem contato, não como venda perdida', async () => {
    // Nunca houve conversa: não é uma venda que se perdeu.
    const oportunidade = await novaOportunidade({ clienteFalou: true });
    await agendar(oportunidade, 'ABERTURA_5', 'ABERTURA');
    await limparFilaAlheia();

    await tique();

    expect((await etapaDe(oportunidade))?.etapa).toBe('ENCERRADA_SEM_CONTATO');
  });

  it('responder cancela o que a régua ainda tinha pela frente', async () => {
    // O defeito mais visível que uma régua pode ter é cobrar quem já respondeu.
    const oportunidade = await novaOportunidade({ clienteFalou: true });
    await agendar(oportunidade, 'INATIVIDADE_1', 'INATIVIDADE');
    await limparFilaAlheia();
    await tique();

    await consultar('select public.registrar_resposta_do_cliente($1)', [oportunidade]);

    const depois = await agendamentosDe(oportunidade);
    expect(depois.map((l) => l.status)).toEqual(['EXECUTADO', 'CANCELADO']);

    // E o tique seguinte não ressuscita nada.
    await limparFilaAlheia();
    await tique();
    expect((await agendamentosDe(oportunidade)).map((l) => l.status)).toEqual([
      'EXECUTADO',
      'CANCELADO',
    ]);
  });
});

describe('o portão de envio manda no worker', () => {
  it('o consultor assumiu a conversa: a automação silencia', async () => {
    const oportunidade = await novaOportunidade({ clienteFalou: true });
    await consultar(`update public.oportunidade set dono_conversa = 'CONSULTOR' where id = $1`, [
      oportunidade,
    ]);
    await agendar(oportunidade, 'INATIVIDADE_1', 'INATIVIDADE');
    await limparFilaAlheia();

    await tique();

    expect(await agendamentosDe(oportunidade)).toEqual([
      {
        tipo: 'INATIVIDADE_1',
        status: 'CANCELADO',
        motivo: 'O consultor assumiu a conversa',
        vencido: true,
      },
    ]);
  });

  it('sem consentimento, nada sai', async () => {
    const oportunidade = await novaOportunidade({ consentimento: false, clienteFalou: true });
    await agendar(oportunidade, 'INATIVIDADE_1', 'INATIVIDADE');
    await limparFilaAlheia();

    await tique();

    const [linha] = await agendamentosDe(oportunidade);
    expect(linha?.status).toBe('CANCELADO');
    expect(linha?.motivo).toBe('O cliente pediu para não receber mensagens');
  });

  it('fora do horário da corretora, adia em vez de falhar', async () => {
    // Não é erro: é cedo demais. Volta quando a corretora abrir.
    const oportunidade = await novaOportunidade({ corretora: FECHADA, clienteFalou: true });
    await agendar(oportunidade, 'INATIVIDADE_1', 'INATIVIDADE');
    await limparFilaAlheia();

    await tique();

    expect(await agendamentosDe(oportunidade)).toEqual([
      { tipo: 'INATIVIDADE_1', status: 'PENDENTE', motivo: null, vencido: false },
    ]);
  });

  it('template sem aprovação registrada falha aqui, não na frente do cliente', async () => {
    // O template existe e está ativo; o que falta é a aprovação do provedor.
    // Insistir não a traria, e o disparo cairia com o cliente na frente.
    const oportunidade = await novaOportunidade();
    await agendar(oportunidade, 'ABERTURA_3', 'ABERTURA');
    await limparFilaAlheia();

    await tique();

    const [linha] = await agendamentosDe(oportunidade);
    expect(linha?.status).toBe('FALHOU');
    expect(linha?.motivo).toBe('TEMPLATE_NAO_APROVADO');
  });

  it('com o template aprovado, o disparo fora da janela sai e a régua anda', async () => {
    const oportunidade = await novaOportunidade();
    await agendar(oportunidade, 'ABERTURA_1', 'ABERTURA');
    await limparFilaAlheia();

    await tique();

    expect((await agendamentosDe(oportunidade)).map((l) => [l.tipo, l.status])).toEqual([
      ['ABERTURA_1', 'EXECUTADO'],
      ['ABERTURA_2', 'PENDENTE'],
    ]);
  });

  it('texto livre fora da janela de 24 h é recusado antes de sair', async () => {
    const oportunidade = await novaOportunidade();
    await agendar(oportunidade, 'INATIVIDADE_1', 'INATIVIDADE');
    await limparFilaAlheia();

    await tique();

    const [linha] = await agendamentosDe(oportunidade);
    expect(linha?.status).toBe('FALHOU');
    expect(linha?.motivo).toBe('FORA_DA_JANELA_SEM_TEMPLATE');
  });
});

describe('sem canal real de WhatsApp', () => {
  it('o stub honesto não deixa a régua avançar sobre mensagem que não saiu', async () => {
    const oportunidade = await novaOportunidade({ clienteFalou: true });
    await agendar(oportunidade, 'INATIVIDADE_1', 'INATIVIDADE');
    await limparFilaAlheia();

    await tique(criarWhatsappStub());

    // Fingir entrega faria o cliente pular um passo que nunca recebeu.
    expect(await agendamentosDe(oportunidade)).toEqual([
      {
        tipo: 'INATIVIDADE_1',
        status: 'FALHOU',
        motivo: 'AGUARDANDO_CONECTOR',
        vencido: true,
      },
    ]);
  });
});

describe('o outbox de integração', () => {
  async function outboxDe(oportunidade: string) {
    return consultar<{ destino: string; status: string; ultimo_erro: string | null }>(
      `select destino, status, ultimo_erro from public.integracao_outbox
       where oportunidade_id = $1 order by criado_em`,
      [oportunidade],
    );
  }

  it('o espelhamento para o CRM fica aguardando o conector real', async () => {
    const oportunidade = await novaOportunidade();
    await consultar(`select public.mover_oportunidade($1, 'EM_VALIDACAO')`, [oportunidade]);
    await limparFilaAlheia();

    await tique();

    expect(await outboxDe(oportunidade)).toEqual([
      { destino: 'CRM', status: 'AGUARDANDO_CONECTOR', ultimo_erro: null },
    ]);
  });

  it('destino sem drenador espera o conector, não vira falha', async () => {
    const oportunidade = await novaOportunidade();
    await consultar(
      `insert into public.integracao_outbox
         (corretora_id, oportunidade_id, destino, operacao, payload, chave_idempotencia)
       values ($1, $2, 'SEGURADORA', 'TRANSMITIR_PROPOSTA', '{}'::jsonb, $3)`,
      [ABERTA, oportunidade, `seguradora:${oportunidade}`],
    );
    await limparFilaAlheia();

    await tique();

    expect((await outboxDe(oportunidade))[0]?.status).toBe('AGUARDANDO_CONECTOR');
  });

  it('operação de CRM desconhecida desiste, e diz por quê', async () => {
    const oportunidade = await novaOportunidade();
    await consultar(
      `insert into public.integracao_outbox
         (corretora_id, oportunidade_id, destino, operacao, payload, chave_idempotencia)
       values ($1, $2, 'CRM', 'DELETAR_TUDO', '{}'::jsonb, $3)`,
      [ABERTA, oportunidade, `crm:torto:${oportunidade}`],
    );
    await limparFilaAlheia();

    await tique();

    const [linha] = await outboxDe(oportunidade);
    // `FALHOU` continua elegível à reserva; item que não vale mais tentar
    // precisava de outro nome.
    expect(linha?.status).toBe('DESISTIU');
    expect(linha?.ultimo_erro).toBe('Operação de CRM desconhecida: DELETAR_TUDO');
  });

  it('o que já aguarda conector não volta para a fila no tique seguinte', async () => {
    const oportunidade = await novaOportunidade();
    await consultar(`select public.mover_oportunidade($1, 'EM_VALIDACAO')`, [oportunidade]);
    await limparFilaAlheia();
    await tique();

    const reservados = await consultar<{ id: string }>('select id from public.reservar_outbox(50)');
    const daOportunidade = await outboxDe(oportunidade);

    expect(daOportunidade[0]?.status).toBe('AGUARDANDO_CONECTOR');
    expect(reservados).toHaveLength(0);
  });
});
