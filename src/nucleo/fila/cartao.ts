import type { TomDeEstado } from '@/design/tom';
import type { Completude, Intencao } from './prioridade';

/**
 * O que o consultor recebe quando a fila entrega uma oportunidade.
 *
 * Blueprint §9.5: **nunca "novo lead"**. Sempre o contexto que a operação real
 * já monta — cliente, veículo, intenção, maior preocupação, cotação, plano,
 * pendência e tempo na fila. Sem isso o consultor abre a conversa sem saber o
 * que dizer, e o cliente repete tudo o que já respondeu ao bot.
 *
 * O módulo é puro e a tela é burra: quem decide o que aparece, em que ordem e
 * com que tom é aqui, onde dá para testar sem renderizar nada.
 */

export const PREOCUPACOES = [
  'ROUBO_FURTO',
  'DANOS_ACIDENTAIS',
  'DANOS_TERCEIROS',
  'TODAS',
] as const;

export type Preocupacao = (typeof PREOCUPACOES)[number];

const TEXTO_DA_PREOCUPACAO: Readonly<Record<Preocupacao, string>> = {
  ROUBO_FURTO: 'Roubo e furto',
  DANOS_ACIDENTAIS: 'Danos ao próprio carro',
  DANOS_TERCEIROS: 'Danos a terceiros',
  TODAS: 'Cobertura completa',
};

export interface Veiculo {
  readonly marca: string | null;
  readonly modelo: string | null;
  readonly anoModelo: number | null;
}

export interface PendenciaDaFila {
  readonly descricao: string;
  readonly vencida: boolean;
}

export interface LinhaDaFila {
  readonly id: string;
  readonly nome: string;
  /** Quando entrou na fila. Ausente significa que ainda não entrou. */
  readonly entrouNaFilaEm: Date | null;
  readonly intencao: Intencao;
  readonly completude: Completude;
  readonly preocupacao: Preocupacao | null;
  readonly veiculo: Veiculo | null;
  readonly cotada: boolean;
  readonly planoDeInteresse: string | null;
  readonly pendencia: PendenciaDaFila | null;
}

export interface Fato {
  readonly rotulo: string;
  readonly valor: string;
}

export interface Espera {
  readonly minutos: number;
  readonly texto: string;
  readonly tom: TomDeEstado;
}

export interface CartaoDeOportunidade {
  readonly id: string;
  readonly nome: string;
  readonly veiculo: string | null;
  readonly intencao: Intencao;
  readonly espera: Espera;
  readonly fatos: readonly Fato[];
  readonly pendencia: { readonly texto: string; readonly tom: TomDeEstado } | null;
}

/**
 * A partir de quando a espera vira problema.
 *
 * Não há número fechado no blueprint, e este é o padrão até a corretora
 * configurar o dela: quinze minutos é o tempo em que o cliente ainda lembra que
 * pediu cotação; uma hora parado é lead esfriando na fila.
 */
export const ESPERA_CONFORTAVEL_MINUTOS = 15;
export const ESPERA_LIMITE_MINUTOS = 60;

const MINUTOS_POR_HORA = 60;
const MINUTOS_POR_DIA = 24 * MINUTOS_POR_HORA;

export function minutosDeEspera(entrouNaFilaEm: Date | null, agora: Date): number {
  if (entrouNaFilaEm === null) {
    return 0;
  }

  const minutos = (agora.getTime() - entrouNaFilaEm.getTime()) / 60_000;
  // Relógio adiantado não vira espera negativa, que apareceria como "-3 min".
  return Math.max(0, Math.floor(minutos));
}

/** "agora", "4 min", "2 h", "3 dias" — a unidade muda com a grandeza. */
export function esperaEmTexto(minutos: number): string {
  if (minutos < 1) {
    return 'agora';
  }
  if (minutos < MINUTOS_POR_HORA) {
    return `${minutos} min`;
  }
  if (minutos < MINUTOS_POR_DIA) {
    return `${Math.floor(minutos / MINUTOS_POR_HORA)} h`;
  }

  const dias = Math.floor(minutos / MINUTOS_POR_DIA);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

export function tomDaEspera(minutos: number): TomDeEstado {
  if (minutos > ESPERA_LIMITE_MINUTOS) {
    return 'critico';
  }

  return minutos > ESPERA_CONFORTAVEL_MINUTOS ? 'atencao' : 'neutro';
}

/**
 * "Chevrolet Tracker 2024".
 *
 * Devolve nada quando não há sequer o modelo: escrever "2024" sozinho ocuparia
 * a linha do veículo sem dizer qual carro é.
 */
export function descreverVeiculo(veiculo: Veiculo | null): string | null {
  if (veiculo === null || veiculo.modelo === null || veiculo.modelo.trim() === '') {
    return null;
  }

  const partes = [veiculo.marca, veiculo.modelo, veiculo.anoModelo]
    .filter((parte) => parte !== null && String(parte).trim() !== '')
    .map((parte) => String(parte).trim());

  return partes.join(' ');
}

/**
 * Os fatos de §9.5, na ordem em que a operação real os lê.
 *
 * O que não existe **não vira linha vazia**: um "Plano de interesse: —" ocupa
 * espaço na tela do telefone e não ajuda ninguém a abrir a conversa.
 */
function fatosDe(linha: LinhaDaFila): readonly Fato[] {
  const fatos: Fato[] = [];

  if (linha.preocupacao !== null) {
    fatos.push({ rotulo: 'Maior preocupação', valor: TEXTO_DA_PREOCUPACAO[linha.preocupacao] });
  }

  fatos.push({ rotulo: 'Cotação', valor: linha.cotada ? 'Realizada' : 'Ainda não' });

  if (linha.planoDeInteresse !== null && linha.planoDeInteresse.trim() !== '') {
    fatos.push({ rotulo: 'Plano de interesse', valor: linha.planoDeInteresse.trim() });
  }

  // Cadastro incompleto é fato do atendimento, não defeito escondido: o
  // consultor precisa saber que vai ter de perguntar.
  if (linha.completude === 'PENDENTE') {
    fatos.push({ rotulo: 'Cadastro', valor: 'Faltam dados' });
  }

  return fatos;
}

function pendenciaDe(linha: LinhaDaFila) {
  if (linha.pendencia === null) {
    return null;
  }

  return {
    texto: linha.pendencia.descricao,
    tom: linha.pendencia.vencida ? ('critico' as TomDeEstado) : ('atencao' as TomDeEstado),
  };
}

export function montarCartao(linha: LinhaDaFila, agora: Date): CartaoDeOportunidade {
  const minutos = minutosDeEspera(linha.entrouNaFilaEm, agora);

  return {
    id: linha.id,
    nome: linha.nome,
    veiculo: descreverVeiculo(linha.veiculo),
    intencao: linha.intencao,
    espera: { minutos, texto: esperaEmTexto(minutos), tom: tomDaEspera(minutos) },
    fatos: fatosDe(linha),
    pendencia: pendenciaDe(linha),
  };
}
