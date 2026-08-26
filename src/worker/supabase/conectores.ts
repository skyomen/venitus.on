import type { CanalWhatsapp } from '@/conectores/whatsapp/contrato';
import type { Crm, Espelhamento } from '@/conectores/crm/contrato';
import type { ResultadoDoEnvio } from '../decisoes';
import type { Espelho, Mensageiro } from '../portas';
import { paraResultadoDoEnvio } from './mapeamento';

/**
 * As portas do worker sobre os conectores.
 *
 * O worker fala em "enviar texto para este telefone"; o conector fala em
 * `Escrita<T>` com chave de idempotência e devolve `Resultado<T>` com o id do
 * provedor. A costura entre os dois é isto aqui, e nada mais.
 *
 * O worker **não** escolhe entre stub e real: quem escolhe é a configuração da
 * corretora (§10.5). Trocar de conector não muda nenhuma linha deste arquivo.
 */

export function criarMensageiro(canal: CanalWhatsapp): Mensageiro {
  return {
    async enviarTexto(
      chaveIdempotencia: string,
      telefoneE164: string,
      texto: string,
    ): Promise<ResultadoDoEnvio> {
      return paraResultadoDoEnvio(
        await canal.enviarTexto({ chaveIdempotencia, payload: { telefoneE164, texto } }),
      );
    },

    async enviarTemplate(
      chaveIdempotencia: string,
      telefoneE164: string,
      template: string,
    ): Promise<ResultadoDoEnvio> {
      return paraResultadoDoEnvio(
        await canal.enviarTemplate({
          chaveIdempotencia,
          // As variáveis do template saem do contexto quando a API real entrar;
          // o stub valida o destino e o código, que é o que existe para validar.
          payload: { telefoneE164, template, variaveis: {} },
        }),
      );
    },
  };
}

export function criarEspelho(crm: Crm): Espelho {
  return {
    async espelhar(
      chaveIdempotencia: string,
      espelhamento: Espelhamento,
    ): Promise<ResultadoDoEnvio> {
      return paraResultadoDoEnvio(await crm.espelhar({ chaveIdempotencia, payload: espelhamento }));
    },
  };
}
