import 'server-only';

import { criarClienteServidor } from '@/dados/cliente-servidor';
import { montarCartao } from '@/nucleo/fila/cartao';
import type { CartaoDeOportunidade } from '@/nucleo/fila/cartao';
import { montarLinhasDaFila } from '@/nucleo/fila/leitura';

/**
 * A fila comercial, como o consultor a vê.
 *
 * Adaptador: monta a consulta e entrega o DTO. Quem decide o que aparece é
 * `nucleo/fila/cartao.ts`, e quem interpreta as linhas é `nucleo/fila/leitura.ts`
 * — os dois puros e cobertos.
 *
 * A consulta roda com o **token do usuário**, então a RLS é quem recorta o
 * tenant e a visibilidade. Não há filtro de `corretora_id` aqui de propósito:
 * repetir a regra na aplicação criaria um segundo lugar para ela divergir.
 */

const SELECAO = `
  id,
  entrou_na_fila_em,
  contato ( nome ),
  qualificacao ( intencao, completude, preocupacao_principal ),
  risco_veiculo ( marca, modelo, ano_modelo ),
  cotacao ( status ),
  cotacao_opcao ( nome_plano ),
  pendencia ( descricao, prazo )
`;

/** Uma tela de telefone não rola cinquenta cartões; o resto é ruído. */
const LIMITE = 20;

export async function lerFila(agora: Date = new Date()): Promise<readonly CartaoDeOportunidade[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from('oportunidade')
    .select(SELECAO)
    .eq('etapa', 'NA_FILA')
    .is('consultor_id', null)
    .eq('pendencia.status', 'ABERTA')
    // A ordem é a da fila (§9.4): prioridade alta primeiro, e entre iguais o
    // mais antigo. É o mesmo índice que a distribuição usa.
    .order('prioridade', { ascending: false })
    .order('entrou_na_fila_em', { ascending: true })
    .order('prazo', { referencedTable: 'pendencia', ascending: true, nullsFirst: false })
    .limit(1, { referencedTable: 'pendencia' })
    .limit(LIMITE);

  if (error !== null) {
    throw new Error(`não foi possível ler a fila: ${error.message}`);
  }

  return montarLinhasDaFila(data, agora).map((linha) => montarCartao(linha, agora));
}
