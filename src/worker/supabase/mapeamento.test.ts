import { describe, expect, it } from 'vitest';
import { falha, sucesso } from '@/conectores/contrato';
import type { ItemAgendado } from '../portas';
import {
  classificarAgendamentos,
  classificarOutbox,
  montarContextoDoDisparo,
  paraResultadoDoEnvio,
  posicaoDoPasso,
  reguaDoAgendamento,
} from './mapeamento';
import type { LinhaDeAgendamento, LinhaDeOutbox } from './mapeamento';

const OPORTUNIDADE = '00000000-0000-4000-8000-0000000000a1';

function linhaAgendada(ajuste: Partial<LinhaDeAgendamento> = {}): LinhaDeAgendamento {
  return {
    id: 'agendamento-1',
    oportunidade_id: OPORTUNIDADE,
    tipo: 'INATIVIDADE_1',
    tentativas: 1,
    payload: {},
    ...ajuste,
  };
}

function linhaDeOutbox(ajuste: Partial<LinhaDeOutbox> = {}): LinhaDeOutbox {
  return {
    id: 'outbox-1',
    tentativas: 0,
    chave_idempotencia: 'crm:etapa:1',
    destino: 'CRM',
    operacao: 'MOVER_ETAPA',
    oportunidade_id: OPORTUNIDADE,
    payload: { de: 'NOVO', para: 'EM_VALIDACAO' },
    ...ajuste,
  };
}

describe('qual régua é esta', () => {
  it('o payload responde direto', () => {
    expect(reguaDoAgendamento({ regua: 'RECUPERACAO' }, 'INATIVIDADE_1')).toBe('RECUPERACAO');
  });

  it('sem payload, o tipo do passo denuncia a régua', () => {
    expect(reguaDoAgendamento(null, 'ABERTURA_3')).toBe('ABERTURA');
    expect(reguaDoAgendamento({}, 'R2')).toBe('RECUPERACAO');
  });

  it('régua inventada no payload não passa', () => {
    // Aceitar o que veio gravado faria o cliente receber a cadência errada.
    expect(reguaDoAgendamento({ regua: 'MINHA_REGUA' }, 'ABERTURA_1')).toBe('ABERTURA');
    expect(reguaDoAgendamento({ regua: 7 }, 'nada-conhecido')).toBeNull();
  });

  it('tipo desconhecido e payload vazio não viram palpite', () => {
    expect(reguaDoAgendamento(null, 'PASSO_QUE_NAO_EXISTE')).toBeNull();
  });
});

describe('classificar agendamentos', () => {
  it('vira item com a régua e o template que o passo declara', () => {
    const { itens } = classificarAgendamentos([linhaAgendada({ tipo: 'ABERTURA_2' })]);

    expect(itens[0]).toEqual({
      id: 'agendamento-1',
      oportunidadeId: OPORTUNIDADE,
      regua: 'ABERTURA',
      tipo: 'ABERTURA_2',
      tentativas: 1,
      template: '02_abertura',
    });
  });

  it('passo de texto livre não ganha template', () => {
    const { itens } = classificarAgendamentos([linhaAgendada({ tipo: 'INATIVIDADE_1' })]);
    expect(itens[0]?.template).toBeUndefined();
  });

  it('linha sem régua vira recusa nomeada, não exceção', () => {
    const { itens, recusadas } = classificarAgendamentos([
      linhaAgendada({ id: 'orfao', tipo: 'PASSO_ESTRANHO', payload: null }),
    ]);

    expect(itens).toHaveLength(0);
    expect(recusadas).toEqual([
      { id: 'orfao', motivo: 'Agendamento "PASSO_ESTRANHO" sem régua conhecida' },
    ]);
  });

  it('uma linha ruim não derruba as boas', () => {
    const { itens, recusadas } = classificarAgendamentos([
      linhaAgendada({ id: 'ruim', tipo: 'PASSO_ESTRANHO' }),
      linhaAgendada({ id: 'boa' }),
    ]);

    expect(itens.map((i) => i.id)).toEqual(['boa']);
    expect(recusadas).toHaveLength(1);
  });

  it('agendamento nunca fica esperando conector', () => {
    expect(classificarAgendamentos([linhaAgendada()]).semConector).toEqual([]);
  });
});

describe('classificar o outbox', () => {
  it('vira espelhamento de CRM', () => {
    const { itens } = classificarOutbox([linhaDeOutbox()]);

    expect(itens[0]).toEqual({
      id: 'outbox-1',
      tentativas: 0,
      chaveIdempotencia: 'crm:etapa:1',
      espelhamento: {
        operacao: 'MOVER_ETAPA',
        oportunidadeId: OPORTUNIDADE,
        dados: { de: 'NOVO', para: 'EM_VALIDACAO' },
      },
    });
  });

  it('sincronizar contato existe sem oportunidade', () => {
    const { itens } = classificarOutbox([
      linhaDeOutbox({ operacao: 'SINCRONIZAR_CONTATO', oportunidade_id: null }),
    ]);
    expect(itens[0]?.espelhamento.oportunidadeId).toBeNull();
  });

  it('payload que não é objeto vira dados vazios', () => {
    const { itens } = classificarOutbox([linhaDeOutbox({ payload: 'texto solto' })]);
    expect(itens[0]?.espelhamento.dados).toEqual({});
  });

  it('destino sem drenador espera conector em vez de falhar', () => {
    // A intenção está guardada; não há defeito para o gestor caçar (§10.5).
    const { itens, recusadas, semConector } = classificarOutbox([
      linhaDeOutbox({ id: 'para-seguradora', destino: 'SEGURADORA' }),
    ]);

    expect(itens).toHaveLength(0);
    expect(recusadas).toHaveLength(0);
    expect(semConector).toEqual(['para-seguradora']);
  });

  it('operação de CRM desconhecida é recusa, não espera', () => {
    // Aqui há defeito de verdade: alguém gravou uma operação que o contrato não
    // tem, e esperar não a tornaria válida.
    const { recusadas, semConector } = classificarOutbox([
      linhaDeOutbox({ id: 'torto', operacao: 'DELETAR_TUDO' }),
    ]);

    expect(recusadas).toEqual([
      { id: 'torto', motivo: 'Operação de CRM desconhecida: DELETAR_TUDO' },
    ]);
    expect(semConector).toEqual([]);
  });
});

describe('posição do passo na régua', () => {
  it('conta a partir de 1', () => {
    expect(posicaoDoPasso('INATIVIDADE', 'INATIVIDADE_2')).toEqual({ passo: 2, total: 3 });
  });

  it('tipo fora da régua vira passo 0, e o texto trata isso', () => {
    expect(posicaoDoPasso('INATIVIDADE', 'OUTRO')).toEqual({ passo: 0, total: 3 });
  });
});

describe('montar o contexto do disparo', () => {
  const item: ItemAgendado = {
    id: 'agendamento-1',
    oportunidadeId: OPORTUNIDADE,
    regua: 'INATIVIDADE',
    tipo: 'INATIVIDADE_1',
    tentativas: 1,
    template: undefined,
  };

  const bruto = {
    agora: '2026-08-26T13:00:00.000Z',
    dono_conversa: 'AUTOMACAO',
    etapa: 'EM_COTACAO',
    ultima_mensagem_cliente_em: '2026-08-26T12:00:00.000Z',
    consentimento: true,
    janelas_do_dia: [[480, 1080]],
    minutos_do_dia: 600,
    telefone_e164: '+5511988887777',
    primeiro_nome: 'Marina',
    pendencia: null,
    template_aprovado_em: null,
  };

  it('traduz o que o portão de envio precisa', () => {
    const contexto = montarContextoDoDisparo(bruto, item);

    expect(contexto?.contexto).toEqual({
      agora: new Date('2026-08-26T13:00:00.000Z'),
      donoConversa: 'AUTOMACAO',
      ultimaMensagemDoCliente: new Date('2026-08-26T12:00:00.000Z'),
      consentimento: true,
      janelasDoDia: [[480, 1080]],
      minutosDoDia: 600,
    });
    expect(contexto?.telefoneE164).toBe('+5511988887777');
    expect(contexto?.templateAprovadoEm).toBeNull();
  });

  it('o texto sai contextual, com nome e etapa', () => {
    const contexto = montarContextoDoDisparo(bruto, item);

    expect(contexto?.textoContextual).toContain('Marina');
    expect(contexto?.textoContextual).toContain('buscando as opções com as seguradoras');
  });

  it('a pendência aberta vira o assunto', () => {
    const contexto = montarContextoDoDisparo(
      { ...bruto, pendencia: { tipo: 'VISTORIA', descricao: 'agendar vistoria' } },
      item,
    );

    expect(contexto?.textoContextual).toContain('vistoria ainda precisa ser agendada');
    expect(contexto?.textoContextual).toContain('agendar vistoria');
  });

  it('pendência sem descrição fala pelo tipo, sem parêntese vazio', () => {
    const contexto = montarContextoDoDisparo({ ...bruto, pendencia: { tipo: 'PAGAMENTO' } }, item);

    expect(contexto?.textoContextual).toContain('pagamento ainda não foi confirmado');
    expect(contexto?.textoContextual).not.toContain('(');
  });

  it('pendência com tipo desconhecido é ignorada em vez de virar texto torto', () => {
    const contexto = montarContextoDoDisparo({ ...bruto, pendencia: { tipo: 'XPTO' } }, item);
    expect(contexto?.textoContextual).toContain('buscando as opções');
  });

  it('lê a aprovação do template quando há template', () => {
    const contexto = montarContextoDoDisparo(
      { ...bruto, template_aprovado_em: '2026-01-01T00:00:00.000Z' },
      { ...item, tipo: 'ABERTURA_1', regua: 'ABERTURA', template: '01_primeiro_contato' },
    );

    expect(contexto?.templateAprovadoEm).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('oportunidade que sumiu devolve nada', () => {
    expect(montarContextoDoDisparo(null, item)).toBeNull();
  });

  it('composto nulo expandido pelo PostgREST também devolve nada', () => {
    // Testar `data === null` daria sempre falso: o PostgREST entrega um objeto
    // com todos os campos nulos.
    expect(montarContextoDoDisparo({ dono_conversa: null, etapa: null }, item)).toBeNull();
  });

  it('dono desconhecido silencia a automação', () => {
    // Errar para o lado que não constrange o cliente.
    const contexto = montarContextoDoDisparo({ ...bruto, dono_conversa: 'ALGUEM' }, item);
    expect(contexto?.contexto.donoConversa).toBe('CONSULTOR');
  });

  it('etapa desconhecida não quebra a frase', () => {
    const contexto = montarContextoDoDisparo({ ...bruto, etapa: 'ETAPA_NOVA' }, item);
    expect(contexto?.textoContextual).toContain('ainda não conseguimos conversar');
  });

  it('contato sem telefone chega vazio, para o conector recusar', () => {
    const contexto = montarContextoDoDisparo({ ...bruto, telefone_e164: null }, item);
    expect(contexto?.telefoneE164).toBe('');
  });

  it('sem "agora" no retorno, usa o relógio em vez de uma data inválida', () => {
    const contexto = montarContextoDoDisparo({ ...bruto, agora: null }, item);
    expect(contexto?.contexto.agora.getTime()).toBeGreaterThan(0);
  });

  it('nome ausente não vira "Olá, !"', () => {
    const contexto = montarContextoDoDisparo({ ...bruto, primeiro_nome: null }, item);
    expect(contexto?.textoContextual.slice(0, 5)).toBe('Olá! ');
  });
});

describe('resultado do conector para a decisão', () => {
  it('sucesso vira ok, sem carregar o corpo do fornecedor', () => {
    expect(paraResultadoDoEnvio(sucesso({ idExterno: 'x' }, 'STUB'))).toEqual({ ok: true });
  });

  it('falha preserva o motivo, que é o que decide tentar de novo', () => {
    const resultado = paraResultadoDoEnvio(falha('INDISPONIVEL', 'fornecedor caiu'));

    expect(resultado.ok).toBe(false);
    expect(resultado.falha?.motivo).toBe('INDISPONIVEL');
  });
});
