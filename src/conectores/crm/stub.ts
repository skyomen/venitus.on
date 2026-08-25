import { falha, sucesso } from '../contrato';
import type { Escrita, Resultado } from '../contrato';
import { OPERACOES_CRM } from './contrato';
import type { Crm, Espelhado, Espelhamento } from './contrato';

/**
 * CRM em modo stub.
 *
 * Não escreve em lugar nenhum e diz isso: devolve `AGUARDANDO_CONECTOR`, e o
 * outbox guarda o item para reprocessar quando a integração real entrar (§10.5).
 * Marcar como espelhado o que não saiu criaria divergência silenciosa entre a
 * plataforma e o CRM — exatamente o que o outbox existe para impedir.
 */

function conferir(espelhamento: Espelhamento): Resultado<Espelhado> | null {
  if (!OPERACOES_CRM.includes(espelhamento.operacao)) {
    return falha('PAYLOAD_INVALIDO', `Operação desconhecida: ${espelhamento.operacao}`, 'operacao');
  }

  // Só `SINCRONIZAR_CONTATO` existe sem oportunidade; o resto precisa saber a
  // qual negócio se refere.
  if (espelhamento.operacao !== 'SINCRONIZAR_CONTATO' && espelhamento.oportunidadeId === null) {
    return falha('PAYLOAD_INVALIDO', 'Espelhamento sem oportunidade', 'oportunidadeId');
  }

  return null;
}

export function criarCrmStub(): Crm {
  return {
    async espelhar(escrita: Escrita<Espelhamento>): Promise<Resultado<Espelhado>> {
      const invalido = conferir(escrita.payload);
      if (invalido !== null) {
        return invalido;
      }

      return falha(
        'AGUARDANDO_CONECTOR',
        `Sem CRM real conectado: ${escrita.chaveIdempotencia} ficou guardado para reprocessar.`,
      );
    },
  };
}

/**
 * CRM que finge espelhar, para exercitar o caminho feliz.
 *
 * Só desenvolvimento e teste. Em homologação e piloto o stub honesto é o certo.
 */
export function criarCrmQueEspelha(): Crm {
  return {
    async espelhar(escrita: Escrita<Espelhamento>): Promise<Resultado<Espelhado>> {
      const invalido = conferir(escrita.payload);
      if (invalido !== null) {
        return invalido;
      }

      return sucesso({ idExterno: `crm-stub:${escrita.chaveIdempotencia}` }, 'STUB');
    },
  };
}
