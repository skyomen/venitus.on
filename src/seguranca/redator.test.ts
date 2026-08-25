import { describe, expect, it } from 'vitest';
import { ehChaveSensivel, redigir, redigirTexto } from './redator';

// Todos os documentos abaixo são sintéticos (AGENTS.md, invariante 10).

describe('redigirTexto', () => {
  it('oculta CPF com e sem formatação', () => {
    expect(redigirTexto('cliente 111.222.333-44')).toBe('cliente [cpf]');
    expect(redigirTexto('cliente 11122233344')).toBe('cliente [cpf]');
  });

  it('oculta CNPJ sem deixar a regra de CPF consumir parte dele', () => {
    expect(redigirTexto('empresa 11.222.333/0001-44')).toBe('empresa [cnpj]');
    expect(redigirTexto('empresa 11222333000144')).toBe('empresa [cnpj]');
  });

  it('oculta telefone em formatos comuns', () => {
    expect(redigirTexto('ligar +55 11 99999-8888')).toBe('ligar [telefone]');
    expect(redigirTexto('ligar (11) 99999-8888')).toBe('ligar [telefone]');
    expect(redigirTexto('ligar 1199998888')).toBe('ligar [telefone]');
  });

  it('oculta e-mail', () => {
    expect(redigirTexto('falar com joao.silva+tag@exemplo.com.br')).toBe('falar com [email]');
  });

  it('oculta placa antiga e Mercosul', () => {
    expect(redigirTexto('veiculo ABC-1234')).toBe('veiculo [placa]');
    expect(redigirTexto('veiculo ABC1D23')).toBe('veiculo [placa]');
  });

  it('oculta o valor de um cabeçalho de autorização', () => {
    expect(redigirTexto('Authorization: Bearer abc.def-123')).toBe(
      'Authorization: Bearer [oculto]',
    );
  });

  it('preserva texto sem dado pessoal', () => {
    expect(redigirTexto('oportunidade movida para NA_FILA')).toBe(
      'oportunidade movida para NA_FILA',
    );
  });

  it('oculta várias ocorrências na mesma linha', () => {
    expect(redigirTexto('11122233344 e 55566677788')).toBe('[cpf] e [cpf]');
  });
});

describe('ehChaveSensivel', () => {
  it('reconhece a chave exata e a composta, sem depender de caixa', () => {
    expect(ehChaveSensivel('cpf')).toBe(true);
    expect(ehChaveSensivel('userCPF')).toBe(true);
    expect(ehChaveSensivel('Authorization')).toBe(true);
    expect(ehChaveSensivel('numero_apolice')).toBe(true);
  });

  it('não marca chave inofensiva', () => {
    expect(ehChaveSensivel('etapa')).toBe(false);
    expect(ehChaveSensivel('corretora_id')).toBe(false);
  });
});

describe('redigir', () => {
  it('oculta campo sensível pelo nome, sem olhar o formato do valor', () => {
    expect(redigir({ cpf: 'valor em formato inesperado', etapa: 'NA_FILA' })).toEqual({
      cpf: '[oculto]',
      etapa: 'NA_FILA',
    });
  });

  it('redige texto livre dentro de campo não sensível', () => {
    expect(redigir({ observacao: 'cliente 11122233344 retornou' })).toEqual({
      observacao: 'cliente [cpf] retornou',
    });
  });

  it('percorre objeto aninhado e lista', () => {
    const entrada = {
      contato: { nome: 'Maria', telefone: '11999998888' },
      eventos: [{ observacao: 'enviado para maria@exemplo.com.br' }],
    };
    expect(redigir(entrada)).toEqual({
      contato: { nome: 'Maria', telefone: '[oculto]' },
      eventos: [{ observacao: 'enviado para [email]' }],
    });
  });

  it('redige a mensagem de um erro e descarta a pilha', () => {
    expect(redigir(new Error('falha ao validar 11122233344'))).toEqual({
      nome: 'Error',
      mensagem: 'falha ao validar [cpf]',
    });
  });

  it('devolve valores primitivos inalterados', () => {
    expect(redigir(42)).toBe(42);
    expect(redigir(true)).toBe(true);
    expect(redigir(null)).toBeNull();
    expect(redigir(undefined)).toBeUndefined();
  });
});
