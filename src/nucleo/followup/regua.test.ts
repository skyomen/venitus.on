import { describe, expect, it } from 'vitest';
import { REGUAS, encerramentoDaRegua, passosDaRegua, proximoAgendamento } from './regua';
import type { Regua } from './regua';

const GATILHO = new Date('2026-08-25T09:00:00.000Z');
const OPORTUNIDADE = '00000000-0000-4000-8000-000000000abc';

function agendar(regua: Regua, ultimo: string | null) {
  return proximoAgendamento(regua, OPORTUNIDADE, ultimo, GATILHO);
}

/** Percorre a régua inteira, devolvendo os tipos na ordem em que disparam. */
function percorrer(regua: Regua): string[] {
  const tipos: string[] = [];
  let ultimo: string | null = null;

  for (;;) {
    const proximo = agendar(regua, ultimo);
    if (proximo === null) {
      return tipos;
    }
    tipos.push(proximo.tipo);
    ultimo = proximo.tipo;
  }
}

describe('cadência de inatividade', () => {
  it('dispara em 30 minutos, 2 horas e 3 horas', () => {
    expect(agendar('INATIVIDADE', null)?.executarEm.toISOString()).toBe('2026-08-25T09:30:00.000Z');
    expect(agendar('INATIVIDADE', 'INATIVIDADE_1')?.executarEm.toISOString()).toBe(
      '2026-08-25T11:00:00.000Z',
    );
    expect(agendar('INATIVIDADE', 'INATIVIDADE_2')?.executarEm.toISOString()).toBe(
      '2026-08-25T12:00:00.000Z',
    );
  });

  it('tem três passos e acaba', () => {
    expect(percorrer('INATIVIDADE')).toEqual(['INATIVIDADE_1', 'INATIVIDADE_2', 'INATIVIDADE_3']);
  });

  it('não usa template: a mensagem é contextual à última conversa', () => {
    expect(agendar('INATIVIDADE', null)?.template).toBeUndefined();
  });
});

describe('cadência de abertura', () => {
  it('a primeira sai na hora e as demais a cada 24 horas', () => {
    expect(agendar('ABERTURA', null)?.executarEm.toISOString()).toBe('2026-08-25T09:00:00.000Z');
    expect(agendar('ABERTURA', 'ABERTURA_1')?.executarEm.toISOString()).toBe(
      '2026-08-26T09:00:00.000Z',
    );
    expect(agendar('ABERTURA', 'ABERTURA_4')?.executarEm.toISOString()).toBe(
      '2026-08-29T09:00:00.000Z',
    );
  });

  it('são cinco disparos: a abertura mais quatro tentativas', () => {
    expect(percorrer('ABERTURA')).toHaveLength(5);
  });

  it('todo passo carrega template, porque fora da janela só template sai', () => {
    for (const passo of passosDaRegua('ABERTURA')) {
      expect(passo.template).toBeDefined();
    }
  });
});

describe('cadência de recuperação', () => {
  it('é R1, R2 e R3 em dias seguidos', () => {
    expect(percorrer('RECUPERACAO')).toEqual(['R1', 'R2', 'R3']);
    expect(agendar('RECUPERACAO', 'R2')?.executarEm.toISOString()).toBe('2026-08-28T09:00:00.000Z');
  });
});

describe('chave de unicidade', () => {
  it('identifica régua, oportunidade e passo', () => {
    // É ela que impede o mesmo passo de ser agendado duas vezes.
    expect(agendar('INATIVIDADE', null)?.chaveUnicidade).toBe(
      `INATIVIDADE:${OPORTUNIDADE}:INATIVIDADE_1`,
    );
  });

  it('não colide entre réguas da mesma oportunidade', () => {
    const chaves = REGUAS.map((regua) => agendar(regua, null)?.chaveUnicidade);
    expect(new Set(chaves).size).toBe(REGUAS.length);
  });
});

describe('fim de régua', () => {
  it.each(REGUAS)('%s devolve nulo depois do último passo', (regua) => {
    const passos = passosDaRegua(regua);
    const ultimo = passos[passos.length - 1]?.tipo ?? null;

    expect(agendar(regua, ultimo)).toBeNull();
  });

  it('tipo desconhecido reinicia a régua em vez de encerrá-la', () => {
    // Encerrar por um valor que não reconhecemos deixaria o cliente sem
    // follow-up nenhum.
    expect(agendar('INATIVIDADE', 'PASSO_QUE_NAO_EXISTE')?.tipo).toBe('INATIVIDADE_1');
  });
});

describe('encerramento', () => {
  it('abertura sem resposta não é venda perdida', () => {
    // Nunca houve conversa: é contato que não pegou.
    expect(encerramentoDaRegua('ABERTURA').tipo).toBe('ENCERRAR_SEM_CONTATO');
  });

  it.each(['INATIVIDADE', 'RECUPERACAO'] as const)('%s termina em perdida', (regua) => {
    expect(encerramentoDaRegua(regua).tipo).toBe('MARCAR_PERDIDA');
  });

  it.each(REGUAS)('%s explica o motivo do encerramento', (regua) => {
    // Encerrar exige motivo — a máquina de estados recusa sem ele.
    expect(encerramentoDaRegua(regua).motivo.length).toBeGreaterThan(0);
  });
});
