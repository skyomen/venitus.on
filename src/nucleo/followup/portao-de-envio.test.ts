import { describe, expect, it } from 'vitest';
import {
  automacaoPodeFalar,
  decidirEnvio,
  dentroDaJanelaDeSessao,
  dentroDoHorario,
} from './portao-de-envio';
import type { Contexto, Disparo } from './portao-de-envio';

const AGORA = new Date('2026-08-25T13:00:00.000Z');
const HA_UMA_HORA = new Date('2026-08-25T12:00:00.000Z');
const HA_DOIS_DIAS = new Date('2026-08-23T13:00:00.000Z');

const APROVADO: Disparo = { template: '01_primeiro_contato', templateAprovadoEm: AGORA };
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

describe('janela de 24 horas', () => {
  it('está aberta logo depois de o cliente falar', () => {
    expect(dentroDaJanelaDeSessao(HA_UMA_HORA, AGORA)).toBe(true);
  });

  it('fecha depois de 24 horas', () => {
    expect(dentroDaJanelaDeSessao(HA_DOIS_DIAS, AGORA)).toBe(false);
  });

  it('fecha exatamente em 24 horas', () => {
    const vinteQuatroHoras = new Date(AGORA.getTime() - 24 * 60 * 60_000);
    expect(dentroDaJanelaDeSessao(vinteQuatroHoras, AGORA)).toBe(false);
  });

  it('nunca abriu quando o cliente jamais falou', () => {
    expect(dentroDaJanelaDeSessao(null, AGORA)).toBe(false);
  });

  it('data no futuro não abre janela', () => {
    const daquiAPouco = new Date(AGORA.getTime() + 60_000);
    expect(dentroDaJanelaDeSessao(daquiAPouco, AGORA)).toBe(false);
  });
});

describe('horário da corretora', () => {
  it('dentro da janela do dia', () => {
    expect(dentroDoHorario(contexto({ minutosDoDia: 9 * 60 }))).toBe(true);
  });

  it.each([
    ['antes de abrir', 7 * 60],
    ['depois de fechar', 19 * 60],
    ['exatamente no fechamento', 18 * 60],
  ])('fora da janela: %s', (_caso, minutos) => {
    expect(dentroDoHorario(contexto({ minutosDoDia: minutos }))).toBe(false);
  });

  it('sem janela cadastrada, o dia inteiro está fechado', () => {
    // Fail closed: disparar sem horário configurado mandaria mensagem de
    // madrugada.
    expect(dentroDoHorario(contexto({ janelasDoDia: [] }))).toBe(false);
  });

  it('aceita mais de uma janela no mesmo dia', () => {
    const comIntervalo = contexto({
      janelasDoDia: [
        [8 * 60, 12 * 60],
        [14 * 60, 18 * 60],
      ],
      minutosDoDia: 13 * 60,
    });
    expect(dentroDoHorario(comIntervalo)).toBe(false);
    expect(dentroDoHorario({ ...comIntervalo, minutosDoDia: 15 * 60 })).toBe(true);
  });
});

describe('dono da conversa', () => {
  it('a automação cala quando o consultor assume', () => {
    // Sem isso, a régua cobra o cliente enquanto uma pessoa conversa com ele.
    expect(automacaoPodeFalar('CONSULTOR')).toBe(false);
  });

  it.each(['AUTOMACAO', 'AUTOMACAO_ASSISTIDA'] as const)('%s pode falar', (dono) => {
    expect(automacaoPodeFalar(dono)).toBe(true);
  });
});

describe('decidirEnvio', () => {
  it('texto livre sai dentro da janela', () => {
    expect(decidirEnvio(contexto(), TEXTO_LIVRE)).toEqual({ tipo: 'ENVIAR', comTemplate: false });
  });

  it('texto livre é bloqueado fora da janela', () => {
    // O provedor recusaria; falhar aqui é melhor que falhar com o cliente.
    expect(decidirEnvio(contexto({ ultimaMensagemDoCliente: HA_DOIS_DIAS }), TEXTO_LIVRE)).toEqual({
      tipo: 'BLOQUEADO',
      motivo: 'FORA_DA_JANELA_SEM_TEMPLATE',
    });
  });

  it('template aprovado sai mesmo fora da janela', () => {
    expect(decidirEnvio(contexto({ ultimaMensagemDoCliente: HA_DOIS_DIAS }), APROVADO)).toEqual({
      tipo: 'ENVIAR',
      comTemplate: true,
    });
  });

  it.each([
    ['sem data de aprovação', { template: '01_primeiro_contato' }],
    ['com aprovação nula', { template: '01_primeiro_contato', templateAprovadoEm: null }],
  ])('template %s não dispara', (_caso, disparo) => {
    expect(decidirEnvio(contexto(), disparo)).toEqual({
      tipo: 'BLOQUEADO',
      motivo: 'TEMPLATE_NAO_APROVADO',
    });
  });

  it('sem consentimento nada sai, nem template', () => {
    expect(decidirEnvio(contexto({ consentimento: false }), APROVADO)).toEqual({
      tipo: 'BLOQUEADO',
      motivo: 'SEM_CONSENTIMENTO',
    });
  });

  it('conversa do consultor bloqueia a automação', () => {
    expect(decidirEnvio(contexto({ donoConversa: 'CONSULTOR' }), APROVADO)).toEqual({
      tipo: 'BLOQUEADO',
      motivo: 'CONVERSA_DO_CONSULTOR',
    });
  });

  it('fora do horário bloqueia', () => {
    expect(decidirEnvio(contexto({ minutosDoDia: 3 * 60 }), APROVADO)).toEqual({
      tipo: 'BLOQUEADO',
      motivo: 'FORA_DO_HORARIO',
    });
  });

  it('o consentimento é conferido antes de tudo', () => {
    // Quem pediu para não receber não recebe, nem fora do horário nem dentro.
    const semNada = contexto({
      consentimento: false,
      donoConversa: 'CONSULTOR',
      minutosDoDia: 3 * 60,
    });
    expect(decidirEnvio(semNada, APROVADO)).toEqual({
      tipo: 'BLOQUEADO',
      motivo: 'SEM_CONSENTIMENTO',
    });
  });
});
