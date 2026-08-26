import type { TomDeEstado } from '@/design/tom';
import { rotuloDaEtapa } from '@/nucleo/jornada/etapa';
import { ehEtapa } from '@/nucleo/jornada/etapa';

/**
 * A linha do tempo da oportunidade (blueprint §15.1).
 *
 * A tabela só cresce e é a base das métricas, então o evento é gravado com o
 * vocabulário do banco. Aqui ele vira frase: `TRANSICAO` com `de_etapa` e
 * `para_etapa` não diz nada a quem atende; "Da fila para Em atendimento" diz.
 *
 * Evento desconhecido **não some da linha**. Um follow-up que existiu e não
 * aparece faz o consultor repetir o que a automação já fez — e o cliente ouve a
 * mesma pergunta duas vezes.
 */

export interface EventoBruto {
  readonly id: string;
  readonly tipo: string;
  readonly deEtapa: string | null;
  readonly paraEtapa: string | null;
  readonly ator: string;
  readonly motivo: string | null;
  readonly ocorridoEm: Date | null;
}

export interface EventoNaTela {
  readonly id: string;
  readonly texto: string;
  readonly detalhe: string | null;
  readonly quem: string;
  readonly ocorridoEm: Date | null;
  readonly tom: TomDeEstado;
}

const QUEM: Readonly<Record<string, string>> = {
  AUTOMACAO: 'Automação',
  CONSULTOR: 'Consultor',
  CLIENTE: 'Cliente',
  DISTRIBUICAO: 'Fila',
  SISTEMA: 'Sistema',
  TESTE: 'Teste',
};

const TEXTO: Readonly<Record<string, string>> = {
  OPORTUNIDADE_ABERTA: 'Oportunidade aberta',
  RESPOSTA_DO_CLIENTE: 'O cliente respondeu',
  PENDENCIA_RESOLVIDA: 'Pendência resolvida',
  PLANO_DE_INTERESSE: 'Plano de interesse registrado',
  LEAD_RECEBIDO: 'Lead recebido',
  VALIDACAO: 'Validação executada',
};

/** Quem agiu, em português. Ator desconhecido vira o próprio código, não vazio. */
export function quemAgiu(ator: string): string {
  return QUEM[ator] ?? ator;
}

function etapaEmTexto(valor: string | null): string | null {
  return ehEtapa(valor) ? rotuloDaEtapa(valor) : valor;
}

/**
 * A transição é o evento mais comum, e o único que carrega origem e destino.
 *
 * Sem `de_etapa` a frase vira "Entrou em X" — é o caso da primeira transição,
 * que não tem de onde vir.
 */
function textoDaTransicao(evento: EventoBruto): string {
  const para = etapaEmTexto(evento.paraEtapa);
  const de = etapaEmTexto(evento.deEtapa);

  if (para === null) {
    return 'Transição registrada';
  }

  return de === null ? `Entrou em ${para}` : `De ${de} para ${para}`;
}

function tomDoEvento(evento: EventoBruto): TomDeEstado {
  if (evento.paraEtapa === 'VENDIDA' || evento.tipo === 'PENDENCIA_RESOLVIDA') {
    return 'bom';
  }
  if (evento.paraEtapa === 'PERDIDA' || evento.paraEtapa === 'ENCERRADA_SEM_CONTATO') {
    return 'critico';
  }
  if (evento.tipo === 'RESPOSTA_DO_CLIENTE') {
    // O cliente falando é o que muda o atendimento de lugar: merece destaque.
    return 'atencao';
  }

  return 'neutro';
}

export function eventoNaTela(evento: EventoBruto): EventoNaTela {
  const texto =
    evento.tipo === 'TRANSICAO'
      ? textoDaTransicao(evento)
      : // Evento que ainda não tem tradução aparece pelo código: some da linha
        // seria pior do que aparecer feio.
        (TEXTO[evento.tipo] ?? evento.tipo);

  return {
    id: evento.id,
    texto,
    detalhe: evento.motivo === null || evento.motivo.trim() === '' ? null : evento.motivo.trim(),
    quem: quemAgiu(evento.ator),
    ocorridoEm: evento.ocorridoEm,
    tom: tomDoEvento(evento),
  };
}

export function montarLinhaDoTempo(eventos: readonly EventoBruto[]): readonly EventoNaTela[] {
  return eventos.map(eventoNaTela);
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/**
 * "26/08 09:41".
 *
 * Sem o ano, porque a linha do tempo de um atendimento cabe em semanas, e o ano
 * repetido em trinta linhas só ocupa a largura do telefone. Usa o relógio local
 * de quem lê: o consultor confere o horário contra o próprio, não contra UTC.
 */
export function dataHoraCurta(quando: Date): string {
  const dia = doisDigitos(quando.getDate());
  const mes = doisDigitos(quando.getMonth() + 1);
  const hora = doisDigitos(quando.getHours());
  const minuto = doisDigitos(quando.getMinutes());

  return `${dia}/${mes} ${hora}:${minuto}`;
}
