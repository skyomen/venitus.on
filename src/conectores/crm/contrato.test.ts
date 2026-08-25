import { describe, expect, it } from 'vitest';
import { criarCrmQueEspelha, criarCrmStub } from './stub';
import type { Crm, Espelhamento } from './contrato';

/**
 * Teste de contrato do CRM (blueprint §21.3).
 *
 * As duas implementações validam a entrada igual. O desfecho difere: o stub
 * honesto guarda para reprocessar, o que finge devolve sucesso.
 */
const IMPLEMENTACOES: readonly (readonly [string, () => Crm])[] = [
  ['stub', criarCrmStub],
  ['stub que espelha', criarCrmQueEspelha],
];

const OPORTUNIDADE = '00000000-0000-4000-8000-000000000abc';

function espelhamento(parcial: Partial<Espelhamento> = {}): Espelhamento {
  return {
    operacao: 'MOVER_ETAPA',
    oportunidadeId: OPORTUNIDADE,
    dados: { de: 'NOVO', para: 'EM_VALIDACAO' },
    ...parcial,
  };
}

describe.each(IMPLEMENTACOES)('crm: %s', (_nome, criar) => {
  const crm = criar();

  it('recusa operação desconhecida', async () => {
    const resultado = await crm.espelhar({
      chaveIdempotencia: 'k1',
      payload: espelhamento({ operacao: 'INVENTADA' as Espelhamento['operacao'] }),
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toBe('PAYLOAD_INVALIDO');
      expect(resultado.falha.campo).toBe('operacao');
    }
  });

  it('recusa mover etapa sem saber de qual oportunidade', async () => {
    const resultado = await crm.espelhar({
      chaveIdempotencia: 'k2',
      payload: espelhamento({ oportunidadeId: null }),
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.campo).toBe('oportunidadeId');
    }
  });

  it('aceita sincronizar contato sem oportunidade', async () => {
    // É a única operação que existe antes de haver negócio.
    const resultado = await crm.espelhar({
      chaveIdempotencia: 'k3',
      payload: espelhamento({ operacao: 'SINCRONIZAR_CONTATO', oportunidadeId: null }),
    });

    if (!resultado.ok) {
      expect(resultado.falha.motivo).not.toBe('PAYLOAD_INVALIDO');
    }
  });
});

describe('stub honesto', () => {
  it('não marca como espelhado o que não saiu', async () => {
    // Marcar criaria divergência silenciosa entre a plataforma e o CRM.
    const resultado = await criarCrmStub().espelhar({
      chaveIdempotencia: 'crm:etapa:1',
      payload: espelhamento(),
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toBe('AGUARDANDO_CONECTOR');
      expect(resultado.falha.detalhe).toContain('crm:etapa:1');
    }
  });
});

describe('stub que espelha', () => {
  it('devolve id externo para conciliação', async () => {
    const resultado = await criarCrmQueEspelha().espelhar({
      chaveIdempotencia: 'crm:etapa:2',
      payload: espelhamento(),
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.idExterno).toBe('crm-stub:crm:etapa:2');
    }
  });
});
