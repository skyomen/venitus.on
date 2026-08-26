import { describe, expect, it } from 'vitest';
import { ETAPAS, TIPOS_DE_PENDENCIA, montarTextoContextual } from './mensagem';
import type { DadosDaMensagem, Etapa, TipoDePendencia } from './mensagem';

/** Vitest não traz `toStartWith`/`toEndWith`; recortar o trecho dá erro legível. */
function comeca(texto: string, inicio: string): string {
  return texto.slice(0, inicio.length);
}

function termina(texto: string, fim: string): string {
  return texto.slice(-fim.length);
}

function dados(ajuste: Partial<DadosDaMensagem> = {}): DadosDaMensagem {
  return {
    primeiroNome: 'Marina',
    etapa: 'EM_NEGOCIACAO',
    pendencia: null,
    passo: 1,
    totalDePassos: 3,
    ...ajuste,
  };
}

describe('o texto nunca é genérico', () => {
  it('chama a pessoa pelo primeiro nome', () => {
    expect(comeca(montarTextoContextual(dados()), 'Olá, Marina!')).toBe('Olá, Marina!');
  });

  it('a pendência aberta é o assunto, não a etapa', () => {
    const texto = montarTextoContextual(
      dados({
        etapa: 'EM_VISTORIA',
        pendencia: { tipo: 'DOCUMENTO', descricao: 'CRLV do veículo' },
      }),
    );

    expect(texto).toContain('falta um documento');
    expect(texto).toContain('CRLV do veículo');
    expect(texto).not.toContain('vistoria do veículo ainda está aberta');
  });

  it('sem pendência, o assunto é onde a jornada parou', () => {
    expect(montarTextoContextual(dados({ etapa: 'EM_COTACAO' }))).toContain(
      'buscando as opções com as seguradoras',
    );
  });

  it.each(ETAPAS)('a etapa %s produz uma frase inteira', (etapa: Etapa) => {
    expect(montarTextoContextual(dados({ etapa })).length).toBeGreaterThan(40);
  });

  it.each(TIPOS_DE_PENDENCIA)('a pendência %s produz um assunto próprio', (tipo) => {
    const texto = montarTextoContextual(
      dados({ pendencia: { tipo: tipo as TipoDePendencia, descricao: '' } }),
    );
    expect(texto).not.toContain('()');
    expect(texto).not.toContain('atendimento ficou parado');
  });

  it('etapas diferentes não produzem o mesmo texto', () => {
    // Se produzissem, o cliente que anda na jornada receberia sempre a mesma
    // cobrança — que é exatamente o texto genérico que §11.2 proíbe. As três
    // etapas terminais compartilham o assunto padrão, e não têm régua.
    const assuntos = new Set(ETAPAS.map((etapa) => montarTextoContextual(dados({ etapa }))));
    expect(assuntos.size).toBe(ETAPAS.length - 2);
  });

  it('etapa terminal cai no assunto padrão em vez de inventar um', () => {
    expect(montarTextoContextual(dados({ etapa: 'PERDIDA' }))).toContain(
      'seu atendimento ficou parado',
    );
  });

  it('descrição só com espaço não vira parêntese vazio', () => {
    const texto = montarTextoContextual(
      dados({ pendencia: { tipo: 'PAGAMENTO', descricao: '   ' } }),
    );
    expect(texto).not.toContain('(');
  });

  it('nome ausente não vira "Olá, !"', () => {
    expect(comeca(montarTextoContextual(dados({ primeiroNome: '  ' })), 'Olá! Sobre')).toBe(
      'Olá! Sobre',
    );
  });
});

describe('o fecho muda conforme a insistência', () => {
  it('o primeiro passo pergunta como seguir', () => {
    expect(termina(montarTextoContextual(dados({ passo: 1 })), 'como prefere seguir?')).toBe(
      'como prefere seguir?',
    );
  });

  it('o segundo oferece retomar', () => {
    expect(termina(montarTextoContextual(dados({ passo: 2 })), 'de onde paramos?')).toBe(
      'de onde paramos?',
    );
  });

  it('o último abre a porta de saída em vez de cobrar de novo', () => {
    const texto = montarTextoContextual(dados({ passo: 3, totalDePassos: 3 }));
    expect(termina(texto, 'eu encerro por aqui.')).toBe('eu encerro por aqui.');
  });

  it('régua mais longa que a lista de fechos ainda tem fecho', () => {
    const texto = montarTextoContextual(dados({ passo: 4, totalDePassos: 9 }));
    expect(termina(texto, 'horário para falarmos.')).toBe('horário para falarmos.');
  });

  it('passo fora da faixa não quebra a frase', () => {
    const texto = montarTextoContextual(dados({ passo: 0, totalDePassos: 3 }));
    expect(termina(texto, 'como prefere seguir?')).toBe('como prefere seguir?');
  });
});
