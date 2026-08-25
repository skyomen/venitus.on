/**
 * Prioridade na fila comercial (blueprint §9.3).
 *
 * O princípio manda mais que a fórmula: **qualificação determina prioridade, não
 * exclusão**. Lead frio contatável continua elegível e sobe conforme envelhece —
 * entregar só lead perfeito desperdiça o investimento de aquisição e esconde
 * oportunidade.
 *
 * A capacidade do consultor não entra aqui. Ela decide *quem* atende, não *quem
 * é o próximo* — e misturar as duas coisas faria a ordem da fila mudar conforme
 * quem está online.
 */

export type Intencao = 'FRIA' | 'MORNA' | 'QUENTE';
export type Completude = 'COMPLETO' | 'PENDENTE';

export interface Pesos {
  readonly intencao: number;
  readonly espera: number;
  readonly contexto: number;
}

export const PESOS_PADRAO: Pesos = { intencao: 10, espera: 1, contexto: 5 };

export interface FatoresDaFila {
  readonly intencao: Intencao;
  readonly minutosNaFila: number;
  readonly completude: Completude;
}

const GRAU_DA_INTENCAO: Readonly<Record<Intencao, number>> = {
  FRIA: 1,
  MORNA: 2,
  QUENTE: 3,
};

function interpretarNumero(valor: unknown, padrao: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : padrao;
}

/** Lê os pesos gravados na corretora, caindo no padrão para o que estiver ausente. */
export function interpretarPesos(configurado: unknown): Pesos {
  if (typeof configurado !== 'object' || configurado === null) {
    return PESOS_PADRAO;
  }

  const bruto = configurado as Record<string, unknown>;
  return {
    intencao: interpretarNumero(bruto['intencao'], PESOS_PADRAO.intencao),
    espera: interpretarNumero(bruto['espera'], PESOS_PADRAO.espera),
    contexto: interpretarNumero(bruto['contexto'], PESOS_PADRAO.contexto),
  };
}

/**
 * A espera conta por hora inteira, e **sem teto**.
 *
 * Sem teto de propósito: é isso que faz o lead antigo alcançar o quente e
 * impede que ele fique parado para sempre no fim da fila. Um limite superior
 * traria de volta exatamente o abandono que a regra existe para evitar.
 */
function pontosDeEspera(minutosNaFila: number, peso: number): number {
  const horas = Math.floor(Math.max(0, minutosNaFila) / 60);
  return horas * peso;
}

export function calcularPrioridade(fatores: FatoresDaFila, pesos: Pesos = PESOS_PADRAO): number {
  const intencao = GRAU_DA_INTENCAO[fatores.intencao] * pesos.intencao;
  const espera = pontosDeEspera(fatores.minutosNaFila, pesos.espera);

  // Dado completo fecha mais rápido, então vale posição — mas pendência não
  // derruba ninguém para o fim: ela apenas deixa de somar (§9.1).
  const contexto = fatores.completude === 'COMPLETO' ? pesos.contexto : 0;

  return intencao + espera + contexto;
}
