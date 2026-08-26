import { describe, expect, it } from 'vitest';
import { cronAutorizado } from './cron';

const SEGREDO = 'segredo-de-cron-sintetico';

describe('quem pode acordar o worker', () => {
  it('aceita o cabeçalho que a Vercel envia', () => {
    expect(cronAutorizado(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true);
  });

  it('recusa segredo errado', () => {
    expect(cronAutorizado('Bearer outro-segredo', SEGREDO)).toBe(false);
  });

  it('recusa segredo com o mesmo começo', () => {
    // Comparação byte a byte que para no primeiro erro deixaria descobrir o
    // segredo pelo tempo de resposta.
    expect(cronAutorizado(`Bearer ${SEGREDO}-a-mais`, SEGREDO)).toBe(false);
  });

  it('recusa sem o prefixo Bearer', () => {
    expect(cronAutorizado(SEGREDO, SEGREDO)).toBe(false);
  });

  it('recusa cabeçalho ausente', () => {
    expect(cronAutorizado(null, SEGREDO)).toBe(false);
  });

  it('recusa cabeçalho que não é texto', () => {
    expect(cronAutorizado(42, SEGREDO)).toBe(false);
  });

  it('sem segredo configurado, nega tudo', () => {
    // Erro de implantação não pode virar porta aberta.
    expect(cronAutorizado(`Bearer ${SEGREDO}`, undefined)).toBe(false);
    expect(cronAutorizado('Bearer ', '')).toBe(false);
  });
});
