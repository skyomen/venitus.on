import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verificação de assinatura de webhook (blueprint §10.4).
 *
 * A assinatura é conferida **antes** de qualquer processamento. Um webhook é uma
 * porta aberta na internet: sem isso, qualquer um cria leads na plataforma.
 */

/**
 * Comparação em tempo constante.
 *
 * Comparar com `===` vaza o número de bytes corretos pelo tempo de resposta, e
 * com isso a assinatura pode ser descoberta byte a byte.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  const primeiro = Buffer.from(a, 'utf8');
  const segundo = Buffer.from(b, 'utf8');

  if (primeiro.length !== segundo.length) {
    return false;
  }
  return timingSafeEqual(primeiro, segundo);
}

export function assinar(corpo: string, segredo: string): string {
  return createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex');
}

export function assinaturaConfere(
  corpo: string,
  assinaturaRecebida: unknown,
  segredo: string | undefined,
): boolean {
  // Segredo ausente nega tudo. Aceitar sem segredo configurado transformaria um
  // erro de implantação numa porta aberta.
  if (segredo === undefined || segredo === '') {
    return false;
  }
  if (typeof assinaturaRecebida !== 'string' || assinaturaRecebida === '') {
    return false;
  }

  return iguaisEmTempoConstante(assinar(corpo, segredo), assinaturaRecebida);
}

export interface LeadRecebido {
  readonly chaveCanal: string;
  readonly nome: string;
  readonly telefone: string | null;
  readonly cpf: string | null;
  readonly idEvento: string | null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

/**
 * Interpreta o corpo de um lead.
 *
 * O tenant **não** sai daqui: ele vem do canal, resolvido no banco (§6.8). O
 * corpo só diz por qual porta o lead entrou, e quem é a pessoa.
 */
export function interpretarLead(corpo: unknown): LeadRecebido | null {
  if (typeof corpo !== 'object' || corpo === null) {
    return null;
  }

  const dados = corpo as Record<string, unknown>;
  const chaveCanal = texto(dados['canal']);
  const nome = texto(dados['nome']);

  if (chaveCanal === null || nome === null) {
    return null;
  }

  return {
    chaveCanal,
    nome,
    telefone: texto(dados['telefone']),
    cpf: texto(dados['cpf']),
    idEvento: texto(dados['id_evento']),
  };
}
