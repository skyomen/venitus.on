import 'server-only';

import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/dados/cliente-servidor';
import { ROTA_LOGIN, ROTA_SEM_PERMISSAO, podeAcessar } from './autorizacao';
import { interpretarPerfil } from './perfil';
import type { Perfil } from './perfil';

export type { Perfil } from './perfil';

/**
 * Ponte entre o Auth e o perfil da aplicação.
 *
 * Toda a decisão vive em `perfil.ts` e `autorizacao.ts`, que são puros e testados.
 * O que sobra aqui é a chamada ao Auth e o redirecionamento — orquestração fina
 * de propósito.
 */

/**
 * `getClaims` verifica a assinatura do token e devolve os claims que o hook
 * injetou — que é de onde vem o papel.
 *
 * `getUser` não serve: ele devolve o `app_metadata` gravado na tabela do Auth,
 * sem `papel`. E `getSession` apenas decodifica o cookie, sem conferir assinatura.
 *
 * Ler do token também é o que mantém a aplicação e a RLS de acordo: as duas
 * enxergam exatamente a mesma origem.
 */
export async function obterSessao(): Promise<Perfil | null> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.getClaims();

  return error !== null ? null : interpretarPerfil(data?.claims);
}

/** Usada pelo layout de cada área. É aqui que a autorização acontece de verdade. */
export async function exigirAcesso(area: string): Promise<Perfil> {
  const sessao = await obterSessao();

  if (sessao === null) {
    redirect(ROTA_LOGIN);
  }
  if (!podeAcessar(sessao.papel, area)) {
    redirect(ROTA_SEM_PERMISSAO);
  }
  return sessao;
}
