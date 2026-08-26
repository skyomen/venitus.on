/**
 * Leitura de valores que vieram do banco como `unknown`.
 *
 * O cliente do Supabase entrega `jsonb` e composto sem tipo, e confiar no
 * formato é o que faz um `undefined` virar `"undefined"` dentro da mensagem que
 * chega ao cliente. Cada leitor aqui devolve o valor ou o vazio — nunca lança.
 */

export function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

export function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

export function inteiro(valor: unknown, padrao: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.trunc(valor) : padrao;
}

export function booleano(valor: unknown): boolean {
  return valor === true;
}

/** Data inválida é indistinguível de data ausente para quem decide. */
export function data(valor: unknown): Date | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    return null;
  }

  const convertida = new Date(valor);
  return Number.isNaN(convertida.getTime()) ? null : convertida;
}
