import {
  cepValido,
  cpfValido,
  normalizarTelefone,
  placaValida,
} from '@/nucleo/validacao/documento';

/**
 * A validação em cadeia (blueprint §8.3).
 *
 * A ordem é a da operação real: WhatsApp ativo → CPF → CEP → placa → modelo
 * único. Ela para no primeiro problema e pede **apenas o dado que falta** —
 * reabrir o formulário inteiro faz o cliente desistir.
 *
 * Este módulo decide; quem consulta é o chamador. Manter a decisão pura é o que
 * permite exercitar todos os ramos sem rede, banco ou fornecedor.
 */

export interface DadosDoLead {
  readonly telefone?: string | undefined;
  readonly cpf?: string | undefined;
  readonly cep?: string | undefined;
  readonly placa?: string | undefined;
}

/** O que os conectores já responderam. Ausente significa "ainda não perguntamos". */
export interface RespostasExternas {
  readonly temWhatsapp?: boolean | undefined;
  readonly modelosDaPlaca?: number | undefined;
}

export type Passo = 'TELEFONE' | 'CPF' | 'CEP' | 'PLACA' | 'MODELO';

export type Decisao =
  /**
   * Falta perguntar a um conector antes de decidir.
   *
   * `valor` vem já normalizado. Devolvê-lo aqui evita que o executor precise
   * normalizar de novo e conviver com um caso impossível — telefone inválido
   * nunca chega a esta decisão, e uma guarda para ele seria código morto.
   */
  | { readonly tipo: 'CONSULTAR'; readonly passo: Passo; readonly valor: string }
  /** Falta um dado do cliente. Pede só ele. */
  | { readonly tipo: 'PEDIR_DADO'; readonly passo: Passo; readonly campo: string }
  /** O cliente não tem WhatsApp: a jornada segue por e-mail. */
  | { readonly tipo: 'SEGUIR_POR_EMAIL' }
  /** Mais de um modelo para a placa: quem escolhe é o cliente. */
  | { readonly tipo: 'DESAMBIGUAR_MODELO' }
  | { readonly tipo: 'QUALIFICADO' };

const CAMPOS: Readonly<Record<Passo, string>> = {
  TELEFONE: 'telefone',
  CPF: 'cpf',
  CEP: 'cep',
  PLACA: 'placa',
  MODELO: 'modelo',
};

function pedir(passo: Passo): Decisao {
  return { tipo: 'PEDIR_DADO', passo, campo: CAMPOS[passo] };
}

function decidirTelefone(dados: DadosDoLead, respostas: RespostasExternas): Decisao | null {
  const telefone = normalizarTelefone(dados.telefone);

  if (telefone === null) {
    return pedir('TELEFONE');
  }
  if (respostas.temWhatsapp === undefined) {
    return { tipo: 'CONSULTAR', passo: 'TELEFONE', valor: telefone };
  }
  // Sem WhatsApp a jornada não para: ela troca de canal (§10.1).
  return respostas.temWhatsapp ? null : { tipo: 'SEGUIR_POR_EMAIL' };
}

function decidirPlaca(dados: DadosDoLead, respostas: RespostasExternas): Decisao | null {
  const placa = dados.placa;

  if (placa === undefined || !placaValida(placa)) {
    return pedir('PLACA');
  }
  if (respostas.modelosDaPlaca === undefined) {
    return { tipo: 'CONSULTAR', passo: 'PLACA', valor: placa };
  }
  if (respostas.modelosDaPlaca === 0) {
    return pedir('PLACA');
  }
  // Escolher por conta própria contaminaria a cotação inteira.
  return respostas.modelosDaPlaca > 1 ? { tipo: 'DESAMBIGUAR_MODELO' } : null;
}

/** O próximo passo da cadeia. Nunca pede dois dados de uma vez. */
export function proximoPasso(dados: DadosDoLead, respostas: RespostasExternas = {}): Decisao {
  const telefone = decidirTelefone(dados, respostas);
  if (telefone !== null) {
    return telefone;
  }

  if (!cpfValido(dados.cpf)) {
    return pedir('CPF');
  }

  if (!cepValido(dados.cep)) {
    return pedir('CEP');
  }

  const placa = decidirPlaca(dados, respostas);
  if (placa !== null) {
    return placa;
  }

  return { tipo: 'QUALIFICADO' };
}

/** A etapa da jornada que a decisão implica (blueprint §8.1). */
export function etapaDaDecisao(
  decisao: Decisao,
): 'EM_VALIDACAO' | 'AGUARDANDO_DADO' | 'QUALIFICADO' {
  if (decisao.tipo === 'QUALIFICADO') {
    return 'QUALIFICADO';
  }
  if (decisao.tipo === 'CONSULTAR') {
    return 'EM_VALIDACAO';
  }
  return 'AGUARDANDO_DADO';
}
