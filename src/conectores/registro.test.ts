import { describe, expect, it } from 'vitest';
import { obterCanalWhatsapp, obterCrm, obterValidadores } from './registro';

/**
 * O registro tem uma regra só, e ela vale para as três famílias: pedir uma
 * implementação que não existe falha na hora. Recuo silencioso para o stub faria
 * a corretora operar sintética achando que está em produção.
 */
const FAMILIAS = [
  ['validadores', obterValidadores],
  ['whatsapp', obterCanalWhatsapp],
  ['crm', obterCrm],
] as const;

describe('registro de conectores', () => {
  it.each(FAMILIAS)('%s devolve o stub quando o stub é o configurado', (_nome, obter) => {
    expect(obter('stub')).toBeDefined();
  });

  it.each(FAMILIAS)('%s recusa "real" enquanto a API não existe', (nome, obter) => {
    expect(() => obter('real')).toThrow(new RegExp(`Conector de ${nome} "real"`));
  });

  it.each(FAMILIAS)('%s diz o que fazer em vez de só reclamar', (_nome, obter) => {
    expect(() => obter('real')).toThrow(/Configure a corretora para "stub"/);
  });
});
