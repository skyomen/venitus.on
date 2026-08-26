import { Pool } from 'pg';

/**
 * Cenário de banco para o E2E.
 *
 * O caminho do consultor só existe se houver alguém na fila, e a jornada até
 * `NA_FILA` ainda não é percorrível pela interface — ela entra nas fatias
 * seguintes. Até lá o cenário é montado por SQL, pelas mesmas funções que a
 * aplicação usa: a etapa muda por `mover_oportunidade`, nunca por `update`.
 */

export const CORRETORA_ALFA = '00000000-0000-4000-8000-00000000000a';

let pool: Pool | undefined;

function conexao(): Pool {
  pool ??= new Pool({
    connectionString:
      process.env['SUPABASE_DB_URL'] ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
    max: 2,
  });
  return pool;
}

async function executar(sql: string, valores: readonly unknown[] = []): Promise<void> {
  await conexao().query(sql, valores as unknown[]);
}

async function umId(sql: string, valores: readonly unknown[]): Promise<string> {
  const { rows } = await conexao().query<{ id: string }>(sql, valores as unknown[]);
  return rows[0]?.id ?? '';
}

async function mover(oportunidade: string, etapas: readonly string[]): Promise<void> {
  for (const etapa of etapas) {
    await executar(`select public.mover_oportunidade($1, $2::public.etapa_oportunidade, 'TESTE')`, [
      oportunidade,
      etapa,
    ]);
  }
}

export async function encerrarConexao(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/**
 * Devolve a corretora ao estado vazio.
 *
 * Pela função de transição, não por `update`: o gatilho recusa mudança de etapa
 * por qualquer outro caminho, inclusive vinda de teste.
 */
export async function limparCorretora(): Promise<void> {
  await executar(
    `select public.mover_oportunidade(o.id, 'PERDIDA', 'TESTE', 'limpeza de E2E')
     from public.oportunidade o
     where o.corretora_id = $1 and not public.etapa_e_terminal(o.etapa)`,
    [CORRETORA_ALFA],
  );
}

export interface ClienteSintetico {
  readonly nome: string;
  readonly telefone: string;
}

/** Um cliente sintético, único por execução (AGENTS.md, invariante 10). */
export function clienteSintetico(sufixo: number): ClienteSintetico {
  const semente = Math.floor(Math.random() * 1_000_000);
  return {
    nome: `Marina Sintética ${sufixo}`,
    telefone: `+5511${String(500_000_000 + semente * 10 + sufixo)}`,
  };
}

/**
 * Uma oportunidade parada na fila, com o contexto de §9.5.
 *
 * `COTADO` exige cotação retornada e a fila humana só recebe quem já foi
 * cotado, então o caminho passa por cada etapa em vez de saltar para o fim.
 */
export async function porNaFila(cliente: ClienteSintetico): Promise<void> {
  const contato = await umId('select id from public.localizar_ou_criar_contato($1, $2, null, $3)', [
    CORRETORA_ALFA,
    cliente.nome,
    cliente.telefone,
  ]);
  const oportunidade = await umId(
    `select id from public.abrir_oportunidade($1, $2, null, 'LANDING_PAGE')`,
    [CORRETORA_ALFA, contato],
  );

  await mover(oportunidade, ['EM_VALIDACAO', 'QUALIFICADO', 'EM_COTACAO']);

  await executar(
    `insert into public.cotacao (corretora_id, oportunidade_id, seguradora_id, status)
     select $1, $2, id, 'RETORNADA' from public.seguradora limit 1`,
    [CORRETORA_ALFA, oportunidade],
  );

  await mover(oportunidade, ['COTADO', 'NA_FILA']);

  await executar(
    `update public.qualificacao
        set intencao = 'QUENTE', completude = 'COMPLETO', preocupacao_principal = 'ROUBO_FURTO'
      where oportunidade_id = $1`,
    [oportunidade],
  );
  await executar(
    `insert into public.risco_veiculo (corretora_id, oportunidade_id, marca, modelo, ano_modelo)
     values ($1, $2, 'Chevrolet', 'Tracker Premier', 2024)`,
    [CORRETORA_ALFA, oportunidade],
  );
  await executar(
    `insert into public.pendencia (corretora_id, oportunidade_id, tipo, descricao, prazo)
     values ($1, $2, 'DADO_CADASTRAL', 'Confirmar CEP', now() + interval '1 day')`,
    [CORRETORA_ALFA, oportunidade],
  );
}

/**
 * A oportunidade já atribuída ao consultor, com opções de plano e pendência.
 *
 * O cenário da tela de atendimento: é dela que o consultor resolve pendência e
 * marca o plano que o cliente quer.
 */
export async function emAtendimento(cliente: ClienteSintetico): Promise<string> {
  await porNaFila(cliente);

  const oportunidade = await umId(
    `select o.id
     from public.oportunidade o
     join public.contato c on c.id = o.contato_id
     where c.telefone_e164 = $1`,
    [cliente.telefone],
  );

  const cotacao = await umId(`select id from public.cotacao where oportunidade_id = $1 limit 1`, [
    oportunidade,
  ]);
  await executar(
    `insert into public.cotacao_opcao (corretora_id, cotacao_id, nome_plano, premio, franquia)
     values ($1, $2, 'Compreensiva', 2400.00, 3500.00),
            ($1, $2, 'Essencial', 1800.00, 4200.00)`,
    [CORRETORA_ALFA, cotacao],
  );

  await executar(
    `update public.oportunidade
        set consultor_id = (select id from public.usuario where email = 'consultor@alfa.local'),
            atribuido_em = now()
      where id = $1`,
    [oportunidade],
  );
  await mover(oportunidade, ['ATRIBUIDO']);

  return oportunidade;
}
