import { describe, expect, it } from 'vitest';
import { montarPainel } from './leitura';

const AGORA = new Date('2026-08-26T15:00:00.000Z');

function bruto(ajuste: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'oportunidade-1',
    etapa: 'EM_NEGOCIACAO',
    entrou_na_fila_em: '2026-08-26T14:30:00.000Z',
    opcao_interesse_id: 'opcao-2',
    contato: { nome: 'Marina Duarte' },
    qualificacao: { intencao: 'QUENTE', completude: 'COMPLETO', preocupacao_principal: 'TODAS' },
    risco_veiculo: { marca: 'Chevrolet', modelo: 'Tracker', ano_modelo: 2024 },
    cotacao: [
      {
        status: 'RETORNADA',
        seguradora: { nome: 'Seguradora Piloto' },
        cotacao_opcao: [
          { id: 'opcao-1', nome_plano: 'Essencial', premio: '1800.00', franquia: '4200.00' },
          { id: 'opcao-2', nome_plano: 'Compreensiva', premio: '2400.00', franquia: '3500.00' },
        ],
      },
    ],
    pendencia: [
      { id: 'p1', tipo: 'DOCUMENTO', descricao: 'Enviar CNH', prazo: null, status: 'ABERTA' },
      {
        id: 'p2',
        tipo: 'DADO_CADASTRAL',
        descricao: 'Confirmar CEP',
        prazo: '2026-08-20T00:00:00.000Z',
        status: 'RESOLVIDA',
      },
    ],
    oportunidade_evento: [
      {
        id: 'e1',
        tipo: 'TRANSICAO',
        de_etapa: 'ATRIBUIDO',
        para_etapa: 'EM_NEGOCIACAO',
        ator: 'CONSULTOR',
        motivo: null,
        ocorrido_em: '2026-08-26T14:50:00.000Z',
      },
    ],
    ...ajuste,
  };
}

describe('o painel de atendimento', () => {
  it('monta o cartão que o consultor já viu na fila', () => {
    const painel = montarPainel(bruto(), AGORA);

    expect(painel?.cartao.nome).toBe('Marina Duarte');
    expect(painel?.cartao.veiculo).toBe('Chevrolet Tracker 2024');
    expect(painel?.cartao.intencao).toBe('QUENTE');
  });

  it('a etapa vem com rótulo e tom', () => {
    expect(montarPainel(bruto(), AGORA)?.etapa).toEqual({
      rotulo: 'Em negociação',
      tom: 'neutro',
    });
  });

  it('etapa desconhecida não quebra a tela', () => {
    expect(montarPainel(bruto({ etapa: 'ETAPA_NOVA' }), AGORA)?.etapa.rotulo).toBe('Novo');
  });

  it('o plano escolhido entra no cartão, que é o que §9.5 pede', () => {
    const painel = montarPainel(bruto(), AGORA);

    expect(painel?.cartao.fatos).toContainEqual({
      rotulo: 'Plano de interesse',
      valor: 'Compreensiva',
    });
  });

  it('sem escolha, o cartão omite a linha em vez de mostrar traço', () => {
    const painel = montarPainel(bruto({ opcao_interesse_id: null }), AGORA);

    expect(painel?.cartao.fatos.map((f) => f.rotulo)).not.toContain('Plano de interesse');
  });

  it('só a pendência aberta vai para o cartão', () => {
    // A resolvida ficaria cobrando algo que o cliente já mandou.
    expect(montarPainel(bruto(), AGORA)?.cartao.pendencia?.texto).toBe('Enviar CNH');
  });

  it('a lista traz as duas, com a resolvida por último', () => {
    const painel = montarPainel(bruto(), AGORA);

    expect(painel?.pendencias.map((p) => [p.id, p.resolvida])).toEqual([
      ['p1', false],
      ['p2', true],
    ]);
  });

  it('as opções vêm das cotações, achatadas e ordenadas por preço', () => {
    const painel = montarPainel(bruto(), AGORA);

    expect(painel?.opcoes.map((o) => [o.nomePlano, o.premio, o.escolhida])).toEqual([
      ['Essencial', 'R$ 1.800,00', false],
      ['Compreensiva', 'R$ 2.400,00', true],
    ]);
  });

  it('lê o numeric que o PostgREST devolve como texto', () => {
    // Ele vem em texto para não perder precisão; tratar como número direto daria
    // "—" no lugar do preço.
    expect(montarPainel(bruto(), AGORA)?.opcoes[0]?.franquia).toBe('R$ 4.200,00');
  });

  it('a seguradora de cada cotação acompanha suas opções', () => {
    expect(montarPainel(bruto(), AGORA)?.opcoes[0]?.seguradora).toBe('Seguradora Piloto');
  });

  it('cotação sem opção retornada não vira opção vazia', () => {
    const painel = montarPainel(
      bruto({ cotacao: [{ status: 'SOLICITADA', seguradora: null, cotacao_opcao: [] }] }),
      AGORA,
    );

    expect(painel?.opcoes).toEqual([]);
  });

  it('a linha do tempo vira frase', () => {
    const painel = montarPainel(bruto(), AGORA);

    expect(painel?.linhaDoTempo[0]?.texto).toBe('De Em atendimento para Em negociação');
    expect(painel?.linhaDoTempo[0]?.quem).toBe('Consultor');
  });

  it('linha sem id em qualquer lista é descartada, não derruba o painel', () => {
    const painel = montarPainel(
      bruto({
        pendencia: [{ descricao: 'sem id' }],
        cotacao: [{ cotacao_opcao: [{ nome_plano: 'sem id' }] }],
        oportunidade_evento: [{ tipo: 'TRANSICAO' }],
      }),
      AGORA,
    );

    expect(painel?.pendencias).toEqual([]);
    expect(painel?.opcoes).toEqual([]);
    expect(painel?.linhaDoTempo).toEqual([]);
  });

  it('item que não é objeto é descartado sem quebrar a lista', () => {
    // O PostgREST não devolve isso, mas um erro serializado no meio da resposta
    // já derrubou tela em projeto que confiou no formato.
    const painel = montarPainel(
      bruto({
        pendencia: ['texto solto'],
        cotacao: [{ cotacao_opcao: [null] }],
        oportunidade_evento: [42],
      }),
      AGORA,
    );

    expect(painel?.pendencias).toEqual([]);
    expect(painel?.opcoes).toEqual([]);
    expect(painel?.linhaDoTempo).toEqual([]);
  });

  it('relação ausente vira lista vazia', () => {
    const painel = montarPainel(
      bruto({ pendencia: null, cotacao: null, oportunidade_evento: null }),
      AGORA,
    );

    expect(painel?.pendencias).toEqual([]);
    expect(painel?.opcoes).toEqual([]);
    expect(painel?.linhaDoTempo).toEqual([]);
  });

  it('pendência sem descrição não deixa a linha em branco', () => {
    const painel = montarPainel(bruto({ pendencia: [{ id: 'p9', status: 'ABERTA' }] }), AGORA);

    expect(painel?.pendencias[0]?.descricao).toBe('Pendência sem descrição');
  });

  it('opção sem nome ainda pode ser comparada pelo preço', () => {
    const painel = montarPainel(
      bruto({ cotacao: [{ cotacao_opcao: [{ id: 'x', premio: 100 }] }] }),
      AGORA,
    );

    expect(painel?.opcoes[0]?.nomePlano).toBe('Plano sem nome');
  });

  it('evento sem tipo aparece como evento genérico', () => {
    const painel = montarPainel(bruto({ oportunidade_evento: [{ id: 'e9' }] }), AGORA);

    expect(painel?.linhaDoTempo[0]?.texto).toBe('EVENTO');
    expect(painel?.linhaDoTempo[0]?.quem).toBe('Sistema');
  });

  it('oportunidade que não veio devolve nada, e quem chama faz o 404', () => {
    expect(montarPainel(null, AGORA)).toBeNull();
    expect(montarPainel({ etapa: 'NOVO' }, AGORA)).toBeNull();
    expect(montarPainel('texto solto', AGORA)).toBeNull();
  });
});
