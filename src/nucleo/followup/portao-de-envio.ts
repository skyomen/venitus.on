/**
 * O portão único de envio de mensagem.
 *
 * Blueprint §11.4 e §11.5. Toda regra que pode impedir um disparo vive aqui, e
 * não existe caminho alternativo: janela de 24 h, template aprovado, horário da
 * corretora, consentimento e dono da conversa.
 *
 * Espalhar essas verificações pelos pontos de disparo garantiria que um deles
 * esquecesse uma — e a que fosse esquecida cobraria o cliente na hora errada.
 */

export type DonoConversa = 'AUTOMACAO' | 'CONSULTOR' | 'AUTOMACAO_ASSISTIDA';

/** Fora da janela de 24 h o provedor recusa texto livre; só template aprovado sai. */
const JANELA_DE_SESSAO_MINUTOS = 24 * 60;

export interface Contexto {
  readonly agora: Date;
  readonly donoConversa: DonoConversa;
  readonly ultimaMensagemDoCliente: Date | null;
  readonly consentimento: boolean;
  /** Janelas de atendimento do dia, em minutos desde a meia-noite local. */
  readonly janelasDoDia: readonly (readonly [number, number])[];
  readonly minutosDoDia: number;
}

export interface Disparo {
  /** Ausente significa texto livre, que só sai dentro da janela de 24 h. */
  readonly template?: string | undefined;
  readonly templateAprovadoEm?: Date | null | undefined;
}

export const MOTIVOS_DE_BLOQUEIO = [
  'SEM_CONSENTIMENTO',
  'CONVERSA_DO_CONSULTOR',
  'FORA_DO_HORARIO',
  'FORA_DA_JANELA_SEM_TEMPLATE',
  'TEMPLATE_NAO_APROVADO',
] as const;

export type MotivoDeBloqueio = (typeof MOTIVOS_DE_BLOQUEIO)[number];

export type Decisao =
  | { readonly tipo: 'ENVIAR'; readonly comTemplate: boolean }
  | { readonly tipo: 'BLOQUEADO'; readonly motivo: MotivoDeBloqueio };

export function dentroDaJanelaDeSessao(ultimaMensagemDoCliente: Date | null, agora: Date): boolean {
  if (ultimaMensagemDoCliente === null) {
    return false;
  }

  const minutos = (agora.getTime() - ultimaMensagemDoCliente.getTime()) / 60_000;
  return minutos >= 0 && minutos < JANELA_DE_SESSAO_MINUTOS;
}

export function dentroDoHorario(contexto: Contexto): boolean {
  return contexto.janelasDoDia.some(
    ([inicio, fim]) => contexto.minutosDoDia >= inicio && contexto.minutosDoDia < fim,
  );
}

/**
 * A automação só fala quando a conversa é dela.
 *
 * Da atribuição em diante o dono é o consultor (D19). Sem isso, a régua cobra o
 * cliente enquanto uma pessoa conversa com ele.
 */
export function automacaoPodeFalar(dono: DonoConversa): boolean {
  return dono !== 'CONSULTOR';
}

export function decidirEnvio(contexto: Contexto, disparo: Disparo): Decisao {
  if (!contexto.consentimento) {
    return { tipo: 'BLOQUEADO', motivo: 'SEM_CONSENTIMENTO' };
  }

  if (!automacaoPodeFalar(contexto.donoConversa)) {
    return { tipo: 'BLOQUEADO', motivo: 'CONVERSA_DO_CONSULTOR' };
  }

  if (!dentroDoHorario(contexto)) {
    return { tipo: 'BLOQUEADO', motivo: 'FORA_DO_HORARIO' };
  }

  const naJanela = dentroDaJanelaDeSessao(contexto.ultimaMensagemDoCliente, contexto.agora);

  if (disparo.template === undefined) {
    // Texto livre fora da janela é recusado pelo provedor. Falhar aqui é melhor
    // que falhar com o cliente na frente.
    return naJanela
      ? { tipo: 'ENVIAR', comTemplate: false }
      : { tipo: 'BLOQUEADO', motivo: 'FORA_DA_JANELA_SEM_TEMPLATE' };
  }

  if (disparo.templateAprovadoEm === undefined || disparo.templateAprovadoEm === null) {
    return { tipo: 'BLOQUEADO', motivo: 'TEMPLATE_NAO_APROVADO' };
  }

  return { tipo: 'ENVIAR', comTemplate: true };
}
