import { describe, expect, it } from 'vitest';
import { dataHoraCurta, eventoNaTela, montarLinhaDoTempo, quemAgiu } from './linha-do-tempo';
import type { EventoBruto } from './linha-do-tempo';

function evento(ajuste: Partial<EventoBruto> = {}): EventoBruto {
  return {
    id: 'evento-1',
    tipo: 'TRANSICAO',
    deEtapa: 'NA_FILA',
    paraEtapa: 'ATRIBUIDO',
    ator: 'DISTRIBUICAO',
    motivo: null,
    ocorridoEm: new Date(2026, 7, 26, 9, 41),
    ...ajuste,
  };
}

describe('a transição vira frase', () => {
  it('diz de onde veio e para onde foi, em português', () => {
    // `TRANSICAO` com `de_etapa` e `para_etapa` não diz nada a quem atende.
    expect(eventoNaTela(evento()).texto).toBe('De Na fila para Em atendimento');
  });

  it('sem origem, é a entrada na jornada', () => {
    expect(eventoNaTela(evento({ deEtapa: null })).texto).toBe('Entrou em Em atendimento');
  });

  it('etapa desconhecida aparece como veio, sem sumir', () => {
    expect(eventoNaTela(evento({ paraEtapa: 'ETAPA_NOVA' })).texto).toContain('ETAPA_NOVA');
  });

  it('transição sem destino ainda é registrada', () => {
    expect(eventoNaTela(evento({ paraEtapa: null })).texto).toBe('Transição registrada');
  });
});

describe('os outros eventos', () => {
  it.each([
    ['RESPOSTA_DO_CLIENTE', 'O cliente respondeu'],
    ['PENDENCIA_RESOLVIDA', 'Pendência resolvida'],
    ['PLANO_DE_INTERESSE', 'Plano de interesse registrado'],
  ])('%s vira "%s"', (tipo, esperado) => {
    expect(eventoNaTela(evento({ tipo })).texto).toBe(esperado);
  });

  it('evento sem tradução aparece pelo código, em vez de sumir', () => {
    // Um follow-up que existiu e não aparece faz o consultor repetir o que a
    // automação já fez, e o cliente ouve a mesma pergunta duas vezes.
    expect(eventoNaTela(evento({ tipo: 'ALGO_NOVO' })).texto).toBe('ALGO_NOVO');
  });
});

describe('quem agiu', () => {
  it.each([
    ['AUTOMACAO', 'Automação'],
    ['CONSULTOR', 'Consultor'],
    ['CLIENTE', 'Cliente'],
    ['DISTRIBUICAO', 'Fila'],
  ])('%s é dito como "%s"', (ator, esperado) => {
    expect(quemAgiu(ator)).toBe(esperado);
  });

  it('ator desconhecido aparece como veio', () => {
    expect(quemAgiu('IMPORTACAO')).toBe('IMPORTACAO');
  });
});

describe('o tom do evento', () => {
  it('a venda é boa e a perda é crítica', () => {
    expect(eventoNaTela(evento({ paraEtapa: 'VENDIDA' })).tom).toBe('bom');
    expect(eventoNaTela(evento({ paraEtapa: 'PERDIDA' })).tom).toBe('critico');
    expect(eventoNaTela(evento({ paraEtapa: 'ENCERRADA_SEM_CONTATO' })).tom).toBe('critico');
  });

  it('pendência resolvida é boa notícia', () => {
    expect(eventoNaTela(evento({ tipo: 'PENDENCIA_RESOLVIDA', paraEtapa: null })).tom).toBe('bom');
  });

  it('o cliente falando merece destaque', () => {
    // É o que muda o atendimento de lugar.
    expect(eventoNaTela(evento({ tipo: 'RESPOSTA_DO_CLIENTE', paraEtapa: null })).tom).toBe(
      'atencao',
    );
  });

  it('o resto do caminho é neutro', () => {
    expect(eventoNaTela(evento()).tom).toBe('neutro');
  });
});

describe('o detalhe', () => {
  it('o motivo entra quando existe', () => {
    expect(eventoNaTela(evento({ motivo: 'não quis realizar o seguro' })).detalhe).toBe(
      'não quis realizar o seguro',
    );
  });

  it('motivo em branco não vira linha vazia', () => {
    expect(eventoNaTela(evento({ motivo: '   ' })).detalhe).toBeNull();
    expect(eventoNaTela(evento({ motivo: null })).detalhe).toBeNull();
  });
});

describe('a data na linha do tempo', () => {
  it('é curta: dia, mês e hora', () => {
    // O ano repetido em trinta linhas só ocupa a largura do telefone.
    expect(dataHoraCurta(new Date(2026, 7, 26, 9, 41))).toBe('26/08 09:41');
  });

  it('preenche com zero à esquerda', () => {
    expect(dataHoraCurta(new Date(2026, 0, 5, 7, 3))).toBe('05/01 07:03');
  });
});

describe('a linha inteira', () => {
  it('preserva a ordem em que os eventos vieram', () => {
    const eventos = montarLinhaDoTempo([
      evento({ id: 'a' }),
      evento({ id: 'b', tipo: 'RESPOSTA_DO_CLIENTE' }),
    ]);

    expect(eventos.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('sem evento nenhum, lista vazia', () => {
    expect(montarLinhaDoTempo([])).toEqual([]);
  });
});
