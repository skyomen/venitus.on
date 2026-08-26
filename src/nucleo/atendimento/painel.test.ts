import { describe, expect, it } from 'vitest';
import {
  etapaNaTela,
  montarOpcoes,
  montarPendencias,
  pendenciaNaTela,
  planoEscolhido,
  prazoEmTexto,
  tomDaPendencia,
} from './painel';
import type { OpcaoBruta, PendenciaBruta } from './painel';

const AGORA = new Date('2026-08-26T12:00:00.000Z');

function emDias(dias: number): Date {
  return new Date(AGORA.getTime() + dias * 86_400_000);
}

function pendencia(ajuste: Partial<PendenciaBruta> = {}): PendenciaBruta {
  return {
    id: 'pendencia-1',
    tipo: 'DOCUMENTO',
    descricao: 'Enviar CNH',
    prazo: emDias(2),
    resolvida: false,
    ...ajuste,
  };
}

function opcao(ajuste: Partial<OpcaoBruta> = {}): OpcaoBruta {
  return {
    id: 'opcao-1',
    nomePlano: 'Compreensiva',
    premio: 2400,
    franquia: 3500,
    seguradora: 'Seguradora Piloto',
    ...ajuste,
  };
}

describe('o prazo em palavras', () => {
  it.each([
    [3, 'Vence em 3 dias'],
    [1, 'Vence amanhã'],
    [0, 'Vence hoje'],
    [-1, 'Venceu ontem'],
    [-4, 'Venceu há 4 dias'],
  ])('%i dias vira "%s"', (dias, esperado) => {
    // "Vence em 2026-08-28" obriga a fazer a conta no meio da ligação.
    expect(prazoEmTexto(emDias(dias), AGORA)).toBe(esperado);
  });

  it('sem prazo, diz que não há', () => {
    expect(prazoEmTexto(null, AGORA)).toBe('Sem prazo');
  });
});

describe('o tom da pendência', () => {
  it('resolvida sai do caminho', () => {
    expect(tomDaPendencia(pendencia({ resolvida: true }), AGORA)).toBe('bom');
  });

  it('vencida grita', () => {
    expect(tomDaPendencia(pendencia({ prazo: emDias(-1) }), AGORA)).toBe('critico');
  });

  it('no prazo pede atenção', () => {
    expect(tomDaPendencia(pendencia(), AGORA)).toBe('atencao');
  });

  it('sem prazo continua pedindo atenção, não vira neutra', () => {
    // Ela segue bloqueando a jornada; a falta de prazo é erro de cadastro, não
    // licença para ignorar.
    expect(tomDaPendencia(pendencia({ prazo: null }), AGORA)).toBe('atencao');
  });

  it('vencida mas resolvida não é crítica', () => {
    expect(tomDaPendencia(pendencia({ prazo: emDias(-9), resolvida: true }), AGORA)).toBe('bom');
  });
});

describe('a pendência na tela', () => {
  it('resolvida diz que está resolvida, não o prazo vencido', () => {
    const naTela = pendenciaNaTela(pendencia({ prazo: emDias(-3), resolvida: true }), AGORA);

    expect(naTela.prazo).toBe('Resolvida');
    expect(naTela.resolvida).toBe(true);
  });

  it('aberta mostra o prazo', () => {
    expect(pendenciaNaTela(pendencia(), AGORA).prazo).toBe('Vence em 2 dias');
  });
});

describe('a ordem das pendências', () => {
  it('é a da urgência, não a do banco', () => {
    const ordenadas = montarPendencias(
      [
        pendencia({ id: 'sem-prazo', prazo: null }),
        pendencia({ id: 'resolvida', prazo: emDias(-9), resolvida: true }),
        pendencia({ id: 'depois', prazo: emDias(5) }),
        pendencia({ id: 'vencida', prazo: emDias(-1) }),
      ],
      AGORA,
    );

    expect(ordenadas.map((p) => p.id)).toEqual(['vencida', 'depois', 'sem-prazo', 'resolvida']);
  });

  it('não altera a lista recebida', () => {
    const original: PendenciaBruta[] = [
      pendencia({ id: 'b' }),
      pendencia({ id: 'a', prazo: null }),
    ];
    montarPendencias(original, AGORA);

    expect(original.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('sem pendência, lista vazia', () => {
    expect(montarPendencias([], AGORA)).toEqual([]);
  });
});

describe('as opções de plano', () => {
  it('vêm da mais barata para a mais cara', () => {
    // É a ordem da conversa: o cliente pergunta o preço primeiro.
    const opcoes = montarOpcoes(
      [
        opcao({ id: 'cara', premio: 3900 }),
        opcao({ id: 'barata', premio: 1800 }),
        opcao({ id: 'media', premio: 2400 }),
      ],
      null,
    );

    expect(opcoes.map((o) => o.id)).toEqual(['barata', 'media', 'cara']);
  });

  it('plano sem prêmio informado vai para o fim', () => {
    const opcoes = montarOpcoes(
      [opcao({ id: 'sem-preco', premio: null }), opcao({ id: 'com-preco', premio: 5000 })],
      null,
    );

    expect(opcoes.map((o) => o.id)).toEqual(['com-preco', 'sem-preco']);
  });

  it('formata prêmio e franquia em reais', () => {
    const [primeira] = montarOpcoes([opcao({ premio: 1234.5, franquia: 3500 })], null);

    expect(primeira?.premio).toBe('R$ 1.234,50');
    expect(primeira?.franquia).toBe('R$ 3.500,00');
  });

  it('valor ausente vira travessão, não zero', () => {
    const [primeira] = montarOpcoes([opcao({ premio: null, franquia: null })], null);

    expect(primeira?.premio).toBe('—');
    expect(primeira?.franquia).toBe('—');
  });

  it('duas opções sem preço mantêm a ordem em que vieram', () => {
    const opcoes = montarOpcoes(
      [opcao({ id: 'a', premio: null }), opcao({ id: 'b', premio: null })],
      null,
    );

    expect(opcoes.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('sem seguradora informada, o lugar não fica em branco', () => {
    expect(montarOpcoes([opcao({ seguradora: null })], null)[0]?.seguradora).toBe('—');
  });

  it('marca só a opção escolhida', () => {
    const opcoes = montarOpcoes([opcao({ id: 'a' }), opcao({ id: 'b', premio: 9000 })], 'b');

    expect(opcoes.map((o) => o.escolhida)).toEqual([false, true]);
  });

  it('escolha apontando para opção que sumiu não marca nada', () => {
    expect(montarOpcoes([opcao({ id: 'a' })], 'foi-embora')[0]?.escolhida).toBe(false);
  });

  it('não altera a lista recebida', () => {
    const original: OpcaoBruta[] = [
      opcao({ id: 'cara', premio: 9 }),
      opcao({ id: 'b', premio: 1 }),
    ];
    montarOpcoes(original, null);

    expect(original.map((o) => o.id)).toEqual(['cara', 'b']);
  });
});

describe('o plano escolhido', () => {
  it('devolve o nome, para a linha de §9.5 no cartão', () => {
    expect(planoEscolhido([opcao({ id: 'x', nomePlano: 'Compreensiva' })], 'x')).toBe(
      'Compreensiva',
    );
  });

  it('sem escolha, não há plano de interesse', () => {
    expect(planoEscolhido([opcao()], null)).toBeNull();
    expect(planoEscolhido([], 'x')).toBeNull();
  });
});

describe('a etapa na tela', () => {
  it('leva rótulo e tom juntos', () => {
    expect(etapaNaTela('VENDIDA')).toEqual({ rotulo: 'Vendida', tom: 'bom' });
    expect(etapaNaTela('EM_NEGOCIACAO')).toEqual({ rotulo: 'Em negociação', tom: 'neutro' });
  });
});
