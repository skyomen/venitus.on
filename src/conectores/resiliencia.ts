import { valeTentarDeNovo } from './contrato';
import type { Falha } from './contrato';

/**
 * Reexecução e disjuntor (blueprint §10.2).
 *
 * Duas decisões que não podem viver dentro de cada conector: se vale tentar de
 * novo, e quando parar de insistir. Espalhá-las garantiria que cada integração
 * escolhesse um comportamento diferente sob a mesma falha.
 */

export type EstadoDisjuntor = 'FECHADO' | 'ABERTO' | 'MEIO_ABERTO';

/** Depois disto, insistir só multiplica a chamada que já falhou. */
export const FALHAS_ATE_ABRIR = 5;

/** Quanto o disjuntor fica aberto antes de deixar uma chamada de prova passar. */
export const MINUTOS_ABERTO = 5;

export const MAXIMO_DE_TENTATIVAS = 6;

/**
 * Espera exponencial com jitter.
 *
 * O exponencial dá folga ao fornecedor que caiu; o jitter evita que todos os
 * itens que falharam juntos voltem juntos e derrubem de novo o que acabou de
 * levantar.
 */
export function proximaTentativaEmSegundos(
  tentativas: number,
  sorteio: number = Math.random(),
): number {
  const base = Math.min(2 ** Math.max(0, tentativas), 512);
  const jitter = 1 + sorteio * 0.5;
  return Math.round(base * jitter);
}

export function desistiu(tentativas: number): boolean {
  return tentativas >= MAXIMO_DE_TENTATIVAS;
}

export interface Saude {
  readonly estado: EstadoDisjuntor;
  readonly falhasConsecutivas: number;
  readonly abertoEm: Date | null;
}

/** O disjuntor fechado deixa passar; aberto só volta a passar depois da espera. */
export function podeChamar(saude: Saude, agora: Date): boolean {
  if (saude.estado === 'FECHADO') {
    return true;
  }
  if (saude.estado === 'MEIO_ABERTO') {
    // Uma chamada de prova por vez: é ela que decide se o fornecedor voltou.
    return true;
  }
  if (saude.abertoEm === null) {
    return false;
  }

  const minutos = (agora.getTime() - saude.abertoEm.getTime()) / 60_000;
  return minutos >= MINUTOS_ABERTO;
}

export function aposSucesso(): Saude {
  return { estado: 'FECHADO', falhasConsecutivas: 0, abertoEm: null };
}

export function aposFalha(saude: Saude, falha: Falha, agora: Date): Saude {
  // Falha de conteúdo não é sinal de fornecedor doente: o payload é que estava
  // errado. Contá-la abriria o disjuntor por culpa nossa.
  if (!valeTentarDeNovo(falha)) {
    return saude;
  }

  const falhas = saude.falhasConsecutivas + 1;

  return falhas >= FALHAS_ATE_ABRIR
    ? { estado: 'ABERTO', falhasConsecutivas: falhas, abertoEm: agora }
    : { estado: 'FECHADO', falhasConsecutivas: falhas, abertoEm: null };
}
