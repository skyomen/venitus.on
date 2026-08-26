import { OPERACOES_CRM } from '@/conectores/crm/contrato';
import type { Espelhamento, OperacaoCrm } from '@/conectores/crm/contrato';
import type { Resultado } from '@/conectores/contrato';
import { ETAPAS, TIPOS_DE_PENDENCIA, montarTextoContextual } from '@/nucleo/followup/mensagem';
import type { Etapa, PendenciaAberta } from '@/nucleo/followup/mensagem';
import { REGUAS, passosDaRegua } from '@/nucleo/followup/regua';
import type { Regua } from '@/nucleo/followup/regua';
import type { DonoConversa } from '@/nucleo/followup/portao-de-envio';
import type { ResultadoDoEnvio } from '../decisoes';
import type { ContextoDoDisparo, ItemAgendado, ItemDeOutbox } from '../portas';
import { booleano, data, inteiro, objeto, texto } from '@/dados/leitura';

/**
 * A tradução entre as linhas do banco e as portas do worker.
 *
 * Fica separada do adaptador de propósito: é aqui que estão as decisões que
 * podem errar — qual régua é esta, este item do outbox tem dono, esta linha está
 * completa o bastante para virar uma mensagem. O adaptador em volta só chama o
 * banco.
 *
 * Nada aqui lança. Uma linha que não dá para interpretar volta como recusa
 * nomeada, e o worker a registra em vez de derrubar o lote.
 */

export interface Recusa {
  readonly id: string;
  readonly motivo: string;
}

export interface LinhaDeAgendamento {
  readonly id: string;
  readonly oportunidade_id: string;
  readonly tipo: string;
  readonly tentativas: number;
  readonly payload: unknown;
}

export interface LinhaDeOutbox {
  readonly id: string;
  readonly tentativas: number;
  readonly chave_idempotencia: string;
  readonly destino: string;
  readonly operacao: string;
  readonly oportunidade_id: string | null;
  readonly payload: unknown;
}

export interface Classificacao<T> {
  readonly itens: readonly T[];
  readonly recusadas: readonly Recusa[];
  /** Linhas sem conector para drenar. Ficam guardadas, não falham. */
  readonly semConector: readonly string[];
}

/**
 * As janelas de atendimento do dia, em minutos desde a meia-noite.
 *
 * Uma janela malformada é descartada em vez de virar `NaN`: `NaN` em comparação
 * dá sempre falso, e o portão bloquearia o dia inteiro sem dizer por quê.
 */
export function janelas(valor: unknown): readonly (readonly [number, number])[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  const lidas: (readonly [number, number])[] = [];

  for (const bruta of valor) {
    if (!Array.isArray(bruta) || bruta.length !== 2) {
      continue;
    }
    const inicio = Number(bruta[0]);
    const fim = Number(bruta[1]);

    if (Number.isFinite(inicio) && Number.isFinite(fim)) {
      lidas.push([inicio, fim] as const);
    }
  }

  return lidas;
}

function ehRegua(valor: unknown): valor is Regua {
  return REGUAS.some((regua) => regua === valor);
}

/**
 * Qual régua criou este agendamento.
 *
 * O `payload` é a resposta direta, mas cada passo declara seu tipo, então a
 * régua é dedutível mesmo num agendamento gravado por fora. Só quando as duas
 * fontes falham é que a linha é recusada — adivinhar uma régua faria o cliente
 * receber a cadência errada.
 */
export function reguaDoAgendamento(payload: unknown, tipo: string): Regua | null {
  const declarada = objeto(payload)?.['regua'];
  if (ehRegua(declarada)) {
    return declarada;
  }

  return REGUAS.find((regua) => passosDaRegua(regua).some((passo) => passo.tipo === tipo)) ?? null;
}

/** O passo é a fonte do template: o que a régua declara vale mais que o payload. */
function templateDoPasso(regua: Regua, tipo: string): string | undefined {
  return passosDaRegua(regua).find((passo) => passo.tipo === tipo)?.template;
}

export function classificarAgendamentos(
  linhas: readonly LinhaDeAgendamento[],
): Classificacao<ItemAgendado> {
  const itens: ItemAgendado[] = [];
  const recusadas: Recusa[] = [];

  for (const linha of linhas) {
    const regua = reguaDoAgendamento(linha.payload, linha.tipo);

    if (regua === null) {
      recusadas.push({ id: linha.id, motivo: `Agendamento "${linha.tipo}" sem régua conhecida` });
      continue;
    }

    itens.push({
      id: linha.id,
      oportunidadeId: linha.oportunidade_id,
      regua,
      tipo: linha.tipo,
      tentativas: linha.tentativas,
      template: templateDoPasso(regua, linha.tipo),
    });
  }

  return { itens, recusadas, semConector: [] };
}

function ehOperacaoCrm(valor: string): valor is OperacaoCrm {
  return OPERACOES_CRM.some((operacao) => operacao === valor);
}

/**
 * O outbox guarda escrita para qualquer sistema externo; o worker hoje só drena
 * o CRM.
 *
 * Destino sem drenador vira `AGUARDANDO_CONECTOR`, que é a verdade: a intenção
 * está guardada esperando o conector entrar (§10.5). Marcá-la como falha faria o
 * gestor caçar um defeito que não existe.
 */
export function classificarOutbox(linhas: readonly LinhaDeOutbox[]): Classificacao<ItemDeOutbox> {
  const itens: ItemDeOutbox[] = [];
  const recusadas: Recusa[] = [];
  const semConector: string[] = [];

  for (const linha of linhas) {
    if (linha.destino !== 'CRM') {
      semConector.push(linha.id);
      continue;
    }
    if (!ehOperacaoCrm(linha.operacao)) {
      recusadas.push({ id: linha.id, motivo: `Operação de CRM desconhecida: ${linha.operacao}` });
      continue;
    }

    itens.push({
      id: linha.id,
      tentativas: linha.tentativas,
      chaveIdempotencia: linha.chave_idempotencia,
      espelhamento: {
        operacao: linha.operacao,
        oportunidadeId: linha.oportunidade_id,
        dados: objeto(linha.payload) ?? {},
      } satisfies Espelhamento,
    });
  }

  return { itens, recusadas, semConector };
}

function etapaDe(valor: unknown): Etapa {
  return ETAPAS.find((etapa) => etapa === valor) ?? 'NOVO';
}

function donoDe(valor: unknown): DonoConversa {
  // Na dúvida, o dono é o consultor: silenciar a automação erra para o lado que
  // não constrange o cliente.
  return valor === 'AUTOMACAO' || valor === 'AUTOMACAO_ASSISTIDA' ? valor : 'CONSULTOR';
}

function pendenciaDe(valor: unknown): PendenciaAberta | null {
  const bruta = objeto(valor);
  if (bruta === null) {
    return null;
  }

  const tipo = TIPOS_DE_PENDENCIA.find((conhecido) => conhecido === bruta['tipo']);

  return tipo === undefined ? null : { tipo, descricao: texto(bruta['descricao']) ?? '' };
}

/** Em que ponto da régua este disparo está, contando a partir de 1. */
export function posicaoDoPasso(regua: Regua, tipo: string): { passo: number; total: number } {
  const passos = passosDaRegua(regua);

  return { passo: passos.findIndex((passo) => passo.tipo === tipo) + 1, total: passos.length };
}

/**
 * Monta o contexto do disparo a partir do que `contexto_do_disparo` devolveu.
 *
 * Devolve `null` quando a oportunidade sumiu entre a reserva e o disparo — é o
 * que o laço espera para cancelar o agendamento em vez de insistir.
 */
export function montarContextoDoDisparo(
  bruto: unknown,
  item: ItemAgendado,
): ContextoDoDisparo | null {
  const lido = objeto(bruto);

  // O PostgREST expande composto nulo num objeto de campos nulos, então a
  // ausência se reconhece por um campo, não pelo objeto.
  if (lido === null || lido['dono_conversa'] === undefined || lido['dono_conversa'] === null) {
    return null;
  }

  const posicao = posicaoDoPasso(item.regua, item.tipo);

  return {
    contexto: {
      agora: data(lido['agora']) ?? new Date(),
      donoConversa: donoDe(lido['dono_conversa']),
      ultimaMensagemDoCliente: data(lido['ultima_mensagem_cliente_em']),
      consentimento: booleano(lido['consentimento']),
      janelasDoDia: janelas(lido['janelas_do_dia']),
      minutosDoDia: inteiro(lido['minutos_do_dia'], 0),
    },
    // Contato sem telefone chega aqui como vazio de propósito: quem recusa é o
    // conector, com a mesma validação que a API real faria.
    telefoneE164: texto(lido['telefone_e164']) ?? '',
    templateAprovadoEm: data(lido['template_aprovado_em']),
    textoContextual: montarTextoContextual({
      primeiroNome: texto(lido['primeiro_nome']) ?? '',
      etapa: etapaDe(lido['etapa']),
      pendencia: pendenciaDe(lido['pendencia']),
      passo: posicao.passo,
      totalDePassos: posicao.total,
    }),
  };
}

/**
 * O resultado do conector, no formato que a decisão espera.
 *
 * `Resultado` carrega o valor entregue; a decisão não usa nada dele além de ter
 * dado certo ou não. Estreitar aqui evita que o desfecho da régua passe a
 * depender do corpo da resposta de um fornecedor.
 */
export function paraResultadoDoEnvio(resultado: Resultado<unknown>): ResultadoDoEnvio {
  return resultado.ok ? { ok: true } : { ok: false, falha: resultado.falha };
}
