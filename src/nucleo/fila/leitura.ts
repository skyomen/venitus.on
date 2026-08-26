import { data, objeto, texto } from '@/dados/leitura';
import { PREOCUPACOES } from './cartao';
import type { LinhaDaFila, Preocupacao, Veiculo } from './cartao';
import type { Completude, Intencao } from './prioridade';

/**
 * A tradução entre o que o PostgREST devolve e o DTO da fila.
 *
 * Separada do adaptador pelo mesmo motivo do worker: é aqui que estão as
 * decisões que podem errar — qualificação ausente, veículo sem modelo,
 * pendência que já venceu — e todas elas são testáveis sem banco.
 *
 * A consulta traz relações aninhadas, e o PostgREST entrega relação de
 * cardinalidade um ora como objeto, ora como lista de um elemento. Ler os dois
 * casos é mais barato que confiar num deles.
 */

function primeiro(valor: unknown): Record<string, unknown> | null {
  return objeto(Array.isArray(valor) ? valor[0] : valor);
}

function inteiroOuNada(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.trunc(valor) : null;
}

function intencaoDe(valor: unknown): Intencao {
  // Sem qualificação calculada, o lead é frio — nunca quente por omissão, que
  // furaria a fila de quem realmente demonstrou intenção.
  return valor === 'MORNA' || valor === 'QUENTE' ? valor : 'FRIA';
}

function completudeDe(valor: unknown): Completude {
  return valor === 'COMPLETO' ? 'COMPLETO' : 'PENDENTE';
}

function preocupacaoDe(valor: unknown): Preocupacao | null {
  return PREOCUPACOES.find((conhecida) => conhecida === valor) ?? null;
}

function veiculoDe(valor: unknown): Veiculo | null {
  const risco = primeiro(valor);
  if (risco === null) {
    return null;
  }

  return {
    marca: texto(risco['marca']),
    modelo: texto(risco['modelo']),
    anoModelo: inteiroOuNada(risco['ano_modelo']),
  };
}

/**
 * A pendência que o consultor precisa citar.
 *
 * A consulta já traz só as abertas, ordenadas por prazo. Vencida vira crítico:
 * é a única que muda o que o consultor diz ao abrir a conversa.
 */
function pendenciaDe(valor: unknown, agora: Date) {
  const pendencia = primeiro(valor);
  const descricao = texto(pendencia?.['descricao']);

  if (descricao === null) {
    return null;
  }

  const prazo = data(pendencia?.['prazo']);
  return { descricao, vencida: prazo !== null && prazo.getTime() < agora.getTime() };
}

/**
 * Houve cotação com retorno da seguradora?
 *
 * `SOLICITADA` não conta: o consultor que abre a conversa dizendo "já temos sua
 * cotação" sobre um pedido que ainda não voltou queima a confiança na primeira
 * frase.
 */
function cotadaDe(valor: unknown): boolean {
  return Array.isArray(valor) && valor.some((item) => objeto(item)?.['status'] === 'RETORNADA');
}

export function montarLinhaDaFila(bruto: unknown, agora: Date): LinhaDaFila | null {
  const linha = objeto(bruto);
  const id = texto(linha?.['id']);

  if (linha === null || id === null) {
    return null;
  }

  const qualificacao = primeiro(linha['qualificacao']);
  const contato = primeiro(linha['contato']);

  return {
    id,
    nome: texto(contato?.['nome']) ?? 'Cliente sem nome',
    entrouNaFilaEm: data(linha['entrou_na_fila_em']),
    intencao: intencaoDe(qualificacao?.['intencao']),
    completude: completudeDe(qualificacao?.['completude']),
    preocupacao: preocupacaoDe(qualificacao?.['preocupacao_principal']),
    veiculo: veiculoDe(linha['risco_veiculo']),
    cotada: cotadaDe(linha['cotacao']),
    // O plano que o cliente disse preferir, gravado no atendimento. A relação
    // é direta: `oportunidade.opcao_interesse_id` aponta para a opção que a
    // seguradora retornou.
    planoDeInteresse: texto(primeiro(linha['cotacao_opcao'])?.['nome_plano']),
    pendencia: pendenciaDe(linha['pendencia'], agora),
  };
}

export function montarLinhasDaFila(bruto: unknown, agora: Date): readonly LinhaDaFila[] {
  if (!Array.isArray(bruto)) {
    return [];
  }

  // Linha que não dá para interpretar some da lista em vez de derrubar a tela:
  // uma fila com nove cartões é melhor que um erro com dez.
  return bruto
    .map((item) => montarLinhaDaFila(item, agora))
    .filter((linha): linha is LinhaDaFila => linha !== null);
}
