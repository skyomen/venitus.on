import type { Escrita, Resultado } from '../contrato';

/**
 * CRM externo.
 *
 * Espelho, não fonte de verdade (blueprint AD-7). O estado da jornada é nosso;
 * o que sai daqui é a projeção dele para o sistema onde a corretora já trabalha.
 *
 * Por isso toda operação é idempotente por natureza: reenviar o mesmo
 * espelhamento tem de produzir o mesmo estado lá, não uma segunda oportunidade.
 */

export const OPERACOES_CRM = [
  'SINCRONIZAR_CONTATO',
  'SINCRONIZAR_OPORTUNIDADE',
  'MOVER_ETAPA',
] as const;

export type OperacaoCrm = (typeof OPERACOES_CRM)[number];

export interface Espelhamento {
  readonly operacao: OperacaoCrm;
  readonly oportunidadeId: string | null;
  readonly dados: Readonly<Record<string, unknown>>;
}

export interface Espelhado {
  /** Identificador do registro no CRM, para conciliação posterior. */
  readonly idExterno: string;
}

export interface Crm {
  espelhar(escrita: Escrita<Espelhamento>): Promise<Resultado<Espelhado>>;
}
