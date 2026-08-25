import type { Escrita, Resultado } from '../contrato';

/**
 * Canal de WhatsApp.
 *
 * Quem decide **se** a mensagem pode sair é o portão de envio
 * (`nucleo/followup/portao-de-envio.ts`), não o conector. O conector só entrega
 * — e recusa o que o provedor recusaria, para que a falha apareça aqui e não na
 * frente do cliente.
 */

export interface MensagemDeTexto {
  readonly telefoneE164: string;
  readonly texto: string;
}

export interface MensagemDeTemplate {
  readonly telefoneE164: string;
  readonly template: string;
  readonly variaveis: Readonly<Record<string, string>>;
}

export interface Entregue {
  /** Id do provedor. É por ele que a reentrega é deduplicada (§10.4). */
  readonly idExterno: string;
  readonly enviadoEm: string;
}

export interface CanalWhatsapp {
  enviarTexto(escrita: Escrita<MensagemDeTexto>): Promise<Resultado<Entregue>>;
  enviarTemplate(escrita: Escrita<MensagemDeTemplate>): Promise<Resultado<Entregue>>;
}
