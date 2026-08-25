/**
 * O contrato que todo conector cumpre.
 *
 * Blueprint §10.5: cada família nasce com duas implementações — a real e o stub —
 * e a corretora escolhe qual está ativa. O stub não é dublê de teste: ele roda em
 * homologação e em piloto, valida o mesmo payload e guarda a intenção para
 * reprocessar quando a API real entrar.
 *
 * Falha é valor, não exceção. Integração recusar, faltar dado ou o fornecedor
 * cair são casos esperados na jornada — tratá-los como excepcionais espalharia
 * `try/catch` por todo lugar e esconderia o caminho de erro.
 */

export const CONECTORES = [
  'validadores',
  'whatsapp',
  'crm',
  'seguradora',
  'email',
  'retaguarda',
] as const;

export type Conector = (typeof CONECTORES)[number];

/** De onde veio a resposta. Venda originada de stub não entra em métrica de negócio. */
export type OrigemResposta = 'REAL' | 'STUB';

export const MOTIVOS_FALHA = [
  /** O payload não cumpre o contrato. Reexecutar não adianta. */
  'PAYLOAD_INVALIDO',
  /** O fornecedor respondeu que não. Reexecutar não adianta. */
  'RECUSADO',
  /** Falta um dado para conseguir perguntar. */
  'DADO_FALTANTE',
  /** O fornecedor não respondeu. Reexecutar adianta. */
  'INDISPONIVEL',
  /** O disjuntor está aberto: o fornecedor vem falhando e paramos de insistir. */
  'DISJUNTOR_ABERTO',
  /** O conector real ainda não existe; a intenção ficou guardada. */
  'AGUARDANDO_CONECTOR',
] as const;

export type MotivoFalha = (typeof MOTIVOS_FALHA)[number];

export interface Falha {
  readonly motivo: MotivoFalha;
  readonly detalhe: string;
  /** Qual campo falta, quando o motivo é `DADO_FALTANTE`. */
  readonly campo?: string;
}

export type Resultado<T> =
  | { readonly ok: true; readonly valor: T; readonly origem: OrigemResposta }
  | { readonly ok: false; readonly falha: Falha };

export function sucesso<T>(valor: T, origem: OrigemResposta): Resultado<T> {
  return { ok: true, valor, origem };
}

export function falha<T>(motivo: MotivoFalha, detalhe: string, campo?: string): Resultado<T> {
  return {
    ok: false,
    falha: campo === undefined ? { motivo, detalhe } : { motivo, detalhe, campo },
  };
}

/** Reexecutar só faz sentido quando a falha foi do caminho, não do conteúdo. */
export function valeTentarDeNovo(falhaOcorrida: Falha): boolean {
  return falhaOcorrida.motivo === 'INDISPONIVEL' || falhaOcorrida.motivo === 'DISJUNTOR_ABERTO';
}

/**
 * Toda escrita externa carrega chave de idempotência.
 *
 * Reexecutar não pode criar contato, oportunidade ou proposta em duplicidade —
 * e reexecutar é o normal, porque o worker tenta de novo o que falhou.
 */
export interface Escrita<T> {
  readonly chaveIdempotencia: string;
  readonly payload: T;
}
