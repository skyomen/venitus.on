/**
 * O texto de um follow-up em texto livre (blueprint §11.2).
 *
 * A regra é explícita: a mensagem considera a etapa atual, a última conversa e a
 * pendência real — **nunca um texto genérico**. "Oi, tudo bem?" enviado três
 * vezes num dia é o que faz o cliente bloquear o número da corretora.
 *
 * Só o texto livre passa por aqui. Fora da janela de 24 h quem fala é template
 * aprovado, e o corpo dele é da corretora, não nosso.
 */

export const ETAPAS = [
  'NOVO',
  'EM_VALIDACAO',
  'AGUARDANDO_DADO',
  'QUALIFICADO',
  'EM_COTACAO',
  'COTADO',
  'NA_FILA',
  'ATRIBUIDO',
  'EM_NEGOCIACAO',
  'PROPOSTA_EM_ELABORACAO',
  'PROPOSTA_TRANSMITIDA',
  'EM_VISTORIA',
  'EM_ANALISE_SEGURADORA',
  'AGUARDANDO_APOLICE',
  'VENDIDA',
  'PERDIDA',
  'ENCERRADA_SEM_CONTATO',
] as const;

export type Etapa = (typeof ETAPAS)[number];

export const TIPOS_DE_PENDENCIA = [
  'DOCUMENTO',
  'PAGAMENTO',
  'VISTORIA',
  'RASTREADOR',
  'ANALISE_SEGURADORA',
  'DADO_CADASTRAL',
] as const;

export type TipoDePendencia = (typeof TIPOS_DE_PENDENCIA)[number];

export interface PendenciaAberta {
  readonly tipo: TipoDePendencia;
  readonly descricao: string;
}

/**
 * O assunto vem da pendência quando existe uma.
 *
 * Pendência aberta é o motivo concreto de a jornada estar parada, e falar dela
 * é o que transforma a cobrança em ajuda.
 */
const POR_PENDENCIA: Readonly<Record<TipoDePendencia, string>> = {
  DOCUMENTO: 'ainda falta um documento para seguirmos',
  PAGAMENTO: 'o pagamento ainda não foi confirmado',
  VISTORIA: 'a vistoria ainda precisa ser agendada',
  RASTREADOR: 'a instalação do rastreador ainda está pendente',
  ANALISE_SEGURADORA: 'a seguradora ainda está analisando',
  DADO_CADASTRAL: 'ainda falta um dado do cadastro',
};

/** Sem pendência, o assunto é onde a jornada parou. */
const POR_ETAPA: Partial<Readonly<Record<Etapa, string>>> = {
  NOVO: 'começamos seu atendimento e ainda não conseguimos conversar',
  EM_VALIDACAO: 'estamos conferindo seus dados',
  AGUARDANDO_DADO: 'ficou faltando um dado seu para seguirmos',
  QUALIFICADO: 'já podemos partir para a cotação',
  EM_COTACAO: 'estamos buscando as opções com as seguradoras',
  COTADO: 'suas opções de plano já estão prontas',
  NA_FILA: 'sua cotação está pronta e um consultor vai falar com você',
  ATRIBUIDO: 'um consultor está com o seu atendimento',
  EM_NEGOCIACAO: 'ficamos na dúvida sobre a proposta que conversamos',
  PROPOSTA_EM_ELABORACAO: 'estamos montando a sua proposta',
  PROPOSTA_TRANSMITIDA: 'sua proposta já foi enviada à seguradora',
  EM_VISTORIA: 'a vistoria do veículo ainda está aberta',
  EM_ANALISE_SEGURADORA: 'a seguradora está analisando a sua proposta',
  AGUARDANDO_APOLICE: 'a emissão da sua apólice está a caminho',
};

const ASSUNTO_PADRAO = 'seu atendimento ficou parado';

/**
 * O fecho muda conforme a insistência.
 *
 * A terceira mensagem sem resposta não pode soar igual à primeira: repetir o
 * mesmo convite é o que faz a régua parecer robô. A última abre a porta de saída
 * em vez de cobrar de novo.
 */
const FECHO_PRIMEIRO = 'Consegue me dizer como prefere seguir?';
const FECHO_SEGUNDO = 'Quer que eu retome de onde paramos?';
const FECHO_DEMAIS = 'Se preferir, me diga o melhor horário para falarmos.';
const FECHO_FINAL = 'Se não fizer mais sentido agora, é só me avisar que eu encerro por aqui.';

export interface DadosDaMensagem {
  readonly primeiroNome: string;
  readonly etapa: Etapa;
  readonly pendencia: PendenciaAberta | null;
  /** Qual tentativa da régua é esta, a partir de 1. */
  readonly passo: number;
  /** Quantos passos a régua tem ao todo. */
  readonly totalDePassos: number;
}

function assuntoDe(dados: DadosDaMensagem): string {
  if (dados.pendencia !== null) {
    const conhecido = POR_PENDENCIA[dados.pendencia.tipo];
    // A descrição é escrita por gente e pode dizer mais que o tipo.
    return dados.pendencia.descricao.trim() === ''
      ? conhecido
      : `${conhecido} (${dados.pendencia.descricao.trim()})`;
  }

  return POR_ETAPA[dados.etapa] ?? ASSUNTO_PADRAO;
}

function fechoDe(passo: number, totalDePassos: number): string {
  if (passo >= totalDePassos) {
    return FECHO_FINAL;
  }
  // Passo 0 é passo desconhecido — trata como o primeiro em vez de escolher o
  // fecho de despedida por acidente.
  if (passo <= 1) {
    return FECHO_PRIMEIRO;
  }

  return passo === 2 ? FECHO_SEGUNDO : FECHO_DEMAIS;
}

/** O nome vazio não vira "Olá, !" — some, e a frase continua de pé. */
function saudacaoDe(primeiroNome: string): string {
  const nome = primeiroNome.trim();
  return nome === '' ? 'Olá!' : `Olá, ${nome}!`;
}

export function montarTextoContextual(dados: DadosDaMensagem): string {
  return `${saudacaoDe(dados.primeiroNome)} Sobre o seu seguro: ${assuntoDe(dados)}. ${fechoDe(
    dados.passo,
    dados.totalDePassos,
  )}`;
}
