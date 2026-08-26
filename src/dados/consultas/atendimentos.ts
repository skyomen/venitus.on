import 'server-only';

import { criarClienteServidor } from '@/dados/cliente-servidor';
import { montarCartao } from '@/nucleo/fila/cartao';
import type { CartaoDeOportunidade } from '@/nucleo/fila/cartao';
import { montarLinhasDaFila } from '@/nucleo/fila/leitura';

/**
 * O que já está na mão do consultor.
 *
 * Mesma leitura da fila, outro recorte: aqui o SLA já é de uma pessoa, e a
 * etapa terminal sai da lista — atendimento encerrado não é trabalho pendente.
 *
 * O consultor vem do token, nunca de parâmetro de rota: a RLS já limitaria o
 * que ele enxerga, mas pedir "os atendimentos de fulano" pela URL é a forma
 * mais fácil de transformar uma tela em vazamento.
 */

const SELECAO = `
  id,
  entrou_na_fila_em,
  contato ( nome ),
  qualificacao ( intencao, completude, preocupacao_principal ),
  risco_veiculo ( marca, modelo, ano_modelo ),
  cotacao ( status ),
  pendencia ( descricao, prazo )
`;

const TERMINAIS = ['VENDIDA', 'PERDIDA', 'ENCERRADA_SEM_CONTATO'];

export async function lerMeusAtendimentos(
  consultorId: string,
  agora: Date = new Date(),
): Promise<readonly CartaoDeOportunidade[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from('oportunidade')
    .select(SELECAO)
    .eq('consultor_id', consultorId)
    .not('etapa', 'in', `(${TERMINAIS.join(',')})`)
    .eq('pendencia.status', 'ABERTA')
    // O mais antigo primeiro: quem espera há mais tempo é quem corre risco.
    .order('atribuido_em', { ascending: true })
    .order('prazo', { referencedTable: 'pendencia', ascending: true, nullsFirst: false })
    .limit(1, { referencedTable: 'pendencia' });

  if (error !== null) {
    throw new Error(`não foi possível ler os atendimentos: ${error.message}`);
  }

  return montarLinhasDaFila(data, agora).map((linha) => montarCartao(linha, agora));
}
