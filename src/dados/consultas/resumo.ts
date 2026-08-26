import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { criarClienteServidor } from '@/dados/cliente-servidor';

/**
 * Os quatro números da tela de início do consultor.
 *
 * A tela responde "o que preciso fazer agora?", então cada número é um número
 * sobre o qual dá para agir. `head: true` não traz linha nenhuma: o que a tela
 * precisa é do total, e puxar as linhas para contá-las no servidor traria PII
 * sem uso.
 */

export interface ResumoDoConsultor {
  readonly quentesNaFila: number;
  readonly aguardando: number;
  readonly meusAtendimentos: number;
  readonly minhasPendencias: number;
}

const TERMINAIS = '(VENDIDA,PERDIDA,ENCERRADA_SEM_CONTATO)';

interface Contagem {
  readonly count: number | null;
}

function contar(supabase: SupabaseClient, tabela: string, selecao: string) {
  return supabase.from(tabela).select(selecao, { count: 'exact', head: true });
}

/** Contagem indisponível vira zero, não tela quebrada. */
function total(resposta: Contagem): number {
  return resposta.count ?? 0;
}

export async function lerResumoDoConsultor(consultorId: string): Promise<ResumoDoConsultor> {
  const supabase = await criarClienteServidor();

  const [quentes, aguardando, atendimentos, pendencias] = await Promise.all([
    // `!inner` é o que permite filtrar pela qualificação: sem ele o PostgREST
    // devolveria também quem ainda não foi qualificado.
    contar(supabase, 'oportunidade', 'id, qualificacao!inner(intencao)')
      .eq('etapa', 'NA_FILA')
      .is('consultor_id', null)
      .eq('qualificacao.intencao', 'QUENTE'),

    contar(supabase, 'oportunidade', 'id').eq('etapa', 'NA_FILA').is('consultor_id', null),

    contar(supabase, 'oportunidade', 'id')
      .eq('consultor_id', consultorId)
      .not('etapa', 'in', TERMINAIS),

    contar(supabase, 'pendencia', 'id, oportunidade!inner(consultor_id)')
      .eq('status', 'ABERTA')
      .eq('oportunidade.consultor_id', consultorId),
  ]);

  return {
    quentesNaFila: total(quentes),
    aguardando: total(aguardando),
    meusAtendimentos: total(atendimentos),
    minhasPendencias: total(pendencias),
  };
}
