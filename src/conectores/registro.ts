import { criarValidadoresStub } from './validadores/stub';
import type { Validadores } from './validadores/contrato';

/**
 * Escolhe a implementação de cada conector.
 *
 * Blueprint §10.5: trocar stub por real é mudar uma linha de configuração da
 * corretora, não refatorar a jornada.
 *
 * Pedir uma implementação que não existe **falha na hora**, e não recua em
 * silêncio para o stub. Um recuo silencioso faria a corretora operar em modo
 * sintético achando que está em produção — e a venda de stub entraria nas
 * métricas de negócio como se fosse real.
 */

export type Implementacao = 'real' | 'stub';

const VALIDADORES: Partial<Record<Implementacao, () => Validadores>> = {
  // `real` entra quando a API existir. Até lá, pedir por ele falha.
  stub: criarValidadoresStub,
};

export function obterValidadores(implementacao: Implementacao): Validadores {
  const fabrica = VALIDADORES[implementacao];

  if (fabrica === undefined) {
    throw new Error(
      `Conector de validadores "${implementacao}" não está registrado. ` +
        'Configure a corretora para "stub" enquanto a API real não existir.',
    );
  }

  return fabrica();
}
