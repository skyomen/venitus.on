import 'server-only';

import { criarClienteServidor } from '@/dados/cliente-servidor';
import { montarPainel } from '@/nucleo/atendimento/leitura';
import type { PainelDeAtendimento } from '@/nucleo/atendimento/painel';

/**
 * Tudo que a tela de atendimento mostra, numa consulta só.
 *
 * Cinco relações aninhadas de uma vez porque a tela precisa das cinco ao mesmo
 * tempo: montar o painel sobre retratos de instantes diferentes faria o
 * consultor ver uma pendência que a linha do tempo já diz resolvida.
 *
 * Roda com o token do usuário: quem decide se esta oportunidade pode ser vista
 * é a RLS, não um filtro escrito aqui.
 */

const SELECAO = `
  id,
  etapa,
  entrou_na_fila_em,
  opcao_interesse_id,
  contato ( nome ),
  qualificacao ( intencao, completude, preocupacao_principal ),
  risco_veiculo ( marca, modelo, ano_modelo ),
  cotacao ( status, seguradora ( nome ), cotacao_opcao ( id, nome_plano, premio, franquia ) ),
  pendencia ( id, tipo, descricao, prazo, status ),
  oportunidade_evento ( id, tipo, de_etapa, para_etapa, ator, motivo, ocorrido_em )
`;

/** A linha do tempo só cresce; a tela mostra o que cabe na conversa de agora. */
const EVENTOS_VISIVEIS = 30;

export async function lerAtendimento(
  oportunidadeId: string,
  agora: Date = new Date(),
): Promise<PainelDeAtendimento | null> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from('oportunidade')
    .select(SELECAO)
    .eq('id', oportunidadeId)
    .order('ocorrido_em', { referencedTable: 'oportunidade_evento', ascending: false })
    .limit(EVENTOS_VISIVEIS, { referencedTable: 'oportunidade_evento' })
    .maybeSingle();

  if (error !== null) {
    throw new Error(`não foi possível ler o atendimento: ${error.message}`);
  }

  return montarPainel(data, agora);
}
