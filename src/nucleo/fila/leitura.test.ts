import { describe, expect, it } from 'vitest';
import { montarLinhaDaFila, montarLinhasDaFila } from './leitura';

const AGORA = new Date('2026-08-26T15:00:00.000Z');

function bruto(ajuste: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'oportunidade-1',
    entrou_na_fila_em: '2026-08-26T14:56:00.000Z',
    contato: { nome: 'Marina Duarte' },
    qualificacao: { intencao: 'QUENTE', completude: 'COMPLETO', preocupacao_principal: 'TODAS' },
    risco_veiculo: { marca: 'Chevrolet', modelo: 'Tracker', ano_modelo: 2024 },
    cotacao: [{ status: 'RETORNADA' }],
    pendencia: [{ descricao: 'Confirmar CEP', prazo: '2026-08-27T12:00:00.000Z' }],
    ...ajuste,
  };
}

describe('a linha da fila', () => {
  it('traduz o que a consulta devolveu', () => {
    expect(montarLinhaDaFila(bruto(), AGORA)).toEqual({
      id: 'oportunidade-1',
      nome: 'Marina Duarte',
      entrouNaFilaEm: new Date('2026-08-26T14:56:00.000Z'),
      intencao: 'QUENTE',
      completude: 'COMPLETO',
      preocupacao: 'TODAS',
      veiculo: { marca: 'Chevrolet', modelo: 'Tracker', anoModelo: 2024 },
      cotada: true,
      planoDeInteresse: null,
      pendencia: { descricao: 'Confirmar CEP', vencida: false },
    });
  });

  it('lê relação de um tanto como objeto quanto como lista', () => {
    // O PostgREST alterna entre as duas formas conforme a consulta; ler as duas
    // é mais barato que confiar numa.
    const comoLista = montarLinhaDaFila(
      bruto({ contato: [{ nome: 'Rafael Nunes' }], qualificacao: [{ intencao: 'MORNA' }] }),
      AGORA,
    );

    expect(comoLista?.nome).toBe('Rafael Nunes');
    expect(comoLista?.intencao).toBe('MORNA');
  });

  it('sem qualificação calculada, o lead é frio — nunca quente por omissão', () => {
    // Quente por omissão furaria a fila de quem demonstrou intenção de verdade.
    const linha = montarLinhaDaFila(bruto({ qualificacao: null }), AGORA);

    expect(linha?.intencao).toBe('FRIA');
    expect(linha?.completude).toBe('PENDENTE');
    expect(linha?.preocupacao).toBeNull();
  });

  it('intenção desconhecida também cai em fria', () => {
    expect(
      montarLinhaDaFila(bruto({ qualificacao: { intencao: 'FERVENDO' } }), AGORA)?.intencao,
    ).toBe('FRIA');
  });

  it('preocupação fora do catálogo é ignorada', () => {
    expect(
      montarLinhaDaFila(bruto({ qualificacao: { preocupacao_principal: 'OUTRA' } }), AGORA)
        ?.preocupacao,
    ).toBeNull();
  });

  it('cotação só conta quando a seguradora respondeu', () => {
    // Dizer "já temos sua cotação" sobre um pedido que não voltou queima a
    // confiança na primeira frase.
    expect(montarLinhaDaFila(bruto({ cotacao: [{ status: 'SOLICITADA' }] }), AGORA)?.cotada).toBe(
      false,
    );
    expect(montarLinhaDaFila(bruto({ cotacao: [] }), AGORA)?.cotada).toBe(false);
    expect(montarLinhaDaFila(bruto({ cotacao: null }), AGORA)?.cotada).toBe(false);
  });

  it('mais de uma cotação, basta uma ter voltado', () => {
    const linha = montarLinhaDaFila(
      bruto({ cotacao: [{ status: 'FALHOU' }, { status: 'RETORNADA' }] }),
      AGORA,
    );
    expect(linha?.cotada).toBe(true);
  });

  it('veículo sem ano ainda é veículo', () => {
    const linha = montarLinhaDaFila(
      bruto({ risco_veiculo: { marca: 'Fiat', modelo: 'Argo', ano_modelo: null } }),
      AGORA,
    );

    expect(linha?.veiculo).toEqual({ marca: 'Fiat', modelo: 'Argo', anoModelo: null });
  });

  it('sem risco cadastrado, não há veículo', () => {
    expect(montarLinhaDaFila(bruto({ risco_veiculo: null }), AGORA)?.veiculo).toBeNull();
    expect(montarLinhaDaFila(bruto({ risco_veiculo: [] }), AGORA)?.veiculo).toBeNull();
  });

  it('pendência com prazo passado vem marcada como vencida', () => {
    const linha = montarLinhaDaFila(
      bruto({ pendencia: [{ descricao: 'Enviar CNH', prazo: '2026-08-20T00:00:00.000Z' }] }),
      AGORA,
    );

    expect(linha?.pendencia).toEqual({ descricao: 'Enviar CNH', vencida: true });
  });

  it('pendência sem prazo não é vencida', () => {
    const linha = montarLinhaDaFila(
      bruto({ pendencia: [{ descricao: 'Confirmar telefone', prazo: null }] }),
      AGORA,
    );

    expect(linha?.pendencia?.vencida).toBe(false);
  });

  it('sem pendência aberta, não há pendência', () => {
    expect(montarLinhaDaFila(bruto({ pendencia: [] }), AGORA)?.pendencia).toBeNull();
    expect(montarLinhaDaFila(bruto({ pendencia: [{ prazo: null }] }), AGORA)?.pendencia).toBeNull();
  });

  it('contato sem nome não deixa o cartão sem título', () => {
    expect(montarLinhaDaFila(bruto({ contato: null }), AGORA)?.nome).toBe('Cliente sem nome');
  });

  it('quem ainda não entrou na fila não tem espera', () => {
    expect(montarLinhaDaFila(bruto({ entrou_na_fila_em: null }), AGORA)?.entrouNaFilaEm).toBeNull();
  });

  it('linha sem id não vira cartão', () => {
    expect(montarLinhaDaFila(bruto({ id: null }), AGORA)).toBeNull();
    expect(montarLinhaDaFila(null, AGORA)).toBeNull();
    expect(montarLinhaDaFila('texto solto', AGORA)).toBeNull();
  });
});

describe('a lista da fila', () => {
  it('traduz cada linha na ordem em que veio', () => {
    const linhas = montarLinhasDaFila([bruto(), bruto({ id: 'oportunidade-2' })], AGORA);
    expect(linhas.map((l) => l.id)).toEqual(['oportunidade-1', 'oportunidade-2']);
  });

  it('uma linha ruim some da lista em vez de derrubar a tela', () => {
    // Uma fila com nove cartões é melhor que um erro com dez.
    const linhas = montarLinhasDaFila([bruto({ id: null }), bruto({ id: 'boa' })], AGORA);
    expect(linhas.map((l) => l.id)).toEqual(['boa']);
  });

  it('resposta que não é lista vira lista vazia', () => {
    expect(montarLinhasDaFila(null, AGORA)).toEqual([]);
    expect(montarLinhasDaFila({ erro: 'algo' }, AGORA)).toEqual([]);
  });
});
