/**
 * O modo de dados ativo.
 *
 * Blueprint §18: o modo aparece sempre na tela, com cor própria. Nunca dá para
 * confundir dado sintético com dado de produção — e é essa confusão que faz
 * alguém tratar registro real como descartável.
 */

export const MODOS = ['sintetico', 'espelho', 'producao-leitura', 'producao'] as const;

export type ModoDados = (typeof MODOS)[number];

const ROTULOS: Readonly<Record<ModoDados, string>> = {
  sintetico: 'Dados sintéticos',
  espelho: 'Espelho de produção — dados anonimizados',
  'producao-leitura': 'PRODUÇÃO — somente leitura, sessão auditada',
  producao: 'Produção',
};

export function ehModoDados(valor: unknown): valor is ModoDados {
  return typeof valor === 'string' && (MODOS as readonly string[]).includes(valor);
}

/** Na dúvida, assume o modo mais restritivo: tratar produção como sintético é o erro caro. */
export function interpretarModo(valor: unknown): ModoDados {
  return ehModoDados(valor) ? valor : 'producao';
}

export function modoDeDados(): ModoDados {
  return interpretarModo(process.env.MODO_DADOS);
}

export function rotuloDoModo(modo: ModoDados): string {
  return ROTULOS[modo];
}

/** Escrita é bloqueada no modo de leitura de produção (§18.2). */
export function permiteEscrita(modo: ModoDados): boolean {
  return modo !== 'producao-leitura';
}
