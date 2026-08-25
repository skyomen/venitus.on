import { describe, expect, it } from 'vitest';
import {
  FALHAS_ATE_ABRIR,
  MAXIMO_DE_TENTATIVAS,
  aposFalha,
  aposSucesso,
  desistiu,
  podeChamar,
  proximaTentativaEmSegundos,
} from './resiliencia';
import type { Saude } from './resiliencia';

const AGORA = new Date('2026-08-25T12:00:00.000Z');
const FECHADO: Saude = { estado: 'FECHADO', falhasConsecutivas: 0, abertoEm: null };

const INDISPONIVEL = { motivo: 'INDISPONIVEL', detalhe: 'fora do ar' } as const;
const PAYLOAD_INVALIDO = { motivo: 'PAYLOAD_INVALIDO', detalhe: 'CPF errado' } as const;

describe('espera entre tentativas', () => {
  it('cresce a cada tentativa', () => {
    const primeira = proximaTentativaEmSegundos(1, 0);
    const terceira = proximaTentativaEmSegundos(3, 0);

    expect(terceira).toBeGreaterThan(primeira);
  });

  it('tem teto, para a espera não virar eterna', () => {
    expect(proximaTentativaEmSegundos(50, 0)).toBe(512);
  });

  it('o jitter separa itens que falharam juntos', () => {
    // Sem ele, todos voltam juntos e derrubam de novo o que acabou de levantar.
    const semSorte = proximaTentativaEmSegundos(4, 0);
    const comSorte = proximaTentativaEmSegundos(4, 1);

    expect(comSorte).toBeGreaterThan(semSorte);
  });

  it('tentativa negativa não vira espera negativa', () => {
    expect(proximaTentativaEmSegundos(-3, 0)).toBeGreaterThan(0);
  });
});

describe('desistir', () => {
  it('insiste até o limite', () => {
    expect(desistiu(MAXIMO_DE_TENTATIVAS - 1)).toBe(false);
  });

  it('para no limite', () => {
    expect(desistiu(MAXIMO_DE_TENTATIVAS)).toBe(true);
  });
});

describe('disjuntor', () => {
  it('conta falha de caminho', () => {
    const depois = aposFalha(FECHADO, INDISPONIVEL, AGORA);
    expect(depois.falhasConsecutivas).toBe(1);
    expect(depois.estado).toBe('FECHADO');
  });

  it('não conta falha de conteúdo', () => {
    // O payload é que estava errado; abrir o disjuntor seria punir o fornecedor
    // por culpa nossa.
    const depois = aposFalha(FECHADO, PAYLOAD_INVALIDO, AGORA);
    expect(depois).toEqual(FECHADO);
  });

  it('abre depois de falhas consecutivas', () => {
    let saude = FECHADO;
    for (let i = 0; i < FALHAS_ATE_ABRIR; i += 1) {
      saude = aposFalha(saude, INDISPONIVEL, AGORA);
    }

    expect(saude.estado).toBe('ABERTO');
    expect(saude.abertoEm).toEqual(AGORA);
  });

  it('um sucesso zera a contagem', () => {
    const depoisDeFalhar = aposFalha(FECHADO, INDISPONIVEL, AGORA);
    expect(aposSucesso()).toEqual(FECHADO);
    expect(depoisDeFalhar.falhasConsecutivas).toBe(1);
  });
});

describe('podeChamar', () => {
  it('fechado deixa passar', () => {
    expect(podeChamar(FECHADO, AGORA)).toBe(true);
  });

  it('aberto barra durante a espera', () => {
    const aberto: Saude = { estado: 'ABERTO', falhasConsecutivas: 5, abertoEm: AGORA };
    expect(podeChamar(aberto, AGORA)).toBe(false);
  });

  it('aberto volta a deixar passar depois da espera', () => {
    const aberto: Saude = { estado: 'ABERTO', falhasConsecutivas: 5, abertoEm: AGORA };
    const daquiADezMinutos = new Date(AGORA.getTime() + 10 * 60_000);

    expect(podeChamar(aberto, daquiADezMinutos)).toBe(true);
  });

  it('aberto sem data fica barrado', () => {
    // Fail closed: sem saber desde quando, presumir que já passou reabriria a
    // torneira para um fornecedor possivelmente ainda caído.
    const aberto: Saude = { estado: 'ABERTO', falhasConsecutivas: 5, abertoEm: null };
    expect(podeChamar(aberto, AGORA)).toBe(false);
  });

  it('meio aberto deixa a chamada de prova passar', () => {
    const meioAberto: Saude = { estado: 'MEIO_ABERTO', falhasConsecutivas: 5, abertoEm: AGORA };
    expect(podeChamar(meioAberto, AGORA)).toBe(true);
  });
});
