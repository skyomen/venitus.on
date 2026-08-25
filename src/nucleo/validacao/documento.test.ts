import { describe, expect, it } from 'vitest';
import {
  cepValido,
  cpfValido,
  normalizarCep,
  normalizarPlaca,
  normalizarTelefone,
  placaValida,
} from './documento';

// Todos os documentos abaixo são sintéticos (AGENTS.md, invariante 10).

describe('cpfValido', () => {
  it.each([['529.982.247-25'], ['52998224725'], ['168.995.350-09']])('aceita %s', (cpf) => {
    expect(cpfValido(cpf)).toBe(true);
  });

  it('aceita CPF cujo verificador vem do resto 10', () => {
    // Resto 10 vira dígito 0. Sem esse caso, o ramo nunca é exercitado e um erro
    // ali recusaria CPFs legítimos em silêncio.
    expect(cpfValido('00000000604')).toBe(true);
  });

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('529.982.247-26')).toBe(false);
  });

  it('recusa sequência repetida, que passa na aritmética', () => {
    // 111.111.111-11 fecha o cálculo dos verificadores; só a regra explícita barra.
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('00000000000')).toBe(false);
  });

  it.each([['5299822472'], ['529982247250'], ['']])('recusa %s por tamanho', (cpf) => {
    expect(cpfValido(cpf)).toBe(false);
  });

  it.each([[null], [undefined], [52998224725], [{}]])('recusa o tipo %s', (valor: unknown) => {
    expect(cpfValido(valor)).toBe(false);
  });
});

describe('cepValido', () => {
  it.each([['03525-000'], ['03525000']])('aceita %s', (cep) => {
    expect(cepValido(cep)).toBe(true);
  });

  it.each([['0352500'], ['035250000'], [''], [null], [3525000]])('recusa %s', (valor: unknown) => {
    expect(cepValido(valor)).toBe(false);
  });

  it('normaliza para só dígitos', () => {
    expect(normalizarCep('03525-000')).toBe('03525000');
  });
});

describe('placaValida', () => {
  it.each([['ABC-1234'], ['ABC1234'], ['abc1234']])('aceita o formato antigo %s', (placa) => {
    expect(placaValida(placa)).toBe(true);
  });

  it.each([['BRA1A23'], ['bra1a23'], ['BRA-1A23']])('aceita o Mercosul %s', (placa) => {
    // Os dois formatos convivem, e o antigo continua válido.
    expect(placaValida(placa)).toBe(true);
  });

  it.each([['AB1234'], ['ABCD123'], ['ABC12A3'], [''], [null], [1234567]])(
    'recusa %s',
    (valor: unknown) => {
      expect(placaValida(valor)).toBe(false);
    },
  );

  it('normaliza para caixa alta sem separador', () => {
    expect(normalizarPlaca('bra-1a23')).toBe('BRA1A23');
  });
});

describe('normalizarTelefone', () => {
  it.each([
    ['11999998888', '+5511999998888'],
    ['(11) 99999-8888', '+5511999998888'],
    ['+55 11 99999-8888', '+5511999998888'],
    ['5511999998888', '+5511999998888'],
    ['011999998888', '+5511999998888'],
  ])('normaliza %s', (entrada, esperado) => {
    // O mesmo número escrito de dois jeitos criaria dois contatos.
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it('aceita fixo de dez dígitos', () => {
    expect(normalizarTelefone('1133334444')).toBe('+551133334444');
  });

  it('recusa celular de onze dígitos sem o nono', () => {
    expect(normalizarTelefone('11833334444')).toBeNull();
  });

  it.each([['999998888'], ['119999988887'], ['0999998888']])(
    'recusa %s por tamanho',
    (telefone) => {
      expect(normalizarTelefone(telefone)).toBeNull();
    },
  );

  it('recusa DDD inexistente', () => {
    expect(normalizarTelefone('0999998888')).toBeNull();
    expect(normalizarTelefone('1099998888')).toBeNull();
  });

  it.each([[null], [undefined], [11999998888], [{}]])('recusa o tipo %s', (valor: unknown) => {
    expect(normalizarTelefone(valor)).toBeNull();
  });
});
