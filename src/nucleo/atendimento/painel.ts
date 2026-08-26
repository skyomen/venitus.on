import type { TomDeEstado } from '@/design/tom';
import type { CartaoDeOportunidade } from '@/nucleo/fila/cartao';
import type { TipoDePendencia } from '@/nucleo/followup/mensagem';
import { rotuloDaEtapa, tomDaEtapa } from '@/nucleo/jornada/etapa';
import type { Etapa } from '@/nucleo/jornada/etapa';
import { emReais } from './dinheiro';
import type { EventoNaTela } from './linha-do-tempo';

/**
 * O painel de atendimento: tudo que o consultor precisa enquanto conversa.
 *
 * A tela é burra e este módulo decide. É aqui que se resolve o que é urgente,
 * o que já foi resolvido, qual plano está escolhido e como cada número aparece
 * — todas decisões que erram em silêncio se ficarem espalhadas pelo JSX.
 */

export interface PendenciaBruta {
  readonly id: string;
  readonly tipo: TipoDePendencia | string;
  readonly descricao: string;
  readonly prazo: Date | null;
  readonly resolvida: boolean;
}

export interface PendenciaNaTela {
  readonly id: string;
  readonly descricao: string;
  readonly tom: TomDeEstado;
  readonly prazo: string;
  readonly resolvida: boolean;
}

export interface OpcaoBruta {
  readonly id: string;
  readonly nomePlano: string;
  readonly premio: number | null;
  readonly franquia: number | null;
  readonly seguradora: string | null;
}

export interface OpcaoNaTela {
  readonly id: string;
  readonly nomePlano: string;
  readonly seguradora: string;
  readonly premio: string;
  readonly franquia: string;
  readonly escolhida: boolean;
}

export interface EtapaNaTela {
  readonly rotulo: string;
  readonly tom: TomDeEstado;
}

export interface PainelDeAtendimento {
  readonly cartao: CartaoDeOportunidade;
  readonly etapa: EtapaNaTela;
  readonly pendencias: readonly PendenciaNaTela[];
  readonly opcoes: readonly OpcaoNaTela[];
  readonly linhaDoTempo: readonly EventoNaTela[];
}

const SEM_VALOR = '—';

/**
 * O prazo em palavras, do ponto de vista de quem vai cobrar.
 *
 * "Vence em 2026-08-28" obriga o consultor a fazer a conta no meio da ligação.
 * "Vence amanhã" ele lê e já sabe o que dizer.
 */
export function prazoEmTexto(prazo: Date | null, agora: Date): string {
  if (prazo === null) {
    return 'Sem prazo';
  }

  const dias = Math.floor((prazo.getTime() - agora.getTime()) / 86_400_000);

  if (dias < 0) {
    return dias === -1 ? 'Venceu ontem' : `Venceu há ${Math.abs(dias)} dias`;
  }
  if (dias === 0) {
    return 'Vence hoje';
  }
  if (dias === 1) {
    return 'Vence amanhã';
  }

  return `Vence em ${dias} dias`;
}

/**
 * Resolvida some do caminho; vencida grita; o resto pede atenção.
 *
 * Pendência sem prazo fica em atenção e não em neutro: ela continua bloqueando
 * a jornada, e a ausência de prazo é falha de quem cadastrou, não licença para
 * ignorar.
 */
export function tomDaPendencia(pendencia: PendenciaBruta, agora: Date): TomDeEstado {
  if (pendencia.resolvida) {
    return 'bom';
  }
  if (pendencia.prazo !== null && pendencia.prazo.getTime() < agora.getTime()) {
    return 'critico';
  }

  return 'atencao';
}

export function pendenciaNaTela(pendencia: PendenciaBruta, agora: Date): PendenciaNaTela {
  return {
    id: pendencia.id,
    descricao: pendencia.descricao,
    tom: tomDaPendencia(pendencia, agora),
    prazo: pendencia.resolvida ? 'Resolvida' : prazoEmTexto(pendencia.prazo, agora),
    resolvida: pendencia.resolvida,
  };
}

/**
 * A ordem é a da urgência, não a do banco.
 *
 * Resolvidas por último, e entre as abertas a de prazo mais curto primeiro —
 * quem não tem prazo vai para o fim das abertas.
 */
function porUrgencia(a: PendenciaBruta, b: PendenciaBruta): number {
  if (a.resolvida !== b.resolvida) {
    return a.resolvida ? 1 : -1;
  }

  const semPrazo = Number.MAX_SAFE_INTEGER;
  return (a.prazo?.getTime() ?? semPrazo) - (b.prazo?.getTime() ?? semPrazo);
}

export function montarPendencias(
  pendencias: readonly PendenciaBruta[],
  agora: Date,
): readonly PendenciaNaTela[] {
  return [...pendencias].sort(porUrgencia).map((pendencia) => pendenciaNaTela(pendencia, agora));
}

export function opcaoNaTela(opcao: OpcaoBruta, escolhidaId: string | null): OpcaoNaTela {
  return {
    id: opcao.id,
    nomePlano: opcao.nomePlano,
    seguradora: opcao.seguradora ?? SEM_VALOR,
    premio: emReais(opcao.premio) ?? SEM_VALOR,
    franquia: emReais(opcao.franquia) ?? SEM_VALOR,
    escolhida: opcao.id === escolhidaId,
  };
}

/**
 * As opções vêm ordenadas do mais barato ao mais caro.
 *
 * É a ordem em que a conversa acontece: o cliente pergunta o preço primeiro.
 * Plano sem prêmio informado vai para o fim, porque não dá para comparar.
 */
export function montarOpcoes(
  opcoes: readonly OpcaoBruta[],
  escolhidaId: string | null,
): readonly OpcaoNaTela[] {
  return [...opcoes]
    .sort((a, b) => (a.premio ?? Number.MAX_SAFE_INTEGER) - (b.premio ?? Number.MAX_SAFE_INTEGER))
    .map((opcao) => opcaoNaTela(opcao, escolhidaId));
}

export function etapaNaTela(etapa: Etapa): EtapaNaTela {
  return { rotulo: rotuloDaEtapa(etapa), tom: tomDaEtapa(etapa) };
}

/** O plano que o cliente disse preferir, para a linha de §9.5 no cartão. */
export function planoEscolhido(
  opcoes: readonly OpcaoBruta[],
  escolhidaId: string | null,
): string | null {
  return opcoes.find((opcao) => opcao.id === escolhidaId)?.nomePlano ?? null;
}
