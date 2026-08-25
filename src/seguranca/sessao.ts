import 'server-only';

import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/dados/cliente-servidor';
import { ROTA_LOGIN, ROTA_SEM_PERMISSAO, podeAcessar } from './autorizacao';
import { interpretarPerfil } from './perfil';
import { decidirMfa, mfaObrigatoria, papelExigeMfa, rotaDaExigencia } from './mfa';
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

/**
 * Só consulta os fatores quando pode mudar a decisão.
 *
 * A sessão já em `aal2` não precisa de consulta, e o consultor sem
 * obrigatoriedade também não — assim a chamada extra ao Auth não vira custo
 * fixo de toda página.
 */
async function exigenciaDeSegundoFator(perfil: Perfil): Promise<string | null> {
  const obrigatoria = mfaObrigatoria(process.env.NODE_ENV, process.env['MFA_OBRIGATORIA']);

  if (perfil.nivel === 'aal2' || (!obrigatoria && !papelExigeMfa(perfil.papel))) {
    return null;
  }

  const supabase = await criarClienteServidor();
  const fatores = await supabase.auth.mfa.listFactors();
  const temFatorVerificado = fatores.data?.totp.some((f) => f.status === 'verified') ?? false;

  return rotaDaExigencia(
    decidirMfa({ papel: perfil.papel, obrigatoria, temFatorVerificado, nivel: perfil.nivel }),
  );
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

  const destinoMfa = await exigenciaDeSegundoFator(sessao);
  if (destinoMfa !== null) {
    redirect(destinoMfa);
  }

  return sessao;
}
