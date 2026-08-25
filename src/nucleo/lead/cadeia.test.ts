import { describe, expect, it } from 'vitest';
import { etapaDaDecisao, proximoPasso } from './cadeia';
import type { DadosDoLead, RespostasExternas } from './cadeia';

// Dados sintéticos (AGENTS.md, invariante 10).
const COMPLETO: DadosDoLead = {
  telefone: '11999998888',
  cpf: '529.982.247-25',
  cep: '03525-000',
  placa: 'BRA1A23',
};

const RESPONDIDO: RespostasExternas = { temWhatsapp: true, modelosDaPlaca: 1 };

describe('ordem da cadeia', () => {
  it('sem nada, começa pelo telefone', () => {
    expect(proximoPasso({})).toEqual({ tipo: 'PEDIR_DADO', passo: 'TELEFONE', campo: 'telefone' });
  });

  it('com telefone válido, consulta o WhatsApp antes de seguir', () => {
    expect(proximoPasso({ telefone: '11999998888' })).toEqual({
      tipo: 'CONSULTAR',
      passo: 'TELEFONE',
      valor: '+5511999998888',
    });
  });

  it('respondido o WhatsApp, cobra o CPF', () => {
    expect(proximoPasso({ telefone: '11999998888' }, { temWhatsapp: true })).toEqual({
      tipo: 'PEDIR_DADO',
      passo: 'CPF',
      campo: 'cpf',
    });
  });

  it('com CPF, cobra o CEP', () => {
    const dados = { telefone: '11999998888', cpf: COMPLETO.cpf };
    expect(proximoPasso(dados, { temWhatsapp: true })).toEqual({
      tipo: 'PEDIR_DADO',
      passo: 'CEP',
      campo: 'cep',
    });
  });

  it('com CEP, cobra a placa', () => {
    const dados = { ...COMPLETO, placa: undefined };
    expect(proximoPasso(dados, { temWhatsapp: true })).toEqual({
      tipo: 'PEDIR_DADO',
      passo: 'PLACA',
      campo: 'placa',
    });
  });

  it('com placa válida, consulta o modelo', () => {
    expect(proximoPasso(COMPLETO, { temWhatsapp: true })).toEqual({
      tipo: 'CONSULTAR',
      passo: 'PLACA',
      valor: 'BRA1A23',
    });
  });

  it('com tudo respondido, qualifica', () => {
    expect(proximoPasso(COMPLETO, RESPONDIDO)).toEqual({ tipo: 'QUALIFICADO' });
  });
});

describe('pede um dado por vez', () => {
  it('mesmo faltando três, cobra só o primeiro da ordem', () => {
    // Reabrir o formulário inteiro faz o cliente desistir.
    const decisao = proximoPasso({ telefone: '11999998888' }, { temWhatsapp: true });
    expect(decisao).toEqual({ tipo: 'PEDIR_DADO', passo: 'CPF', campo: 'cpf' });
  });

  it('dado inválido é tratado como ausente', () => {
    const decisao = proximoPasso({ ...COMPLETO, cpf: '529.982.247-26' }, RESPONDIDO);
    expect(decisao).toEqual({ tipo: 'PEDIR_DADO', passo: 'CPF', campo: 'cpf' });
  });
});

describe('desvios da cadeia', () => {
  it('sem WhatsApp, a jornada troca de canal em vez de parar', () => {
    expect(proximoPasso(COMPLETO, { temWhatsapp: false })).toEqual({ tipo: 'SEGUIR_POR_EMAIL' });
  });

  it('mais de um modelo devolve a escolha ao cliente', () => {
    // Escolher por conta própria contaminaria a cotação inteira.
    expect(proximoPasso(COMPLETO, { temWhatsapp: true, modelosDaPlaca: 2 })).toEqual({
      tipo: 'DESAMBIGUAR_MODELO',
    });
  });

  it('nenhum modelo encontrado volta a pedir a placa', () => {
    expect(proximoPasso(COMPLETO, { temWhatsapp: true, modelosDaPlaca: 0 })).toEqual({
      tipo: 'PEDIR_DADO',
      passo: 'PLACA',
      campo: 'placa',
    });
  });

  it('telefone mal formado nem chega a consultar o WhatsApp', () => {
    expect(proximoPasso({ ...COMPLETO, telefone: '999' }, RESPONDIDO)).toEqual({
      tipo: 'PEDIR_DADO',
      passo: 'TELEFONE',
      campo: 'telefone',
    });
  });
});

describe('etapaDaDecisao', () => {
  it('consultar mantém a oportunidade em validação', () => {
    expect(etapaDaDecisao({ tipo: 'CONSULTAR', passo: 'CPF', valor: 'x' })).toBe('EM_VALIDACAO');
  });

  it('qualificado avança a etapa', () => {
    expect(etapaDaDecisao({ tipo: 'QUALIFICADO' })).toBe('QUALIFICADO');
  });

  it.each([
    [{ tipo: 'PEDIR_DADO', passo: 'CPF', campo: 'cpf' } as const],
    [{ tipo: 'SEGUIR_POR_EMAIL' } as const],
    [{ tipo: 'DESAMBIGUAR_MODELO' } as const],
  ])('%o aguarda o cliente', (decisao) => {
    expect(etapaDaDecisao(decisao)).toBe('AGUARDANDO_DADO');
  });
});
