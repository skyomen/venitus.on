import { describe, expect, it } from 'vitest';
import { MAXIMO_DE_TENTATIVAS } from '@/conectores/resiliencia';
import type { Contexto, Disparo } from '@/nucleo/followup/portao-de-envio';
import { decidirAcao, decidirAposEnvio, decidirAposOutbox } from './decisoes';
import type { EnvioConcluido } from './decisoes';

const AGORA = new Date('2026-08-25T13:00:00.000Z');
const HA_UMA_HORA = new Date('2026-08-25T12:00:00.000Z');
const HA_DOIS_DIAS = new Date('2026-08-23T13:00:00.000Z');
const OPORTUNIDADE = '00000000-0000-4000-8000-000000000abc';

const TEMPLATE: Disparo = { template: '01_primeiro_contato', templateAprovadoEm: AGORA };
const TEXTO_LIVRE: Disparo = {};

function contexto(parcial: Partial<Contexto> = {}): Contexto {
  return {
    agora: AGORA,
    donoConversa: 'AUTOMACAO',
    ultimaMensagemDoCliente: HA_UMA_HORA,
    consentimento: true,
    janelasDoDia: [[8 * 60, 18 * 60]],
    minutosDoDia: 10 * 60,
    ...parcial,
  };
}

const INDISPONIVEL = {
  ok: false,
  falha: { motivo: 'INDISPONIVEL', detalhe: 'fora do ar' },
} as const;
const RECUSADO = { ok: false, falha: { motivo: 'RECUSADO', detalhe: 'não aceito' } } as const;
const AGUARDANDO = {
  ok: false,
  falha: { motivo: 'AGUARDANDO_CONECTOR', detalhe: 'sem conector real' },
} as const;

describe('decidirAcao', () => {
  it('manda enviar quando o portão libera', () => {
    expect(decidirAcao(contexto(), TEXTO_LIVRE)).toEqual({ tipo: 'ENVIAR', comTemplate: false });
  });

  it.each([
    ['o consultor assumiu', { donoConversa: 'CONSULTOR' as const }, 'O consultor assumiu'],
    ['o cliente pediu para não receber', { consentimento: false }, 'não receber'],
  ])('cancela a régua quando %s', (_caso, parcial, trecho) => {
    // A régua perdeu o sentido: some sem barulho, sem virar alarme.
    const acao = decidirAcao(contexto(parcial), TEMPLATE);

    expect(acao.tipo).toBe('CANCELAR');
    if (acao.tipo === 'CANCELAR') {
      expect(acao.motivo).toContain(trecho);
    }
  });

  it('fora do horário reagenda em vez de falhar', () => {
    // Não é erro: é cedo demais.
    const acao = decidirAcao(contexto({ minutosDoDia: 3 * 60 }), TEMPLATE);

    expect(acao.tipo).toBe('REAGENDAR');
    if (acao.tipo === 'REAGENDAR') {
      expect(acao.emSegundos).toBeGreaterThan(0);
    }
  });

  it.each([
    ['sem template fora da janela', { ultimaMensagemDoCliente: HA_DOIS_DIAS }, TEXTO_LIVRE],
    ['com template não aprovado', {}, { template: 'x' }],
  ])('falha e chama gente quando %s', (_caso, parcial, disparo) => {
    // Configuração errada não se resolve tentando de novo; insistir esconderia
    // o problema do gestor.
    expect(decidirAcao(contexto(parcial), disparo).tipo).toBe('FALHAR');
  });
});

describe('decidirAposEnvio', () => {
  function apos(resultado: EnvioConcluido['resultado'], tentativas = 1) {
    return decidirAposEnvio({
      regua: 'INATIVIDADE',
      oportunidadeId: OPORTUNIDADE,
      tipoDisparado: 'INATIVIDADE_1',
      resultado,
      tentativas,
      agora: AGORA,
    });
  }

  it('entregue, avança para o passo seguinte da régua', () => {
    const decisao = apos({ ok: true });

    expect(decisao.tipo).toBe('AVANCAR');
    if (decisao.tipo === 'AVANCAR') {
      expect(decisao.proximo.tipo).toBe('INATIVIDADE_2');
    }
  });

  it('entregue o último passo, encerra a régua', () => {
    const decisao = decidirAposEnvio({
      regua: 'INATIVIDADE',
      oportunidadeId: OPORTUNIDADE,
      tipoDisparado: 'INATIVIDADE_3',
      resultado: { ok: true },
      tentativas: 1,
      agora: AGORA,
    });

    expect(decisao.tipo).toBe('ENCERRAR');
    if (decisao.tipo === 'ENCERRAR') {
      expect(decisao.encerramento.motivo.length).toBeGreaterThan(0);
    }
  });

  it('abertura sem resposta encerra sem marcar venda perdida', () => {
    const decisao = decidirAposEnvio({
      regua: 'ABERTURA',
      oportunidadeId: OPORTUNIDADE,
      tipoDisparado: 'ABERTURA_5',
      resultado: { ok: true },
      tentativas: 1,
      agora: AGORA,
    });

    expect(decisao.tipo).toBe('ENCERRAR');
    if (decisao.tipo === 'ENCERRAR') {
      expect(decisao.encerramento.tipo).toBe('ENCERRAR_SEM_CONTATO');
    }
  });

  it('falha de caminho volta a tentar, com espera', () => {
    const decisao = apos(INDISPONIVEL);

    expect(decisao.tipo).toBe('REAGENDAR');
    if (decisao.tipo === 'REAGENDAR') {
      expect(decisao.emSegundos).toBeGreaterThan(0);
    }
  });

  it('falha de conteúdo não volta a tentar', () => {
    // Insistir num payload recusado só gasta chamada.
    expect(apos(RECUSADO).tipo).toBe('FALHAR');
  });

  it('desiste ao estourar o limite de tentativas', () => {
    const decisao = apos(INDISPONIVEL, MAXIMO_DE_TENTATIVAS);

    expect(decisao.tipo).toBe('FALHAR');
    if (decisao.tipo === 'FALHAR') {
      expect(decisao.motivo).toContain('limite');
    }
  });

  it('falha sem motivo declarado também é falha', () => {
    expect(apos({ ok: false }).tipo).toBe('FALHAR');
  });
});

describe('decidirAposOutbox', () => {
  it('entregue fecha o item', () => {
    expect(decidirAposOutbox({ ok: true }, 1)).toEqual({ tipo: 'ENTREGUE' });
  });

  it('sem conector real, fica parado esperando', () => {
    // Reexecutar sem conector só encheria o log.
    expect(decidirAposOutbox(AGUARDANDO, 1)).toEqual({ tipo: 'AGUARDAR_CONECTOR' });
  });

  it('falha de caminho volta a tentar', () => {
    expect(decidirAposOutbox(INDISPONIVEL, 1).tipo).toBe('REAGENDAR');
  });

  it('falha de conteúdo desiste na hora', () => {
    const decisao = decidirAposOutbox(RECUSADO, 1);

    expect(decisao.tipo).toBe('FALHAR');
    if (decisao.tipo === 'FALHAR') {
      expect(decisao.motivo).toBe('não aceito');
    }
  });

  it('desiste ao estourar o limite', () => {
    expect(decidirAposOutbox(INDISPONIVEL, MAXIMO_DE_TENTATIVAS).tipo).toBe('FALHAR');
  });

  it('falha sem motivo declarado também desiste', () => {
    const decisao = decidirAposOutbox({ ok: false }, 1);

    expect(decisao.tipo).toBe('FALHAR');
    if (decisao.tipo === 'FALHAR') {
      expect(decisao.motivo).toContain('sem motivo');
    }
  });
});
