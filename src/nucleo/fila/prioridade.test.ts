import { describe, expect, it } from 'vitest';
import {
  PESOS_PADRAO,
  calcularPrioridade,
  interpretarPesos,
  type FatoresDaFila,
} from './prioridade';

const BASE: FatoresDaFila = { intencao: 'FRIA', minutosNaFila: 0, completude: 'PENDENTE' };

describe('intenção', () => {
  it('quente vale mais que morna, e morna mais que fria', () => {
    const quente = calcularPrioridade({ ...BASE, intencao: 'QUENTE' });
    const morna = calcularPrioridade({ ...BASE, intencao: 'MORNA' });
    const fria = calcularPrioridade({ ...BASE, intencao: 'FRIA' });

    expect(quente).toBeGreaterThan(morna);
    expect(morna).toBeGreaterThan(fria);
  });

  it('lead frio continua elegível, com prioridade positiva', () => {
    // Qualificação prioriza, não exclui (§9.3).
    expect(calcularPrioridade(BASE)).toBeGreaterThan(0);
  });
});

describe('espera', () => {
  it('a prioridade cresce com o tempo na fila', () => {
    const agora = calcularPrioridade(BASE);
    const daquiAUmDia = calcularPrioridade({ ...BASE, minutosNaFila: 60 * 24 });

    expect(daquiAUmDia).toBeGreaterThan(agora);
  });

  it('conta por hora inteira: minutos soltos não mudam a posição', () => {
    const trintaMinutos = calcularPrioridade({ ...BASE, minutosNaFila: 30 });
    const cinquentaENove = calcularPrioridade({ ...BASE, minutosNaFila: 59 });

    expect(cinquentaENove).toBe(trintaMinutos);
  });

  it('um lead frio antigo alcança um lead quente recém-chegado', () => {
    // É esta a regra que impede o lead antigo de morrer no fim da fila.
    const quenteAgora = calcularPrioridade({ ...BASE, intencao: 'QUENTE' });
    const frioDeDoisDias = calcularPrioridade({ ...BASE, minutosNaFila: 60 * 48 });

    expect(frioDeDoisDias).toBeGreaterThan(quenteAgora);
  });

  it('tempo negativo não subtrai prioridade', () => {
    expect(calcularPrioridade({ ...BASE, minutosNaFila: -500 })).toBe(calcularPrioridade(BASE));
  });
});

describe('contexto', () => {
  it('dado completo soma posição', () => {
    const completo = calcularPrioridade({ ...BASE, completude: 'COMPLETO' });
    expect(completo).toBeGreaterThan(calcularPrioridade(BASE));
  });

  it('pendência deixa de somar, mas não derruba', () => {
    // Cliente quente com CEP errado continua quente (§9.1).
    const quentePendente = calcularPrioridade({
      ...BASE,
      intencao: 'QUENTE',
      completude: 'PENDENTE',
    });
    const friaCompleta = calcularPrioridade({ ...BASE, completude: 'COMPLETO' });

    expect(quentePendente).toBeGreaterThan(friaCompleta);
  });
});

describe('pesos por corretora', () => {
  it('peso maior de intenção aumenta a distância entre temperaturas', () => {
    const pesos = { ...PESOS_PADRAO, intencao: 100 };
    const quente = calcularPrioridade({ ...BASE, intencao: 'QUENTE' }, pesos);
    const fria = calcularPrioridade({ ...BASE, intencao: 'FRIA' }, pesos);

    expect(quente - fria).toBe(200);
  });

  it('peso zero na espera congela a fila no tempo', () => {
    const pesos = { ...PESOS_PADRAO, espera: 0 };
    const antigo = calcularPrioridade({ ...BASE, minutosNaFila: 60 * 72 }, pesos);

    expect(antigo).toBe(calcularPrioridade(BASE, pesos));
  });
});

describe('interpretarPesos', () => {
  it('lê o que a corretora configurou', () => {
    expect(interpretarPesos({ intencao: 20, espera: 2, contexto: 1 })).toEqual({
      intencao: 20,
      espera: 2,
      contexto: 1,
    });
  });

  it('completa com o padrão o que estiver ausente', () => {
    expect(interpretarPesos({ intencao: 20 })).toEqual({ ...PESOS_PADRAO, intencao: 20 });
  });

  it.each([[null], [undefined], ['texto'], [42], [[]]])(
    'volta ao padrão quando a configuração é %s',
    (configurado: unknown) => {
      expect(interpretarPesos(configurado)).toEqual(PESOS_PADRAO);
    },
  );

  it.each([[-5], [Number.NaN], [Number.POSITIVE_INFINITY], ['10'], [null]])(
    'ignora peso inválido (%s) em vez de quebrar a fila',
    (valor: unknown) => {
      // Peso negativo inverteria a ordem da fila em silêncio.
      expect(interpretarPesos({ intencao: valor }).intencao).toBe(PESOS_PADRAO.intencao);
    },
  );

  it('aceita zero, que é uma configuração legítima', () => {
    expect(interpretarPesos({ espera: 0 }).espera).toBe(0);
  });
});
