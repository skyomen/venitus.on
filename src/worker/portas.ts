import type { Contexto } from '@/nucleo/followup/portao-de-envio';
import type { Agendamento, Encerramento, Regua } from '@/nucleo/followup/regua';
import type { Espelhamento } from '@/conectores/crm/contrato';
import type { ResultadoDoEnvio } from './decisoes';

/**
 * As portas do worker.
 *
 * O laço de drenagem fala com estas interfaces, nunca com o banco nem com um
 * conector concreto. É o que permite exercitar o laço inteiro — inclusive os
 * desfechos que levam dias — sem subir infraestrutura.
 */

export interface ItemAgendado {
  readonly id: string;
  readonly oportunidadeId: string;
  readonly regua: Regua;
  readonly tipo: string;
  readonly tentativas: number;
  readonly template?: string | undefined;
}

export interface ItemDeOutbox {
  readonly id: string;
  readonly tentativas: number;
  readonly chaveIdempotencia: string;
  readonly espelhamento: Espelhamento;
}

export interface ContextoDoDisparo {
  readonly contexto: Contexto;
  readonly telefoneE164: string;
  readonly templateAprovadoEm: Date | null;
  readonly textoContextual: string;
}

export interface RepositorioDoWorker {
  reservarAgendamentos(limite: number): Promise<readonly ItemAgendado[]>;
  reservarOutbox(limite: number): Promise<readonly ItemDeOutbox[]>;

  /** Devolve nada quando a oportunidade sumiu entre a reserva e o disparo. */
  carregarContexto(item: ItemAgendado): Promise<ContextoDoDisparo | null>;

  concluirAgendamento(id: string): Promise<void>;
  cancelarAgendamento(id: string, motivo: string): Promise<void>;
  falharAgendamento(id: string, motivo: string): Promise<void>;
  reagendar(id: string, emSegundos: number): Promise<void>;

  criarProximoPasso(oportunidadeId: string, proximo: Agendamento): Promise<void>;
  encerrarOportunidade(oportunidadeId: string, encerramento: Encerramento): Promise<void>;

  concluirOutbox(id: string): Promise<void>;
  aguardarConector(id: string): Promise<void>;
  falharOutbox(id: string, motivo: string, emSegundos: number | null): Promise<void>;
}

export interface Mensageiro {
  enviarTexto(
    chaveIdempotencia: string,
    telefoneE164: string,
    texto: string,
  ): Promise<ResultadoDoEnvio>;

  enviarTemplate(
    chaveIdempotencia: string,
    telefoneE164: string,
    template: string,
  ): Promise<ResultadoDoEnvio>;
}

export interface Espelho {
  espelhar(chaveIdempotencia: string, espelhamento: Espelhamento): Promise<ResultadoDoEnvio>;
}

export interface Relogio {
  agora(): Date;
}
