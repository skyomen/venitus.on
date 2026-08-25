import 'server-only';

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarClienteServidor } from '@/dados/cliente-servidor';
import { ROTA_LOGIN } from '@/seguranca/autorizacao';
import { obterSessao } from '@/seguranca/sessao';
import type { Perfil } from '@/seguranca/perfil';

/**
 * As telas de segundo fator exigem sessão, mas não pertencem a área nenhuma:
 * é justamente nelas que a sessão ainda está incompleta.
 */
export async function sessaoParaMfa(): Promise<{
  sessao: Perfil;
  supabase: SupabaseClient;
}> {
  const sessao = await obterSessao();
  if (sessao === null) {
    redirect(ROTA_LOGIN);
  }
  return { sessao, supabase: await criarClienteServidor() };
}
