import { describe, expect, it } from 'vitest';
import { ETAPAS, ETAPAS_TERMINAIS, ehEtapa, ehTerminal, rotuloDaEtapa, tomDaEtapa } from './etapa';
import type { Etapa } from './etapa';

describe('as etapas da jornada', () => {
  it('tem dezessete, na ordem da jornada', () => {
    expect(ETAPAS).toHaveLength(17);
    expect(ETAPAS[0]).toBe('NOVO');
  });

  it('reconhece o que é etapa e o que não é', () => {
    expect(ehEtapa('EM_COTACAO')).toBe(true);
    expect(ehEtapa('ETAPA_INVENTADA')).toBe(false);
    expect(ehEtapa(null)).toBe(false);
  });

  it.each(ETAPAS_TERMINAIS)('%s é terminal', (etapa) => {
    expect(ehTerminal(etapa)).toBe(true);
  });

  it('o meio do caminho não é terminal', () => {
    expect(ehTerminal('EM_NEGOCIACAO')).toBe(false);
  });
});

describe('o nome que aparece na tela', () => {
  it.each(ETAPAS)('%s tem rótulo em português', (etapa: Etapa) => {
    const rotulo = rotuloDaEtapa(etapa);
    expect(rotulo).not.toContain('_');
    expect(rotulo.length).toBeGreaterThan(2);
  });

  it('traduz o nome de coluna para o que se diz ao cliente', () => {
    expect(rotuloDaEtapa('EM_ANALISE_SEGURADORA')).toBe('Em análise na seguradora');
    expect(rotuloDaEtapa('ATRIBUIDO')).toBe('Em atendimento');
  });

  it('nenhum rótulo se repete', () => {
    expect(new Set(ETAPAS.map(rotuloDaEtapa)).size).toBe(ETAPAS.length);
  });
});

describe('o tom da etapa', () => {
  it('só os extremos têm cor', () => {
    // Pintar catorze etapas faria nenhuma se destacar.
    expect(tomDaEtapa('VENDIDA')).toBe('bom');
    expect(tomDaEtapa('PERDIDA')).toBe('critico');
    expect(tomDaEtapa('ENCERRADA_SEM_CONTATO')).toBe('critico');
  });

  it.each(ETAPAS.filter((e) => !ETAPAS_TERMINAIS.some((t) => t === e)))(
    '%s é neutra',
    (etapa: Etapa) => {
      expect(tomDaEtapa(etapa)).toBe('neutro');
    },
  );
});
