import { criarValidadoresStub } from './validadores/stub';
import type { Validadores } from './validadores/contrato';
import { criarWhatsappStub } from './whatsapp/stub';
import type { CanalWhatsapp } from './whatsapp/contrato';
import { criarCrmStub } from './crm/stub';
import type { Crm } from './crm/contrato';

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

type Catalogo<T> = Partial<Record<Implementacao, () => T>>;

function escolher<T>(familia: string, catalogo: Catalogo<T>, implementacao: Implementacao): T {
  const fabrica = catalogo[implementacao];

  if (fabrica === undefined) {
    throw new Error(
      `Conector de ${familia} "${implementacao}" não está registrado. ` +
        'Configure a corretora para "stub" enquanto a API real não existir.',
    );
  }

  return fabrica();
}

// `real` entra em cada família quando a API dela existir. Até lá, pedir por ele
// falha.
const VALIDADORES: Catalogo<Validadores> = { stub: criarValidadoresStub };
const WHATSAPP: Catalogo<CanalWhatsapp> = { stub: criarWhatsappStub };
const CRM: Catalogo<Crm> = { stub: criarCrmStub };

export function obterValidadores(implementacao: Implementacao): Validadores {
  return escolher('validadores', VALIDADORES, implementacao);
}

export function obterCanalWhatsapp(implementacao: Implementacao): CanalWhatsapp {
  return escolher('whatsapp', WHATSAPP, implementacao);
}

export function obterCrm(implementacao: Implementacao): Crm {
  return escolher('crm', CRM, implementacao);
}
