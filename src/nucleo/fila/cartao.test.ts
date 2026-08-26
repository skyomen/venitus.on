import { describe, expect, it } from 'vitest';
import {
  ESPERA_CONFORTAVEL_MINUTOS,
  ESPERA_LIMITE_MINUTOS,
  descreverVeiculo,
  esperaEmTexto,
  minutosDeEspera,
  montarCartao,
  tomDaEspera,
} from './cartao';
import type { LinhaDaFila } from './cartao';

const AGORA = new Date('2026-08-26T15:00:00.000Z');

function minutosAtras(minutos: number): Date {
  return new Date(AGORA.getTime() - minutos * 60_000);
}

function linha(ajuste: Partial<LinhaDaFila> = {}): LinhaDaFila {
  return {
    id: 'oportunidade-1',
    nome: 'Marina Duarte',
    entrouNaFilaEm: minutosAtras(4),
    intencao: 'QUENTE',
    completude: 'COMPLETO',
    preocupacao: 'ROUBO_FURTO',
    veiculo: { marca: 'Chevrolet', modelo: 'Tracker Premier', anoModelo: 2024 },
    cotada: true,
    planoDeInteresse: 'Compreensiva',
    pendencia: null,
    ...ajuste,
  };
}

function valorDo(cartao: ReturnType<typeof montarCartao>, rotulo: string): string | undefined {
  return cartao.fatos.find((fato) => fato.rotulo === rotulo)?.valor;
}

describe('tempo de espera', () => {
  it('conta em minutos inteiros', () => {
    expect(minutosDeEspera(minutosAtras(4), AGORA)).toBe(4);
  });

  it('sem entrada na fila, não há espera', () => {
    expect(minutosDeEspera(null, AGORA)).toBe(0);
  });

  it('relógio adiantado não vira espera negativa', () => {
    // "-3 min" na tela é pior que "agora": um denuncia defeito, o outro informa.
    expect(minutosDeEspera(new Date(AGORA.getTime() + 180_000), AGORA)).toBe(0);
  });
});

describe('a unidade muda com a grandeza', () => {
  it.each([
    [0, 'agora'],
    [1, '1 min'],
    [4, '4 min'],
    [59, '59 min'],
    [60, '1 h'],
    [150, '2 h'],
    [1439, '23 h'],
    [1440, '1 dia'],
    [2880, '2 dias'],
  ])('%i minutos vira "%s"', (minutos, esperado) => {
    expect(esperaEmTexto(minutos)).toBe(esperado);
  });
});

describe('quando a espera vira problema', () => {
  it('dentro do confortável, o tom é neutro', () => {
    expect(tomDaEspera(0)).toBe('neutro');
    expect(tomDaEspera(ESPERA_CONFORTAVEL_MINUTOS)).toBe('neutro');
  });

  it('passou do confortável, pede atenção', () => {
    expect(tomDaEspera(ESPERA_CONFORTAVEL_MINUTOS + 1)).toBe('atencao');
    expect(tomDaEspera(ESPERA_LIMITE_MINUTOS)).toBe('atencao');
  });

  it('passou do limite, é crítico', () => {
    expect(tomDaEspera(ESPERA_LIMITE_MINUTOS + 1)).toBe('critico');
  });
});

describe('o veículo', () => {
  it('junta marca, modelo e ano', () => {
    expect(descreverVeiculo({ marca: 'Chevrolet', modelo: 'Tracker', anoModelo: 2024 })).toBe(
      'Chevrolet Tracker 2024',
    );
  });

  it('sem marca, ainda dá para reconhecer o carro', () => {
    expect(descreverVeiculo({ marca: null, modelo: 'Tracker', anoModelo: 2024 })).toBe(
      'Tracker 2024',
    );
  });

  it('sem modelo, não vira "2024" solto', () => {
    expect(descreverVeiculo({ marca: 'Chevrolet', modelo: null, anoModelo: 2024 })).toBeNull();
    expect(descreverVeiculo({ marca: 'Chevrolet', modelo: '  ', anoModelo: 2024 })).toBeNull();
  });

  it('sem risco cadastrado, não há veículo', () => {
    expect(descreverVeiculo(null)).toBeNull();
  });
});

describe('o cartão que o consultor recebe', () => {
  it('traz o contexto de §9.5, não "novo lead"', () => {
    const cartao = montarCartao(linha(), AGORA);

    expect(cartao.nome).toBe('Marina Duarte');
    expect(cartao.veiculo).toBe('Chevrolet Tracker Premier 2024');
    expect(cartao.intencao).toBe('QUENTE');
    expect(cartao.espera).toEqual({ minutos: 4, texto: '4 min', tom: 'neutro' });
    expect(valorDo(cartao, 'Maior preocupação')).toBe('Roubo e furto');
    expect(valorDo(cartao, 'Cotação')).toBe('Realizada');
    expect(valorDo(cartao, 'Plano de interesse')).toBe('Compreensiva');
  });

  it('a preocupação é dita em português, não pelo nome do enum', () => {
    expect(valorDo(montarCartao(linha({ preocupacao: 'TODAS' }), AGORA), 'Maior preocupação')).toBe(
      'Cobertura completa',
    );
  });

  it('o que não existe não vira linha vazia', () => {
    // Um "Plano de interesse: —" ocupa a tela do telefone e não ajuda ninguém.
    const cartao = montarCartao(
      linha({ preocupacao: null, planoDeInteresse: null, veiculo: null }),
      AGORA,
    );

    expect(cartao.fatos.map((f) => f.rotulo)).toEqual(['Cotação']);
    expect(cartao.veiculo).toBeNull();
  });

  it('plano em branco conta como ausente', () => {
    const cartao = montarCartao(linha({ planoDeInteresse: '   ' }), AGORA);
    expect(valorDo(cartao, 'Plano de interesse')).toBeUndefined();
  });

  it('cotação ainda não realizada é dita, não escondida', () => {
    expect(valorDo(montarCartao(linha({ cotada: false }), AGORA), 'Cotação')).toBe('Ainda não');
  });

  it('cadastro incompleto aparece: o consultor vai ter de perguntar', () => {
    expect(valorDo(montarCartao(linha({ completude: 'PENDENTE' }), AGORA), 'Cadastro')).toBe(
      'Faltam dados',
    );
  });

  it('cadastro completo não ocupa linha nenhuma', () => {
    expect(valorDo(montarCartao(linha(), AGORA), 'Cadastro')).toBeUndefined();
  });

  it('pendência no prazo pede atenção', () => {
    const cartao = montarCartao(
      linha({ pendencia: { descricao: 'Confirmar CEP', vencida: false } }),
      AGORA,
    );

    expect(cartao.pendencia).toEqual({ texto: 'Confirmar CEP', tom: 'atencao' });
  });

  it('pendência vencida é crítica', () => {
    const cartao = montarCartao(
      linha({ pendencia: { descricao: 'Enviar CNH', vencida: true } }),
      AGORA,
    );

    expect(cartao.pendencia?.tom).toBe('critico');
  });

  it('sem pendência, o cartão não inventa uma', () => {
    expect(montarCartao(linha(), AGORA).pendencia).toBeNull();
  });

  it('quem espera demais aparece como crítico', () => {
    const cartao = montarCartao(linha({ entrouNaFilaEm: minutosAtras(200) }), AGORA);

    expect(cartao.espera.texto).toBe('3 h');
    expect(cartao.espera.tom).toBe('critico');
  });
});
