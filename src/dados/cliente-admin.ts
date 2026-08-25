import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente com `service_role`.
 *
 * Blueprint §4.2: existe apenas no worker e em caminhos administrativos do
 * servidor. **Ele ignora a RLS**, então cada uso filtra o tenant à mão — aqui
 * quem filtra é a própria função do banco, que resolve a corretora pelo canal.
 *
 * O `import 'server-only'` no topo é intencional: um import acidental a partir
 * de um Client Component quebra o build em vez de vazar em produção.
 */
export function criarClienteAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url === undefined || url === '' || chave === undefined || chave === '') {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no servidor.');
  }

  return createClient(url, chave, { auth: { persistSession: false } });
}
