import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Quem pode acordar o worker.
 *
 * O tique é uma rota HTTP, e uma rota HTTP é uma porta aberta na internet. Sem
 * autorização, qualquer um dispara a drenagem quantas vezes quiser — e cada
 * disparo é uma mensagem a mais na conta do WhatsApp do cliente.
 *
 * A Vercel envia `Authorization: Bearer <CRON_SECRET>` nas rotas agendadas
 * (`vercel.json`). É esse cabeçalho que se confere aqui.
 */

const PREFIXO = 'Bearer ';

/**
 * Comparação em tempo constante.
 *
 * Comparar com `===` vaza o número de bytes corretos pelo tempo de resposta, e
 * com isso o segredo pode ser descoberto byte a byte. O HMAC iguala o
 * comprimento dos dois lados antes da comparação, para que nem o tamanho vaze.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  const chave = 'venitus:cron';
  const primeiro = createHmac('sha256', chave).update(a, 'utf8').digest();
  const segundo = createHmac('sha256', chave).update(b, 'utf8').digest();

  return timingSafeEqual(primeiro, segundo);
}

export function cronAutorizado(cabecalho: unknown, segredo: string | undefined): boolean {
  // Segredo ausente nega tudo. Aceitar sem segredo configurado transformaria um
  // erro de implantação numa porta aberta.
  if (segredo === undefined || segredo === '') {
    return false;
  }
  if (typeof cabecalho !== 'string' || !cabecalho.startsWith(PREFIXO)) {
    return false;
  }

  return iguaisEmTempoConstante(cabecalho.slice(PREFIXO.length), segredo);
}
