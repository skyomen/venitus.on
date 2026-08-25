'use server';

import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/dados/cliente-servidor';
import { ROTA_LOGIN, rotaInicialDe } from '@/seguranca/autorizacao';
import { interpretarPerfil } from '@/seguranca/perfil';
import { interpretarCredenciais } from '@/seguranca/credenciais';

export interface EstadoLogin {
  readonly erro: string | null;
}

/**
 * Login executado inteiramente no servidor.
 *
 * Blueprint §4.4: a senha nunca passa por JavaScript de navegador, e a sessão
 * volta em cookie HttpOnly. O formulário funciona sem JS ligado.
 */
export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const credenciais = interpretarCredenciais(dados.get('email'), dados.get('senha'));

  if (credenciais === null) {
    return { erro: 'Credenciais inválidas.' };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword(credenciais);

  // Mensagem única, sem distinguir e-mail inexistente de senha errada (§4.1, V12).
  if (error !== null) {
    return { erro: 'Credenciais inválidas.' };
  }

  // O papel vem dos claims do token, não do objeto de usuário: é o hook que o
  // injeta, e é o token que a RLS enxerga. Ver `seguranca/perfil.ts`.
  const { data } = await supabase.auth.getClaims();
  const perfil = interpretarPerfil(data?.claims);

  if (perfil === null) {
    // Autenticou, mas o perfil não existe ou está inativo: fail closed.
    await supabase.auth.signOut();
    return { erro: 'Credenciais inválidas.' };
  }

  redirect(rotaInicialDe(perfil.papel));
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect(ROTA_LOGIN);
}
