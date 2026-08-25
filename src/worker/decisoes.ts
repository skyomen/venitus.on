import { decidirEnvio } from '@/nucleo/followup/portao-de-envio';
import type { Contexto, Disparo, MotivoDeBloqueio } from '@/nucleo/followup/portao-de-envio';
import { encerramentoDaRegua, proximoAgendamento } from '@/nucleo/followup/regua';
import type { Agendamento, Encerramento, Regua } from '@/nucleo/followup/regua';
import { desistiu, proximaTentativaEmSegundos } from '@/conectores/resiliencia';
import { valeTentarDeNovo } from '@/conectores/contrato';
import type { Falha } from '@/conectores/contrato';

/**
 * O que o worker faz com cada item que reservou.
 *
 * Decisão separada de efeito: aqui só se decide, e quem grava é o adaptador.
 * É o que permite exercitar cada desfecho — incluindo os que levam dias para
 * acontecer de verdade — sem banco e sem esperar.
 */

export type Acao =
  | { readonly tipo: 'ENVIAR'; readonly comTemplate: boolean }
  /** A régua deixou de fazer sentido. Some sem barulho. */
  | { readonly tipo: 'CANCELAR'; readonly motivo: string }
  | { readonly tipo: 'REAGENDAR'; readonly emSegundos: number; readonly motivo: string }
  /** Precisa de gente: alguém configurou algo errado. */
  | { readonly tipo: 'FALHAR'; readonly motivo: string };

/** Quanto esperar quando o disparo caiu fora do horário de atendimento. */
const REAGENDAR_FORA_DO_HORARIO_SEGUNDOS = 15 * 60;

const CANCELAMENTOS: Partial<Record<MotivoDeBloqueio, string>> = {
  CONVERSA_DO_CONSULTOR: 'O consultor assumiu a conversa',
  SEM_CONSENTIMENTO: 'O cliente pediu para não receber mensagens',
};

/**
 * O bloqueio decide o destino do agendamento.
 *
 * Nem todo bloqueio é igual: uns significam que a régua perdeu o sentido, um
 * significa "ainda não", e outros significam configuração errada — que não se
 * resolve tentando de novo.
 */
export function decidirAcao(contexto: Contexto, disparo: Disparo): Acao {
  const decisao = decidirEnvio(contexto, disparo);

  if (decisao.tipo === 'ENVIAR') {
    return { tipo: 'ENVIAR', comTemplate: decisao.comTemplate };
  }

  const cancelamento = CANCELAMENTOS[decisao.motivo];
  if (cancelamento !== undefined) {
    return { tipo: 'CANCELAR', motivo: cancelamento };
  }

  if (decisao.motivo === 'FORA_DO_HORARIO') {
    // Não é erro: é cedo demais. Volta quando a corretora abrir.
    return {
      tipo: 'REAGENDAR',
      emSegundos: REAGENDAR_FORA_DO_HORARIO_SEGUNDOS,
      motivo: 'Fora do horário de atendimento da corretora',
    };
  }

  // Template ausente ou não aprovado é configuração, não indisponibilidade.
  // Reexecutar não resolve, e insistir só esconderia o problema do gestor.
  return { tipo: 'FALHAR', motivo: decisao.motivo };
}

export type AposEnvio =
  | { readonly tipo: 'AVANCAR'; readonly proximo: Agendamento }
  | { readonly tipo: 'ENCERRAR'; readonly encerramento: Encerramento }
  | { readonly tipo: 'REAGENDAR'; readonly emSegundos: number }
  | { readonly tipo: 'FALHAR'; readonly motivo: string };

export interface ResultadoDoEnvio {
  readonly ok: boolean;
  readonly falha?: Falha;
}

/**
 * O que fazer depois de tentar entregar.
 *
 * Entregou: avança a régua, ou encerra quando ela acabou. Não entregou: tenta
 * de novo quando a falha foi do caminho, desiste quando insistir não muda nada.
 */
export interface EnvioConcluido {
  readonly regua: Regua;
  readonly oportunidadeId: string;
  readonly tipoDisparado: string;
  readonly resultado: ResultadoDoEnvio;
  readonly tentativas: number;
  readonly agora: Date;
}

export function decidirAposEnvio(envio: EnvioConcluido): AposEnvio {
  const { regua, oportunidadeId, tipoDisparado, resultado, tentativas, agora } = envio;

  if (!resultado.ok) {
    const falha = resultado.falha;

    if (falha === undefined || !valeTentarDeNovo(falha)) {
      return { tipo: 'FALHAR', motivo: falha?.motivo ?? 'FALHA_DESCONHECIDA' };
    }
    if (desistiu(tentativas)) {
      return { tipo: 'FALHAR', motivo: 'Excedeu o limite de tentativas' };
    }

    return { tipo: 'REAGENDAR', emSegundos: proximaTentativaEmSegundos(tentativas) };
  }

  const proximo = proximoAgendamento(regua, oportunidadeId, tipoDisparado, agora);

  return proximo === null
    ? { tipo: 'ENCERRAR', encerramento: encerramentoDaRegua(regua) }
    : { tipo: 'AVANCAR', proximo };
}

/**
 * Um item do outbox que falhou.
 *
 * Mais simples que a régua: não há próximo passo, só entregar ou desistir. O
 * item que aguarda conector fica parado de propósito, esperando o conector real
 * — reexecutá-lo sem ele só encheria o log.
 */
export type AposOutbox =
  | { readonly tipo: 'ENTREGUE' }
  | { readonly tipo: 'AGUARDAR_CONECTOR' }
  | { readonly tipo: 'REAGENDAR'; readonly emSegundos: number }
  | { readonly tipo: 'FALHAR'; readonly motivo: string };

export function decidirAposOutbox(resultado: ResultadoDoEnvio, tentativas: number): AposOutbox {
  if (resultado.ok) {
    return { tipo: 'ENTREGUE' };
  }

  const falha = resultado.falha;

  if (falha?.motivo === 'AGUARDANDO_CONECTOR') {
    return { tipo: 'AGUARDAR_CONECTOR' };
  }
  if (falha === undefined || !valeTentarDeNovo(falha)) {
    return { tipo: 'FALHAR', motivo: falha?.detalhe ?? 'Falha sem motivo declarado' };
  }
  if (desistiu(tentativas)) {
    return { tipo: 'FALHAR', motivo: 'Excedeu o limite de tentativas' };
  }

  return { tipo: 'REAGENDAR', emSegundos: proximaTentativaEmSegundos(tentativas) };
}
