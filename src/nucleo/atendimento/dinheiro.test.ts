import { describe, expect, it } from 'vitest';
import { emReais } from './dinheiro';

describe('dinheiro na tela', () => {
  it.each([
    [0, 'R$ 0,00'],
    [7.5, 'R$ 7,50'],
    [99.99, 'R$ 99,99'],
    [1234.56, 'R$ 1.234,56'],
    [12345.6, 'R$ 12.345,60'],
    [1234567.89, 'R$ 1.234.567,89'],
  ])('%s vira "%s"', (valor, esperado) => {
    expect(emReais(valor)).toBe(esperado);
  });

  it('usa espaço comum, não o fino do Intl', () => {
    // O fino é invisível na tela e some do teste que procura "R$ 1.234,56".
    expect(emReais(1234.56)).toContain('R$ 1');
    expect(emReais(1234.56)?.charCodeAt(2)).toBe(32);
  });

  it('arredonda o centavo em vez de truncar', () => {
    expect(emReais(10.005)).toBe('R$ 10,01');
    expect(emReais(10.004)).toBe('R$ 10,00');
  });

  it('negativo mantém o sinal antes do símbolo', () => {
    expect(emReais(-250)).toBe('-R$ 250,00');
  });

  it('sem valor não vira "R$ 0,00"', () => {
    // Zero mentiria sobre um plano cujo preço a seguradora não informou.
    expect(emReais(null)).toBeNull();
    expect(emReais(undefined)).toBeNull();
    expect(emReais(Number.NaN)).toBeNull();
    expect(emReais(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
