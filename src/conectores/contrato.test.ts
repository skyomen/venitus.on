import { describe, expect, it } from 'vitest';
import { MOTIVOS_FALHA, falha, sucesso, valeTentarDeNovo } from './contrato';

describe('Resultado', () => {
  it('sucesso carrega valor e origem', () => {
    const resultado = sucesso({ nome: 'Ana' }, 'STUB');

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.origem).toBe('STUB');
      expect(resultado.valor.nome).toBe('Ana');
    }
  });

  it('falha carrega motivo e detalhe', () => {
    const resultado = falha('RECUSADO', 'a seguradora não aceita o risco');

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toBe('RECUSADO');
      expect(resultado.falha.campo).toBeUndefined();
    }
  });

  it('falha aponta o campo quando ele é conhecido', () => {
    const resultado = falha('DADO_FALTANTE', 'sem CEP', 'cep');

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.campo).toBe('cep');
    }
  });
});

describe('valeTentarDeNovo', () => {
  it.each([['INDISPONIVEL'], ['DISJUNTOR_ABERTO']] as const)(
    'reexecuta quando a falha foi do caminho (%s)',
    (motivo) => {
      expect(valeTentarDeNovo({ motivo, detalhe: '' })).toBe(true);
    },
  );

  it.each([
    ['PAYLOAD_INVALIDO'],
    ['RECUSADO'],
    ['DADO_FALTANTE'],
    ['AGUARDANDO_CONECTOR'],
  ] as const)('não reexecuta quando a falha foi do conteúdo (%s)', (motivo) => {
    // Insistir num payload inválido só gasta chamada e enche o log.
    expect(valeTentarDeNovo({ motivo, detalhe: '' })).toBe(false);
  });

  it('todo motivo conhecido tem decisão de reexecução', () => {
    for (const motivo of MOTIVOS_FALHA) {
      expect(typeof valeTentarDeNovo({ motivo, detalhe: '' })).toBe('boolean');
    }
  });
});
