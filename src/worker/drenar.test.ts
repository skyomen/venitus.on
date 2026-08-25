import { describe, expect, it, vi } from 'vitest';
import { drenar } from './drenar';
import type { Dependencias } from './drenar';
import type { ContextoDoDisparo, ItemAgendado, ItemDeOutbox } from './portas';

const AGORA = new Date('2026-08-25T13:00:00.000Z');
const OPORTUNIDADE = '00000000-0000-4000-8000-000000000abc';

function itemAgendado(parcial: Partial<ItemAgendado> = {}): ItemAgendado {
  return {
    id: 'ag-1',
    oportunidadeId: OPORTUNIDADE,
    regua: 'INATIVIDADE',
    tipo: 'INATIVIDADE_1',
    tentativas: 1,
    ...parcial,
  };
}

function itemDeOutbox(parcial: Partial<ItemDeOutbox> = {}): ItemDeOutbox {
  return {
    id: 'ob-1',
    tentativas: 1,
    chaveIdempotencia: 'crm:etapa:1',
    espelhamento: { operacao: 'MOVER_ETAPA', oportunidadeId: OPORTUNIDADE, dados: {} },
    ...parcial,
  };
}

function contextoDoDisparo(parcial: Partial<ContextoDoDisparo> = {}): ContextoDoDisparo {
  return {
    telefoneE164: '+5511999998888',
    templateAprovadoEm: AGORA,
    textoContextual: 'Oi! Ainda posso ajudar com a sua cotação?',
    contexto: {
      agora: AGORA,
      donoConversa: 'AUTOMACAO',
      ultimaMensagemDoCliente: new Date('2026-08-25T12:00:00.000Z'),
      consentimento: true,
      janelasDoDia: [[8 * 60, 18 * 60]],
      minutosDoDia: 10 * 60,
    },
    ...parcial,
  };
}

function montar(
  agendados: readonly ItemAgendado[] = [],
  pendentes: readonly ItemDeOutbox[] = [],
  contexto: ContextoDoDisparo | null = contextoDoDisparo(),
) {
  const repositorio = {
    reservarAgendamentos: vi.fn().mockResolvedValue(agendados),
    reservarOutbox: vi.fn().mockResolvedValue(pendentes),
    carregarContexto: vi.fn().mockResolvedValue(contexto),
    concluirAgendamento: vi.fn().mockResolvedValue(undefined),
    cancelarAgendamento: vi.fn().mockResolvedValue(undefined),
    falharAgendamento: vi.fn().mockResolvedValue(undefined),
    reagendar: vi.fn().mockResolvedValue(undefined),
    criarProximoPasso: vi.fn().mockResolvedValue(undefined),
    encerrarOportunidade: vi.fn().mockResolvedValue(undefined),
    concluirOutbox: vi.fn().mockResolvedValue(undefined),
    aguardarConector: vi.fn().mockResolvedValue(undefined),
    falharOutbox: vi.fn().mockResolvedValue(undefined),
  };

  const mensageiro = {
    enviarTexto: vi.fn().mockResolvedValue({ ok: true }),
    enviarTemplate: vi.fn().mockResolvedValue({ ok: true }),
  };

  const espelho = { espelhar: vi.fn().mockResolvedValue({ ok: true }) };

  const dependencias: Dependencias = {
    repositorio,
    mensageiro,
    espelho,
    relogio: { agora: () => AGORA },
  };

  return { dependencias, repositorio, mensageiro, espelho };
}

describe('drenagem de agendamentos', () => {
  it('envia e avança a régua', async () => {
    const { dependencias, repositorio, mensageiro } = montar([itemAgendado()]);

    const balanco = await drenar(dependencias);

    expect(mensageiro.enviarTexto).toHaveBeenCalledOnce();
    expect(repositorio.concluirAgendamento).toHaveBeenCalledWith('ag-1');
    expect(repositorio.criarProximoPasso).toHaveBeenCalledOnce();
    expect(balanco).toEqual({ agendamentos: 1, outbox: 0, falhas: 0 });
  });

  it('usa template quando o passo tem um', async () => {
    const { dependencias, mensageiro } = montar([
      itemAgendado({ regua: 'ABERTURA', tipo: 'ABERTURA_1', template: '01_primeiro_contato' }),
    ]);

    await drenar(dependencias);

    expect(mensageiro.enviarTemplate).toHaveBeenCalledOnce();
    expect(mensageiro.enviarTexto).not.toHaveBeenCalled();
  });

  it('encerra a oportunidade no fim da régua', async () => {
    const { dependencias, repositorio } = montar([itemAgendado({ tipo: 'INATIVIDADE_3' })]);

    await drenar(dependencias);

    expect(repositorio.encerrarOportunidade).toHaveBeenCalledOnce();
    expect(repositorio.criarProximoPasso).not.toHaveBeenCalled();
  });

  it('cancela quando o consultor assumiu a conversa', async () => {
    // §11.5: a automação cala quando uma pessoa está falando com o cliente.
    const { dependencias, repositorio, mensageiro } = montar(
      [itemAgendado()],
      [],
      contextoDoDisparo({
        contexto: { ...contextoDoDisparo().contexto, donoConversa: 'CONSULTOR' },
      }),
    );

    await drenar(dependencias);

    expect(mensageiro.enviarTexto).not.toHaveBeenCalled();
    expect(repositorio.cancelarAgendamento).toHaveBeenCalledOnce();
  });

  it('reagenda quando está fora do horário', async () => {
    const { dependencias, repositorio, mensageiro } = montar(
      [itemAgendado()],
      [],
      contextoDoDisparo({
        contexto: { ...contextoDoDisparo().contexto, minutosDoDia: 3 * 60 },
      }),
    );

    await drenar(dependencias);

    expect(mensageiro.enviarTexto).not.toHaveBeenCalled();
    expect(repositorio.reagendar).toHaveBeenCalledOnce();
  });

  it('falha o passo quando o template não está aprovado', async () => {
    // Configuração errada não se resolve tentando de novo: alguém precisa
    // aprovar o template antes que o disparo faça sentido.
    const { dependencias, repositorio, mensageiro } = montar(
      [itemAgendado({ regua: 'ABERTURA', tipo: 'ABERTURA_1', template: '01_primeiro_contato' })],
      [],
      contextoDoDisparo({ templateAprovadoEm: null }),
    );

    await drenar(dependencias);

    expect(mensageiro.enviarTemplate).not.toHaveBeenCalled();
    expect(repositorio.falharAgendamento).toHaveBeenCalledWith('ag-1', 'TEMPLATE_NAO_APROVADO');
  });

  it('cancela quando a oportunidade sumiu entre a reserva e o disparo', async () => {
    const { dependencias, repositorio } = montar([itemAgendado()], [], null);

    await drenar(dependencias);

    expect(repositorio.cancelarAgendamento).toHaveBeenCalledWith(
      'ag-1',
      'Oportunidade não encontrada',
    );
  });

  it('reagenda quando o fornecedor não respondeu', async () => {
    const { dependencias, repositorio, mensageiro } = montar([itemAgendado()]);
    mensageiro.enviarTexto.mockResolvedValue({
      ok: false,
      falha: { motivo: 'INDISPONIVEL', detalhe: 'fora do ar' },
    });

    await drenar(dependencias);

    expect(repositorio.reagendar).toHaveBeenCalledOnce();
    expect(repositorio.concluirAgendamento).not.toHaveBeenCalled();
  });

  it('falha o passo quando insistir não resolve', async () => {
    const { dependencias, repositorio, mensageiro } = montar([itemAgendado()]);
    mensageiro.enviarTexto.mockResolvedValue({
      ok: false,
      falha: { motivo: 'RECUSADO', detalhe: 'número bloqueado' },
    });

    await drenar(dependencias);

    expect(repositorio.falharAgendamento).toHaveBeenCalledOnce();
  });
});

describe('drenagem do outbox', () => {
  it('conclui o item entregue', async () => {
    const { dependencias, repositorio } = montar([], [itemDeOutbox()]);

    const balanco = await drenar(dependencias);

    expect(repositorio.concluirOutbox).toHaveBeenCalledWith('ob-1');
    expect(balanco.outbox).toBe(1);
  });

  it('deixa parado o que aguarda conector real', async () => {
    const { dependencias, repositorio, espelho } = montar([], [itemDeOutbox()]);
    espelho.espelhar.mockResolvedValue({
      ok: false,
      falha: { motivo: 'AGUARDANDO_CONECTOR', detalhe: 'sem CRM' },
    });

    await drenar(dependencias);

    expect(repositorio.aguardarConector).toHaveBeenCalledWith('ob-1');
    expect(repositorio.falharOutbox).not.toHaveBeenCalled();
  });

  it('reagenda com espera quando o CRM não respondeu', async () => {
    const { dependencias, repositorio, espelho } = montar([], [itemDeOutbox()]);
    espelho.espelhar.mockResolvedValue({
      ok: false,
      falha: { motivo: 'INDISPONIVEL', detalhe: 'timeout' },
    });

    await drenar(dependencias);

    const [, , emSegundos] = repositorio.falharOutbox.mock.calls[0] ?? [];
    expect(emSegundos).toBeGreaterThan(0);
  });

  it('desiste sem espera quando o CRM recusou', async () => {
    const { dependencias, repositorio, espelho } = montar([], [itemDeOutbox()]);
    espelho.espelhar.mockResolvedValue({
      ok: false,
      falha: { motivo: 'RECUSADO', detalhe: 'campo obrigatório ausente' },
    });

    await drenar(dependencias);

    expect(repositorio.falharOutbox).toHaveBeenCalledWith(
      'ob-1',
      'campo obrigatório ausente',
      null,
    );
  });
});

describe('isolamento de falha', () => {
  it('um item que estoura não derruba o lote', async () => {
    // Sem isso, o item seguinte ficaria parado esperando o próximo tique.
    const { dependencias, repositorio, mensageiro } = montar([
      itemAgendado({ id: 'ag-1' }),
      itemAgendado({ id: 'ag-2' }),
    ]);
    mensageiro.enviarTexto.mockRejectedValueOnce(new Error('estourou'));

    const erros: unknown[] = [];
    const balanco = await drenar(dependencias, (erro) => erros.push(erro));

    expect(erros).toHaveLength(1);
    expect(balanco.falhas).toBe(1);
    expect(repositorio.concluirAgendamento).toHaveBeenCalledWith('ag-2');
  });

  it('falha no outbox também é isolada', async () => {
    const { dependencias, espelho } = montar([], [itemDeOutbox(), itemDeOutbox({ id: 'ob-2' })]);
    espelho.espelhar.mockRejectedValueOnce(new Error('estourou'));

    const balanco = await drenar(dependencias);

    expect(balanco.falhas).toBe(1);
    expect(balanco.outbox).toBe(2);
  });
});

describe('lote vazio', () => {
  it('não faz nada e não reclama', async () => {
    const { dependencias } = montar();

    expect(await drenar(dependencias)).toEqual({ agendamentos: 0, outbox: 0, falhas: 0 });
  });
});
