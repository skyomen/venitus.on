import { describe, expect, it } from 'vitest';
import { booleano, data, inteiro, objeto, texto } from './leitura';

describe('objeto', () => {
  it('aceita objeto', () => {
    expect(objeto({ a: 1 })).toEqual({ a: 1 });
  });

  it('recusa nulo, lista e primitivo', () => {
    expect(objeto(null)).toBeNull();
    expect(objeto([1, 2])).toBeNull();
    expect(objeto('texto')).toBeNull();
  });
});

describe('texto', () => {
  it('devolve o texto quando há texto', () => {
    expect(texto('+5511999999999')).toBe('+5511999999999');
  });

  it('vazio e não-texto viram ausência', () => {
    expect(texto('')).toBeNull();
    expect(texto(7)).toBeNull();
    expect(texto(undefined)).toBeNull();
  });
});

describe('inteiro', () => {
  it('trunca em vez de arredondar', () => {
    // Minuto do dia com fração viraria comparação instável na borda da janela.
    expect(inteiro(540.9, 0)).toBe(540);
  });

  it('cai no padrão para o que não é número finito', () => {
    expect(inteiro('540', 0)).toBe(0);
    expect(inteiro(Number.NaN, -1)).toBe(-1);
    expect(inteiro(Number.POSITIVE_INFINITY, -1)).toBe(-1);
  });
});

describe('booleano', () => {
  it('só o verdadeiro é verdadeiro', () => {
    // Consentimento é o caso: "quase verdadeiro" tem de valer não.
    expect(booleano(true)).toBe(true);
    expect(booleano('true')).toBe(false);
    expect(booleano(1)).toBe(false);
    expect(booleano(null)).toBe(false);
  });
});

describe('data', () => {
  it('lê o formato que o Postgres devolve', () => {
    expect(data('2026-08-26T12:00:00.000Z')?.toISOString()).toBe('2026-08-26T12:00:00.000Z');
  });

  it('aceita milissegundos', () => {
    expect(data(0)?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });

  it('data inválida é indistinguível de ausente', () => {
    expect(data('ontem à tarde')).toBeNull();
    expect(data(null)).toBeNull();
    expect(data({ ano: 2026 })).toBeNull();
  });
});
