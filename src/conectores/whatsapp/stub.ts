import { falha, sucesso } from '../contrato';
import type { Escrita, Resultado } from '../contrato';
import type { CanalWhatsapp, Entregue, MensagemDeTemplate, MensagemDeTexto } from './contrato';

/**
 * Canal de WhatsApp em modo stub.
 *
 * Não entrega nada, e é honesto sobre isso: devolve `AGUARDANDO_CONECTOR`, que o
 * worker registra no outbox para reprocessar quando a API real entrar (§10.5).
 * Fingir entrega faria a régua avançar sobre mensagens que nunca saíram.
 *
 * A validação é a mesma que a API real faria, para que um payload que passa aqui
 * passe lá — e é isso que o teste de contrato cobra.
 */

const E164 = /^\+55\d{10,11}$/;

/** O provedor recusa texto acima deste tamanho. */
const LIMITE_DO_TEXTO = 4096;

function conferirDestino(telefoneE164: string): Resultado<Entregue> | null {
  return E164.test(telefoneE164)
    ? null
    : falha('PAYLOAD_INVALIDO', 'Telefone precisa estar em E.164', 'telefone');
}

function aguardando(chave: string): Resultado<Entregue> {
  return falha(
    'AGUARDANDO_CONECTOR',
    `Sem canal real de WhatsApp: a mensagem ${chave} ficou guardada para reprocessar.`,
  );
}

export function criarWhatsappStub(): CanalWhatsapp {
  return {
    async enviarTexto(escrita: Escrita<MensagemDeTexto>): Promise<Resultado<Entregue>> {
      const destinoInvalido = conferirDestino(escrita.payload.telefoneE164);
      if (destinoInvalido !== null) {
        return destinoInvalido;
      }

      if (escrita.payload.texto.trim() === '') {
        return falha('PAYLOAD_INVALIDO', 'Mensagem vazia', 'texto');
      }
      if (escrita.payload.texto.length > LIMITE_DO_TEXTO) {
        return falha('PAYLOAD_INVALIDO', 'Mensagem acima do limite do provedor', 'texto');
      }

      return aguardando(escrita.chaveIdempotencia);
    },

    async enviarTemplate(escrita: Escrita<MensagemDeTemplate>): Promise<Resultado<Entregue>> {
      const destinoInvalido = conferirDestino(escrita.payload.telefoneE164);
      if (destinoInvalido !== null) {
        return destinoInvalido;
      }

      if (escrita.payload.template.trim() === '') {
        return falha('PAYLOAD_INVALIDO', 'Template não informado', 'template');
      }

      return aguardando(escrita.chaveIdempotencia);
    },
  };
}

/**
 * Canal que finge entrega, para exercitar o caminho feliz.
 *
 * Existe só para desenvolvimento e teste: em homologação e piloto o stub honesto
 * é o certo, porque marcar como entregue o que não saiu esconde o problema.
 */
export function criarWhatsappQueEntrega(): CanalWhatsapp {
  function entregar(escrita: Escrita<{ telefoneE164: string }>): Resultado<Entregue> {
    const destinoInvalido = conferirDestino(escrita.payload.telefoneE164);
    if (destinoInvalido !== null) {
      return destinoInvalido;
    }

    return sucesso(
      { idExterno: `stub:${escrita.chaveIdempotencia}`, enviadoEm: new Date().toISOString() },
      'STUB',
    );
  }

  return {
    async enviarTexto(escrita) {
      return entregar(escrita);
    },
    async enviarTemplate(escrita) {
      return entregar(escrita);
    },
  };
}
