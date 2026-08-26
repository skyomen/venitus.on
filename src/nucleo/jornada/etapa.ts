import type { TomDeEstado } from '@/design/tom';

/**
 * As etapas da jornada (blueprint §8.1).
 *
 * A lista espelha o enum `public.etapa_oportunidade`. Vive aqui, e não dentro de
 * um módulo de follow-up ou de tela, porque a etapa é o conceito central do
 * domínio: quase tudo pergunta em que ponto a oportunidade está.
 *
 * Quem garante que a lista não descole do banco é o teste de integração, que a
 * compara com `pg_enum`.
 */
export const ETAPAS = [
  'NOVO',
  'EM_VALIDACAO',
  'AGUARDANDO_DADO',
  'QUALIFICADO',
  'EM_COTACAO',
  'COTADO',
  'NA_FILA',
  'ATRIBUIDO',
  'EM_NEGOCIACAO',
  'PROPOSTA_EM_ELABORACAO',
  'PROPOSTA_TRANSMITIDA',
  'EM_VISTORIA',
  'EM_ANALISE_SEGURADORA',
  'AGUARDANDO_APOLICE',
  'VENDIDA',
  'PERDIDA',
  'ENCERRADA_SEM_CONTATO',
] as const;

export type Etapa = (typeof ETAPAS)[number];

/** Depois destas, a oportunidade não anda mais. */
export const ETAPAS_TERMINAIS = ['VENDIDA', 'PERDIDA', 'ENCERRADA_SEM_CONTATO'] as const;

export function ehEtapa(valor: unknown): valor is Etapa {
  return ETAPAS.some((etapa) => etapa === valor);
}

export function ehTerminal(etapa: Etapa): boolean {
  return ETAPAS_TERMINAIS.some((terminal) => terminal === etapa);
}

/**
 * O nome que aparece na tela.
 *
 * `EM_ANALISE_SEGURADORA` é nome de coluna; "Em análise na seguradora" é o que
 * o consultor lê para o cliente ao telefone.
 */
const ROTULO: Readonly<Record<Etapa, string>> = {
  NOVO: 'Novo',
  EM_VALIDACAO: 'Em validação',
  AGUARDANDO_DADO: 'Aguardando dado',
  QUALIFICADO: 'Qualificado',
  EM_COTACAO: 'Em cotação',
  COTADO: 'Cotado',
  NA_FILA: 'Na fila',
  ATRIBUIDO: 'Em atendimento',
  EM_NEGOCIACAO: 'Em negociação',
  PROPOSTA_EM_ELABORACAO: 'Proposta em elaboração',
  PROPOSTA_TRANSMITIDA: 'Proposta transmitida',
  EM_VISTORIA: 'Em vistoria',
  EM_ANALISE_SEGURADORA: 'Em análise na seguradora',
  AGUARDANDO_APOLICE: 'Aguardando apólice',
  VENDIDA: 'Vendida',
  PERDIDA: 'Perdida',
  ENCERRADA_SEM_CONTATO: 'Encerrada sem contato',
};

export function rotuloDaEtapa(etapa: Etapa): string {
  return ROTULO[etapa];
}

/**
 * O tom da etapa.
 *
 * Só os extremos têm cor: venda fechada e jornada encerrada. O meio do caminho
 * é neutro de propósito — pintar catorze etapas faria nenhuma se destacar, e a
 * cor deixaria de significar "olhe para isto".
 */
export function tomDaEtapa(etapa: Etapa): TomDeEstado {
  if (etapa === 'VENDIDA') {
    return 'bom';
  }
  if (etapa === 'PERDIDA' || etapa === 'ENCERRADA_SEM_CONTATO') {
    return 'critico';
  }

  return 'neutro';
}
