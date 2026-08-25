import { afterEach, describe, expect, it } from 'vitest';
import {
  MODOS,
  ehModoDados,
  interpretarModo,
  modoDeDados,
  permiteEscrita,
  rotuloDoModo,
} from './modo-dados';

const original = process.env['MODO_DADOS'];

afterEach(() => {
  process.env['MODO_DADOS'] = original;
});

describe('ehModoDados', () => {
  it.each(MODOS)('reconhece %s', (modo) => {
    expect(ehModoDados(modo)).toBe(true);
  });

  it.each([['homologacao'], [''], [null], [undefined], [7]])('recusa %s', (valor: unknown) => {
    expect(ehModoDados(valor)).toBe(false);
  });
});

describe('interpretarModo', () => {
  it('mantém um modo conhecido', () => {
    expect(interpretarModo('espelho')).toBe('espelho');
  });

  it.each([[undefined], [''], ['inventado']])(
    'assume produção quando o valor é %s',
    (valor: unknown) => {
      // Errar para o lado seguro: tratar produção como sintético é o erro caro.
      expect(interpretarModo(valor)).toBe('producao');
    },
  );
});

describe('modoDeDados', () => {
  it('lê a variável de ambiente', () => {
    process.env['MODO_DADOS'] = 'sintetico';
    expect(modoDeDados()).toBe('sintetico');
  });

  it('sem variável, assume produção', () => {
    delete process.env['MODO_DADOS'];
    expect(modoDeDados()).toBe('producao');
  });
});

describe('rótulo', () => {
  it.each(MODOS)('%s tem rótulo não vazio', (modo) => {
    expect(rotuloDoModo(modo).length).toBeGreaterThan(0);
  });

  it('o rótulo de leitura de produção avisa que é produção', () => {
    expect(rotuloDoModo('producao-leitura')).toContain('PRODUÇÃO');
  });
});

describe('permiteEscrita', () => {
  it('bloqueia escrita apenas na leitura de produção', () => {
    expect(permiteEscrita('producao-leitura')).toBe(false);
    expect(permiteEscrita('sintetico')).toBe(true);
    expect(permiteEscrita('espelho')).toBe(true);
    expect(permiteEscrita('producao')).toBe(true);
  });
});
