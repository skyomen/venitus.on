import { describe, expect, it } from 'vitest';
import { criarWhatsappQueEntrega, criarWhatsappStub } from './stub';
import type { CanalWhatsapp } from './contrato';

/**
 * Teste de contrato do canal de WhatsApp (blueprint §21.3).
 *
 * As duas implementações validam a entrada do mesmo jeito. O que muda é o
 * desfecho: o stub honesto guarda para reprocessar, o que finge entrega devolve
 * sucesso — e o teste cobra os dois comportamentos separadamente.
 */
const IMPLEMENTACOES: readonly (readonly [string, () => CanalWhatsapp])[] = [
  ['stub', criarWhatsappStub],
  ['stub que entrega', criarWhatsappQueEntrega],
];

const TELEFONE = '+5511999998888';

describe.each(IMPLEMENTACOES)('canal: %s', (_nome, criar) => {
  const canal = criar();

  it.each([
    ['11999998888'], // sem o prefixo internacional
    ['+5511999988'], // curto demais para DDD e número
    ['+55119999988887'], // longo demais
    [''],
    ['+1555123456789'], // fora do Brasil
  ])('recusa destino fora de E.164 (%s)', async (telefoneE164) => {
    // Texto e template conferem o destino com o mesmo rigor: um caminho mais
    // frouxo que o outro deixaria a mensagem falhar só no provedor.
    const porTexto = await canal.enviarTexto({
      chaveIdempotencia: 'k1',
      payload: { telefoneE164, texto: 'olá' },
    });
    const porTemplate = await canal.enviarTemplate({
      chaveIdempotencia: 'k1t',
      payload: { telefoneE164, template: '01_primeiro_contato', variaveis: {} },
    });

    for (const resultado of [porTexto, porTemplate]) {
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.falha.motivo).toBe('PAYLOAD_INVALIDO');
        expect(resultado.falha.campo).toBe('telefone');
      }
    }
  });

  it('aceita destino em E.164', async () => {
    const resultado = await canal.enviarTemplate({
      chaveIdempotencia: 'k2',
      payload: { telefoneE164: TELEFONE, template: '01_primeiro_contato', variaveis: {} },
    });

    // Aceito pelo contrato: o desfecho difere entre as implementações.
    if (!resultado.ok) {
      expect(resultado.falha.motivo).not.toBe('PAYLOAD_INVALIDO');
    }
  });
});

describe('stub honesto', () => {
  const canal = criarWhatsappStub();

  it('não finge entrega: guarda para reprocessar', async () => {
    // Fingir faria a régua avançar sobre mensagens que nunca saíram.
    const resultado = await canal.enviarTexto({
      chaveIdempotencia: 'k3',
      payload: { telefoneE164: TELEFONE, texto: 'olá' },
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toBe('AGUARDANDO_CONECTOR');
      expect(resultado.falha.detalhe).toContain('k3');
    }
  });

  it.each([[''], ['   ']])('recusa mensagem vazia (%s)', async (texto) => {
    const resultado = await canal.enviarTexto({
      chaveIdempotencia: 'k4',
      payload: { telefoneE164: TELEFONE, texto },
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.campo).toBe('texto');
    }
  });

  it('recusa texto acima do limite do provedor', async () => {
    const resultado = await canal.enviarTexto({
      chaveIdempotencia: 'k5',
      payload: { telefoneE164: TELEFONE, texto: 'a'.repeat(4097) },
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.campo).toBe('texto');
    }
  });

  it('recusa template não informado', async () => {
    const resultado = await canal.enviarTemplate({
      chaveIdempotencia: 'k6',
      payload: { telefoneE164: TELEFONE, template: '  ', variaveis: {} },
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.campo).toBe('template');
    }
  });
});

describe('stub que entrega', () => {
  const canal = criarWhatsappQueEntrega();

  it('devolve id externo derivado da chave de idempotência', async () => {
    // É o id externo que deduplica a reentrega do provedor.
    const resultado = await canal.enviarTexto({
      chaveIdempotencia: 'abertura:1',
      payload: { telefoneE164: TELEFONE, texto: 'olá' },
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.idExterno).toBe('stub:abertura:1');
      expect(resultado.origem).toBe('STUB');
    }
  });

  it('entrega template também', async () => {
    const resultado = await canal.enviarTemplate({
      chaveIdempotencia: 'abertura:2',
      payload: { telefoneE164: TELEFONE, template: '01_primeiro_contato', variaveis: {} },
    });

    expect(resultado.ok).toBe(true);
  });
});
