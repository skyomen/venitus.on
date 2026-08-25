/**
 * As três réguas de follow-up (blueprint §11.1).
 *
 * As cadências vêm da operação real, não de palpite:
 *
 * - **Inatividade em conversa:** 30 min → 2 h → 3 h, com mensagem contextual.
 * - **Abertura sem resposta:** 4 tentativas, 24 h entre elas.
 * - **Recuperação pós-negociação:** R1 no 1º dia, R2 no 2º, R3 no 3º; depois,
 *   perdida e atendimento encerrado.
 *
 * Este módulo só decide *o que* agendar e *quando*. Quem grava é o banco, quem
 * dispara é o worker — manter a decisão pura é o que permite exercitar as três
 * réguas inteiras sem esperar horas passarem.
 */

export const REGUAS = ['INATIVIDADE', 'ABERTURA', 'RECUPERACAO'] as const;

export type Regua = (typeof REGUAS)[number];

export interface Passo {
  /** Identifica o passo no agendamento. Ex.: `INATIVIDADE_2`, `ABERTURA_3`. */
  readonly tipo: string;
  /** Minutos a contar do gatilho. */
  readonly emMinutos: number;
  /** O template a disparar, quando o passo exige um. */
  readonly template?: string;
}

const MINUTO = 1;
const HORA = 60;
const DIA = 24 * HORA;

/**
 * Cada régua é uma lista de passos, e a lista **é** a regra.
 *
 * Declarada como dado porque assim ela é legível, testável e ajustável por quem
 * cuida da operação, sem abrir uma função.
 */
const PASSOS: Readonly<Record<Regua, readonly Passo[]>> = {
  INATIVIDADE: [
    { tipo: 'INATIVIDADE_1', emMinutos: 30 * MINUTO },
    { tipo: 'INATIVIDADE_2', emMinutos: 2 * HORA },
    { tipo: 'INATIVIDADE_3', emMinutos: 3 * HORA },
  ],
  ABERTURA: [
    { tipo: 'ABERTURA_1', emMinutos: 0, template: '01_primeiro_contato' },
    { tipo: 'ABERTURA_2', emMinutos: 1 * DIA, template: '02_abertura' },
    { tipo: 'ABERTURA_3', emMinutos: 2 * DIA, template: '03_primeiro_contato' },
    { tipo: 'ABERTURA_4', emMinutos: 3 * DIA, template: '04_abertura' },
    { tipo: 'ABERTURA_5', emMinutos: 4 * DIA, template: '05_primeiro_contato' },
  ],
  RECUPERACAO: [
    { tipo: 'R1', emMinutos: 1 * DIA },
    { tipo: 'R2', emMinutos: 2 * DIA },
    { tipo: 'R3', emMinutos: 3 * DIA },
  ],
};

export function passosDaRegua(regua: Regua): readonly Passo[] {
  return PASSOS[regua];
}

export interface Agendamento {
  readonly tipo: string;
  readonly executarEm: Date;
  readonly template?: string;
  /** Impede duplicar o mesmo passo da mesma régua para a mesma oportunidade. */
  readonly chaveUnicidade: string;
}

function emMinutos(base: Date, minutos: number): Date {
  return new Date(base.getTime() + minutos * 60_000);
}

/**
 * O próximo passo da régua, a partir do que já foi disparado.
 *
 * Devolve `null` quando a régua acabou — e o fim da régua não é silêncio: quem
 * chama decide o que fazer (encerrar, marcar perdida), porque a consequência
 * muda conforme a régua.
 */
export function proximoAgendamento(
  regua: Regua,
  oportunidadeId: string,
  ultimoTipoDisparado: string | null,
  gatilho: Date,
): Agendamento | null {
  const passos = PASSOS[regua];
  const indiceAtual = passos.findIndex((passo) => passo.tipo === ultimoTipoDisparado);

  // Tipo desconhecido reinicia a régua em vez de encerrá-la: encerrar por um
  // valor que não reconhecemos deixaria o cliente sem follow-up nenhum.
  const proximo = passos[indiceAtual + 1];

  if (proximo === undefined) {
    return null;
  }

  return {
    tipo: proximo.tipo,
    executarEm: emMinutos(gatilho, proximo.emMinutos),
    ...(proximo.template === undefined ? {} : { template: proximo.template }),
    chaveUnicidade: `${regua}:${oportunidadeId}:${proximo.tipo}`,
  };
}

/** Fim de régua sem resposta: cada uma termina de um jeito. */
export type Encerramento =
  | { readonly tipo: 'MARCAR_PERDIDA'; readonly motivo: string }
  | { readonly tipo: 'ENCERRAR_SEM_CONTATO'; readonly motivo: string };

export function encerramentoDaRegua(regua: Regua): Encerramento {
  if (regua === 'ABERTURA') {
    // Nunca houve conversa: não é uma venda perdida, é um contato que não pegou.
    return {
      tipo: 'ENCERRAR_SEM_CONTATO',
      motivo: 'Não respondeu a nenhuma tentativa de abertura',
    };
  }

  if (regua === 'RECUPERACAO') {
    return { tipo: 'MARCAR_PERDIDA', motivo: 'Não retomou após a régua de recuperação' };
  }

  return { tipo: 'MARCAR_PERDIDA', motivo: 'Parou de responder durante o atendimento' };
}
