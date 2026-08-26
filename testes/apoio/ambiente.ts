/**
 * Apoio aos testes de integração contra o Postgres real.
 *
 * Blueprint §20.6: RLS é verificado contra o banco de verdade. Teste de policy
 * com banco falso não prova nada — ele testaria o dublê, não a policy.
 */
import { Pool } from 'pg';

export const SENHA_LOCAL = 'Venitus@Local123';

export const USUARIOS = {
  admin: 'admin@venitus.local',
  gestorAlfa: 'gestor@alfa.local',
  consultorAlfa: 'consultor@alfa.local',
  gestorBeta: 'gestor@beta.local',
  consultorBeta: 'consultor@beta.local',
} as const;

export const CORRETORA_ALFA = '00000000-0000-4000-8000-00000000000a';
export const CORRETORA_BETA = '00000000-0000-4000-8000-00000000000b';

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') {
    throw new Error(
      `Variável ${nome} ausente. Rode "npm run db:up" e preencha o .env com o que ele imprime.`,
    );
  }
  return valor;
}

export const URL_API = exigir('SUPABASE_URL');
export const CHAVE_ANON = exigir('SUPABASE_ANON_KEY');

let pool: Pool | undefined;

/** Conexão administrativa. Serve para inspecionar o catálogo, não para burlar RLS em teste. */
export function conexao(): Pool {
  pool ??= new Pool({ connectionString: exigir('SUPABASE_DB_URL'), max: 4 });
  return pool;
}

export async function consultar<T extends Record<string, unknown>>(
  sql: string,
  valores: readonly unknown[] = [],
): Promise<T[]> {
  const resultado = await conexao().query<T>(sql, valores as unknown[]);
  return resultado.rows;
}

export async function encerrarConexao(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Faz login de verdade e devolve o access token, com os claims que o hook injetou. */
export async function entrar(email: string): Promise<string> {
  const resposta = await fetch(`${URL_API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CHAVE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA_LOCAL }),
  });
  const corpo = (await resposta.json()) as { access_token?: string };
  if (corpo.access_token === undefined) {
    throw new Error(`Login falhou para ${email}: ${JSON.stringify(corpo)}`);
  }
  return corpo.access_token;
}

export function claimsDe(token: string): Record<string, unknown> {
  const parte = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(parte, 'base64url').toString('utf8')) as Record<string, unknown>;
}

interface RespostaRest {
  readonly status: number;
  readonly linhas: readonly Record<string, unknown>[];
}

/** Lê pela mesma porta que a aplicação usa: PostgREST com o token do usuário. */
export async function lerComoUsuario(token: string | null, caminho: string): Promise<RespostaRest> {
  const cabecalhos: Record<string, string> = { apikey: CHAVE_ANON };
  if (token !== null) {
    cabecalhos['Authorization'] = `Bearer ${token}`;
  }
  const resposta = await fetch(`${URL_API}/rest/v1/${caminho}`, { headers: cabecalhos });
  const corpo: unknown = await resposta.json().catch(() => []);
  return {
    status: resposta.status,
    linhas: Array.isArray(corpo) ? (corpo as Record<string, unknown>[]) : [],
  };
}

/**
 * Chama uma função do banco pela porta da aplicação.
 *
 * Não é o mesmo que `select public.f()` pela conexão direta: aqui a chamada
 * passa pelo PostgREST com o papel `authenticated`, então o `grant` e o
 * `auth.uid()` são exercitados de verdade.
 */
export async function chamarComoUsuario(
  token: string | null,
  funcao: string,
  argumentos: Record<string, unknown> = {},
): Promise<RespostaRest> {
  const cabecalhos: Record<string, string> = {
    apikey: CHAVE_ANON,
    'Content-Type': 'application/json',
  };
  if (token !== null) {
    cabecalhos['Authorization'] = `Bearer ${token}`;
  }

  const resposta = await fetch(`${URL_API}/rest/v1/rpc/${funcao}`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify(argumentos),
  });

  const texto = await resposta.text();
  const corpo: unknown = texto === '' ? null : JSON.parse(texto);

  return {
    status: resposta.status,
    linhas: corpo === null ? [] : [corpo as Record<string, unknown>],
  };
}

export interface RespostaEscrita {
  readonly status: number;
  readonly codigo: string | null;
  readonly linhas: readonly Record<string, unknown>[];
}

/**
 * Escreve pela porta da aplicação.
 *
 * O caminho precisa trazer filtro: o PostgREST recusa alteração sem `where`
 * com o código 21000, e um teste sem filtro passaria por esse motivo em vez de
 * pelo que ele afirma verificar.
 */
export async function escreverComoUsuario(
  token: string,
  caminho: string,
  corpo: Record<string, unknown>,
): Promise<RespostaEscrita> {
  const resposta = await fetch(`${URL_API}/rest/v1/${caminho}`, {
    method: 'PATCH',
    headers: {
      apikey: CHAVE_ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(corpo),
  });

  const texto = await resposta.text();
  const corpoResposta: unknown = texto === '' ? [] : JSON.parse(texto);

  if (Array.isArray(corpoResposta)) {
    return { status: resposta.status, codigo: null, linhas: corpoResposta };
  }
  const erro = corpoResposta as { code?: string };
  return { status: resposta.status, codigo: erro.code ?? null, linhas: [] };
}
