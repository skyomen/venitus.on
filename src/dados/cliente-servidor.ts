import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * O único cliente Supabase que a aplicação usa.
 *
 * Blueprint AD-3 e §4.2: não existe cliente no navegador. Este roda no servidor,
 * carrega o JWT do usuário vindo do cookie e continua sujeito a RLS.
 *
 * O `import 'server-only'` no topo é intencional: um import acidental a partir de
 * um Client Component quebra o build em vez de vazar em produção.
 */

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') {
    throw new Error(`Variável de ambiente ${nome} ausente.`);
  }
  return valor;
}

/**
 * A sessão vive em cookie inacessível ao JavaScript (§4.1, V1).
 *
 * `HttpOnly` só é possível porque nenhum cliente de navegador precisa ler o token.
 * É a contrapartida direta da decisão AD-3.
 */
const OPCOES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const;

export async function criarClienteServidor(): Promise<SupabaseClient> {
  const armazem = await cookies();

  return createServerClient(exigir('SUPABASE_URL'), exigir('SUPABASE_ANON_KEY'), {
    cookies: {
      getAll() {
        return armazem.getAll();
      },
      setAll(aDefinir) {
        try {
          for (const { name, value, options } of aDefinir) {
            armazem.set(name, value, { ...options, ...OPCOES_COOKIE });
          }
        } catch {
          // Server Component não pode escrever cookie. O middleware já renovou
          // a sessão antes de chegar aqui, então ignorar é seguro.
        }
      },
    },
  });
}
